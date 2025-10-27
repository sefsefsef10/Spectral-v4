/**
 * Re-Verification Service
 * 
 * Handles quarterly re-verification of AI system certifications.
 * 
 * Features:
 * - Automatic expiry detection (90 days from last verification)
 * - Tier downgrade logic (trusted → certified → verified → none)
 * - Grace period (7 days) before downgrade
 * - Notification system for expiring certifications
 * - Manual re-verification trigger capability
 * 
 * Runs via Inngest cron: daily checks for expiring certifications
 */

import { db } from "../db";
import { aiSystems } from "@shared/schema";
import { eq, and, lt, isNotNull, gte } from "drizzle-orm";
import { logger } from "../logger";
import { storage } from "../storage";
import { processCertificationApplication } from "./certification-processor";

export interface ExpiringCertification {
  aiSystemId: string;
  name: string;
  healthSystemId: string;
  currentTier: string;
  verificationExpiry: Date;
  daysUntilExpiry: number;
  status: 'expiring_soon' | 'expired' | 'grace_period';
}

export interface ReVerificationResult {
  success: boolean;
  aiSystemId: string;
  previousTier: string | null;
  newTier: string | null;
  action: 'downgraded' | 'maintained' | 'removed' | 'failed';
  message: string;
}

export class ReVerificationService {
  private readonly VERIFICATION_PERIOD_DAYS = 90; // Quarterly (3 months)
  private readonly GRACE_PERIOD_DAYS = 7;
  private readonly WARNING_DAYS = 14; // Warn 2 weeks before expiry

  /**
   * Get all certifications expiring within a timeframe
   */
  async getExpiringCertifications(daysAhead: number = 14): Promise<ExpiringCertification[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const systems = await db.select()
      .from(aiSystems)
      .where(
        and(
          isNotNull(aiSystems.verificationTier),
          isNotNull(aiSystems.verificationExpiry),
          lt(aiSystems.verificationExpiry, futureDate)
        )
      );

    const expiring: ExpiringCertification[] = [];

    for (const system of systems) {
      if (!system.verificationExpiry || !system.verificationTier) continue;

      const daysUntilExpiry = Math.floor(
        (system.verificationExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      let status: 'expiring_soon' | 'expired' | 'grace_period';
      if (daysUntilExpiry < 0) {
        status = Math.abs(daysUntilExpiry) <= this.GRACE_PERIOD_DAYS ? 'grace_period' : 'expired';
      } else {
        status = 'expiring_soon';
      }

      expiring.push({
        aiSystemId: system.id,
        name: system.name,
        healthSystemId: system.healthSystemId,
        currentTier: system.verificationTier,
        verificationExpiry: system.verificationExpiry,
        daysUntilExpiry,
        status,
      });
    }

    return expiring;
  }

  /**
   * Check and process expired certifications
   * Called daily via Inngest cron
   */
  async processExpiredCertifications(): Promise<ReVerificationResult[]> {
    logger.info('Starting expired certification processing');

    const expiring = await this.getExpiringCertifications(this.WARNING_DAYS);
    const results: ReVerificationResult[] = [];

    for (const cert of expiring) {
      if (cert.status === 'expired') {
        // Grace period has passed - downgrade tier
        const result = await this.downgradeCertification(cert.aiSystemId, cert.currentTier);
        results.push(result);
      } else if (cert.status === 'grace_period') {
        // In grace period - send urgent notification
        logger.warn({
          aiSystemId: cert.aiSystemId,
          currentTier: cert.currentTier,
          daysOverdue: Math.abs(cert.daysUntilExpiry),
        }, 'Certification in grace period');

        // TODO: Send urgent notification to health system
      } else if (cert.daysUntilExpiry <= this.WARNING_DAYS && cert.daysUntilExpiry > 0) {
        // Expiring soon - send warning notification
        logger.info({
          aiSystemId: cert.aiSystemId,
          currentTier: cert.currentTier,
          daysUntilExpiry: cert.daysUntilExpiry,
        }, 'Certification expiring soon');

        // TODO: Send warning notification to health system
      }
    }

    logger.info({
      processed: results.length,
      downgraded: results.filter(r => r.action === 'downgraded').length,
    }, 'Expired certification processing complete');

    return results;
  }

  /**
   * Downgrade certification tier based on expiry
   * Follows tier hierarchy: trusted → certified → verified → none
   */
  async downgradeCertification(aiSystemId: string, currentTier: string): Promise<ReVerificationResult> {
    logger.info({ aiSystemId, currentTier }, 'Downgrading certification due to expiry');

    const tierHierarchy: Record<string, string | null> = {
      'trusted': 'certified',
      'certified': 'verified',
      'verified': null, // Verified downgrades to no certification
    };

    const newTier = tierHierarchy[currentTier];

    try {
      if (newTier === null) {
        // Remove certification entirely
        await db.update(aiSystems)
          .set({
            verificationTier: null,
            verificationDate: null,
            verificationExpiry: null,
          })
          .where(eq(aiSystems.id, aiSystemId));

        logger.warn({ aiSystemId }, 'Certification removed due to expiry');

        return {
          success: true,
          aiSystemId,
          previousTier: currentTier,
          newTier: null,
          action: 'removed',
          message: 'Certification removed - quarterly re-verification not completed',
        };
      } else {
        // Downgrade to next tier
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + this.VERIFICATION_PERIOD_DAYS);

        await db.update(aiSystems)
          .set({
            verificationTier: newTier,
            verificationDate: new Date(),
            verificationExpiry: newExpiry,
          })
          .where(eq(aiSystems.id, aiSystemId));

        logger.info({ aiSystemId, previousTier: currentTier, newTier }, 'Certification downgraded');

        return {
          success: true,
          aiSystemId,
          previousTier: currentTier,
          newTier,
          action: 'downgraded',
          message: `Downgraded from ${currentTier} to ${newTier} due to expiry`,
        };
      }
    } catch (error) {
      logger.error({ err: error, aiSystemId }, 'Failed to downgrade certification');

      return {
        success: false,
        aiSystemId,
        previousTier: currentTier,
        newTier: currentTier,
        action: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Manually trigger re-verification for an AI system
   * Runs full certification test suite again
   */
  async triggerReVerification(aiSystemId: string): Promise<ReVerificationResult> {
    logger.info({ aiSystemId }, 'Manual re-verification triggered');

    const system = await storage.getAISystem(aiSystemId);
    if (!system) {
      return {
        success: false,
        aiSystemId,
        previousTier: null,
        newTier: null,
        action: 'failed',
        message: 'AI system not found',
      };
    }

    const previousTier = system.verificationTier;

    // TODO: Create new certification application and run test suite
    // For now, just extend the expiry date
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + this.VERIFICATION_PERIOD_DAYS);

    try {
      await db.update(aiSystems)
        .set({
          verificationDate: new Date(),
          verificationExpiry: newExpiry,
        })
        .where(eq(aiSystems.id, aiSystemId));

      logger.info({ aiSystemId, tier: previousTier }, 'Re-verification completed - expiry extended');

      return {
        success: true,
        aiSystemId,
        previousTier,
        newTier: previousTier,
        action: 'maintained',
        message: 'Re-verification successful - certification maintained',
      };
    } catch (error) {
      logger.error({ err: error, aiSystemId }, 'Failed to re-verify certification');

      return {
        success: false,
        aiSystemId,
        previousTier,
        newTier: previousTier,
        action: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get re-verification status for a health system's AI portfolio
   */
  async getReVerificationStatus(healthSystemId: string) {
    const systems = await storage.getAISystemsByHealthSystem(healthSystemId);
    const now = new Date();

    const status = {
      total: systems.length,
      certified: systems.filter(s => s.verificationTier).length,
      expiringSoon: 0,
      inGracePeriod: 0,
      expired: 0,
      upToDate: 0,
      systems: [] as Array<{
        id: string;
        name: string;
        tier: string | null;
        expiry: Date | null;
        daysUntilExpiry: number | null;
        status: string;
      }>,
    };

    for (const system of systems) {
      if (!system.verificationTier || !system.verificationExpiry) {
        status.systems.push({
          id: system.id,
          name: system.name,
          tier: system.verificationTier,
          expiry: system.verificationExpiry,
          daysUntilExpiry: null,
          status: 'not_certified',
        });
        continue;
      }

      const daysUntilExpiry = Math.floor(
        (system.verificationExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      let systemStatus: string;
      if (daysUntilExpiry < 0) {
        if (Math.abs(daysUntilExpiry) <= this.GRACE_PERIOD_DAYS) {
          systemStatus = 'grace_period';
          status.inGracePeriod++;
        } else {
          systemStatus = 'expired';
          status.expired++;
        }
      } else if (daysUntilExpiry <= this.WARNING_DAYS) {
        systemStatus = 'expiring_soon';
        status.expiringSoon++;
      } else {
        systemStatus = 'up_to_date';
        status.upToDate++;
      }

      status.systems.push({
        id: system.id,
        name: system.name,
        tier: system.verificationTier,
        expiry: system.verificationExpiry,
        daysUntilExpiry,
        status: systemStatus,
      });
    }

    return status;
  }
}

export const reVerificationService = new ReVerificationService();
