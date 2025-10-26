/**
 * 📊 USAGE METERING SERVICE - Phase 4 Business Model
 * 
 * Tracks usage metrics for billing and plan limits
 * Enables usage-based pricing and overage calculations
 */

import { db } from "../db";
import {
  aiSystems,
  monitoringAlerts,
  executiveReports,
} from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../logger";

// NOTE: Billing tables (usageMeters, billingAccounts) not yet in schema
// This service provides the interface but persistence requires adding billing tables
// See IMPLEMENTATION_ROADMAP.md Phase 4 for full billing schema

export type MeterType = 'ai_systems' | 'alerts' | 'reports' | 'api_calls' | 'users' | 'certifications';

export interface UsageMeterRecord {
  id: string;
  billingAccountId: string;
  meterType: string;
  period: string;
  count: number;
  limit?: number | null;
  overage: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageSummary {
  period: string;
  meters: {
    ai_systems: { count: number; limit?: number; overage: number };
    alerts: { count: number; limit?: number; overage: number };
    reports: { count: number; limit?: number; overage: number };
    api_calls: { count: number; limit?: number; overage: number };
    users: { count: number; limit?: number; overage: number };
    certifications: { count: number; limit?: number; overage: number };
  };
  totalOverages: number;
  withinLimits: boolean;
}

export interface PlanLimits {
  plan: 'foundation' | 'growth' | 'enterprise' | 'custom';
  limits: {
    ai_systems: number;
    alerts: number;
    reports: number;
    api_calls: number;
    users: number;
    certifications: number;
  };
}

// Plan limits configuration
const PLAN_LIMITS: Record<string, PlanLimits['limits']> = {
  foundation: {
    ai_systems: 10,
    alerts: 100,
    reports: 5,
    api_calls: 1000,
    users: 5,
    certifications: 3,
  },
  growth: {
    ai_systems: 50,
    alerts: 500,
    reports: 25,
    api_calls: 10000,
    users: 25,
    certifications: 15,
  },
  enterprise: {
    ai_systems: -1, // Unlimited
    alerts: -1,
    reports: -1,
    api_calls: -1,
    users: -1,
    certifications: -1,
  },
};

export class UsageMeteringService {
  /**
   * Record usage for a meter type
   * NOTE: Requires usageMeters table - currently in-memory only
   */
  async recordUsage(
    billingAccountId: string,
    meterType: MeterType,
    count: number = 1
  ): Promise<void> {
    const period = this.getCurrentPeriod();

    logger.debug({
      billingAccountId,
      meterType,
      count,
      period,
    }, "Recording usage (in-memory - billing tables not yet implemented)");

    // TODO: Implement when billing tables are added to schema
    // For now, just log the usage event
  }

  /**
   * Set plan limits for a billing account
   * NOTE: Requires usageMeters table - currently in-memory only
   */
  async setPlanLimits(
    billingAccountId: string,
    plan: 'foundation' | 'growth' | 'enterprise' | 'custom',
    customLimits?: Partial<PlanLimits['limits']>
  ): Promise<void> {
    logger.info({
      billingAccountId,
      plan,
    }, "Setting plan limits (in-memory - billing tables not yet implemented)");

    // TODO: Implement when billing tables are added to schema
  }

  /**
   * Get usage summary for a billing account
   * NOTE: Requires usageMeters table - currently returns mock data
   */
  async getUsageSummary(
    billingAccountId: string,
    period?: string
  ): Promise<UsageSummary> {
    const targetPeriod = period || this.getCurrentPeriod();

    // TODO: Implement when billing tables are added to schema
    // For now, return empty summary
    const summary: UsageSummary = {
      period: targetPeriod,
      meters: {
        ai_systems: { count: 0, overage: 0 },
        alerts: { count: 0, overage: 0 },
        reports: { count: 0, overage: 0 },
        api_calls: { count: 0, overage: 0 },
        users: { count: 0, overage: 0 },
        certifications: { count: 0, overage: 0 },
      },
      totalOverages: 0,
      withinLimits: true,
    };

    return summary;
  }

  /**
   * Calculate actual usage from database (for reconciliation)
   */
  async calculateActualUsage(
    billingAccountId: string,
    healthSystemId: string,
    vendorId?: string
  ): Promise<Partial<Record<MeterType, number>>> {
    const usage: Partial<Record<MeterType, number>> = {};

    // Count AI systems
    const aiSystemsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(aiSystems)
      .where(eq(aiSystems.healthSystemId, healthSystemId));
    usage.ai_systems = Number(aiSystemsCount[0]?.count || 0);

    // Count alerts (current period)
    const period = this.getCurrentPeriod();
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const alertsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(monitoringAlerts)
      .where(
        sql`${monitoringAlerts.createdAt} >= ${startDate} AND ${monitoringAlerts.createdAt} <= ${endDate}`
      );
    usage.alerts = Number(alertsCount[0]?.count || 0);

    // Count reports (current period)
    const reportsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(executiveReports)
      .where(
        and(
          eq(executiveReports.healthSystemId, healthSystemId),
          sql`${executiveReports.createdAt} >= ${startDate} AND ${executiveReports.createdAt} <= ${endDate}`
        )
      );
    usage.reports = Number(reportsCount[0]?.count || 0);

    logger.info({
      billingAccountId,
      usage,
    }, "Calculated actual usage");

    return usage;
  }

  /**
   * Reconcile metered usage with actual usage
   * Ensures billing accuracy
   * NOTE: Requires usageMeters table - currently logs only
   */
  async reconcileUsage(
    billingAccountId: string,
    healthSystemId: string
  ): Promise<void> {
    logger.info({
      billingAccountId,
      healthSystemId,
    }, "Reconciling usage (in-memory - billing tables not yet implemented)");

    const actualUsage = await this.calculateActualUsage(billingAccountId, healthSystemId);

    // TODO: Implement when billing tables are added to schema
    // For now, just log the actual usage
    logger.info({
      billingAccountId,
      healthSystemId,
      actualUsage,
    }, "Actual usage calculated (not persisted)");
  }

  /**
   * Check if usage is approaching limit (for alerts)
   */
  async checkUsageAlerts(billingAccountId: string): Promise<Array<{
    meterType: string;
    count: number;
    limit: number;
    percentUsed: number;
  }>> {
    const summary = await this.getUsageSummary(billingAccountId);
    const alerts: Array<{
      meterType: string;
      count: number;
      limit: number;
      percentUsed: number;
    }> = [];

    for (const [meterType, meter] of Object.entries(summary.meters)) {
      if (meter.limit && meter.limit > 0) {
        const percentUsed = (meter.count / meter.limit) * 100;

        // Alert at 80% and 100% usage
        if (percentUsed >= 80) {
          alerts.push({
            meterType,
            count: meter.count,
            limit: meter.limit,
            percentUsed,
          });
        }
      }
    }

    return alerts;
  }

  /**
   * Get current period (YYYY-MM format)
   */
  private getCurrentPeriod(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Calculate overage
   */
  private calculateOverage(count: number, limit: number | null | undefined): number {
    if (!limit || limit < 0) return 0; // Unlimited
    return Math.max(0, count - limit);
  }

  /**
   * Get usage history (last N periods)
   * NOTE: Requires usageMeters table - currently returns mock data
   */
  async getUsageHistory(
    billingAccountId: string,
    periods: number = 6
  ): Promise<UsageSummary[]> {
    const history: UsageSummary[] = [];

    const now = new Date();
    for (let i = 0; i < periods; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const period = `${year}-${month}`;

      // Returns empty summary (stubbed)
      const summary = await this.getUsageSummary(billingAccountId, period);
      history.push(summary);
    }

    return history;
  }

  /**
   * Get overage charges (for billing)
   */
  async calculateOverageCharges(
    billingAccountId: string,
    period?: string
  ): Promise<{
    period: string;
    totalOverages: number;
    charges: Record<string, { overage: number; rate: number; charge: number }>;
    totalCharge: number;
  }> {
    const summary = await this.getUsageSummary(billingAccountId, period);

    // Overage rates (per unit over limit)
    const overageRates: Record<string, number> = {
      ai_systems: 50, // $50 per additional AI system
      alerts: 0.10, // $0.10 per additional alert
      reports: 25, // $25 per additional report
      api_calls: 0.001, // $0.001 per additional API call
      users: 15, // $15 per additional user
      certifications: 100, // $100 per additional certification
    };

    const charges: Record<string, { overage: number; rate: number; charge: number }> = {};
    let totalCharge = 0;

    for (const [meterType, meter] of Object.entries(summary.meters)) {
      if (meter.overage > 0) {
        const rate = overageRates[meterType] || 0;
        const charge = meter.overage * rate;
        charges[meterType] = {
          overage: meter.overage,
          rate,
          charge,
        };
        totalCharge += charge;
      }
    }

    return {
      period: summary.period,
      totalOverages: summary.totalOverages,
      charges,
      totalCharge,
    };
  }
}

export const usageMeteringService = new UsageMeteringService();
