/**
 * Re-Verification API Routes
 * 
 * Endpoints for managing quarterly AI system re-verification:
 * - Get expiring certifications
 * - Manually trigger re-verification
 * - Get re-verification status for health system
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { reVerificationService } from "../services/re-verification-service";
import { storage } from "../storage";
import { logger } from "../logger";

// Validation schemas
const triggerReVerificationSchema = z.object({
  aiSystemId: z.string().min(1),
});

const getExpiringSchema = z.object({
  daysAhead: z.number().min(1).max(90).optional(),
});

/**
 * Helper to get user and verify they're a health system user
 */
async function getHealthSystemUser(req: Request, res: Response) {
  if (!req.session.userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }

  const user = await storage.getUser(req.session.userId);
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return null;
  }

  if (user.role !== 'health_system' || !user.healthSystemId) {
    res.status(403).json({ error: 'Forbidden: Health system access required' });
    return null;
  }

  return user;
}

export function registerReVerificationRoutes(app: Express) {
  
  /**
   * Get expiring certifications for the health system
   */
  app.get("/api/re-verification/expiring", async (req: Request, res: Response) => {
    try {
      const user = await getHealthSystemUser(req, res);
      if (!user) return;

      // Validate query parameters
      const { daysAhead } = req.query;
      let days = 14; // Default
      
      if (daysAhead) {
        const parsed = parseInt(daysAhead as string);
        if (isNaN(parsed) || parsed < 1 || parsed > 90) {
          return res.status(400).json({ 
            error: 'Invalid daysAhead parameter',
            details: 'Must be a number between 1 and 90'
          });
        }
        days = parsed;
      }
      
      const allExpiring = await reVerificationService.getExpiringCertifications(days);
      
      // Filter to only this health system's certifications
      const filtered = allExpiring.filter(cert => 
        cert.healthSystemId === user.healthSystemId
      );

      res.json({
        count: filtered.length,
        daysAhead: days,
        certifications: filtered,
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to get expiring certifications');
      res.status(500).json({ error: 'Failed to get expiring certifications' });
    }
  });

  /**
   * Get re-verification status for health system's portfolio
   */
  app.get("/api/re-verification/status", async (req: Request, res: Response) => {
    try {
      const user = await getHealthSystemUser(req, res);
      if (!user) return;

      if (!user.healthSystemId) {
        return res.status(400).json({ error: 'Health system ID not found' });
      }

      const status = await reVerificationService.getReVerificationStatus(user.healthSystemId);
      res.json(status);
    } catch (error) {
      logger.error({ err: error }, 'Failed to get re-verification status');
      res.status(500).json({ error: 'Failed to get re-verification status' });
    }
  });

  /**
   * Manually trigger re-verification for a specific AI system
   */
  app.post("/api/re-verification/trigger", async (req: Request, res: Response) => {
    try {
      const user = await getHealthSystemUser(req, res);
      if (!user) return;

      triggerReVerificationSchema.parse(req.body);
      const { aiSystemId } = req.body;

      // Verify AI system belongs to this health system
      const aiSystem = await storage.getAISystem(aiSystemId);
      if (!aiSystem || aiSystem.healthSystemId !== user.healthSystemId) {
        return res.status(404).json({ error: 'AI system not found' });
      }

      const result = await reVerificationService.triggerReVerification(aiSystemId);
      
      if (!result.success) {
        return res.status(500).json({ 
          error: result.message,
          result 
        });
      }

      res.json({
        message: 'Re-verification triggered successfully',
        result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      logger.error({ err: error }, 'Failed to trigger re-verification');
      res.status(500).json({ error: 'Failed to trigger re-verification' });
    }
  });

  /**
   * Get re-verification history for an AI system
   */
  app.get("/api/re-verification/history/:aiSystemId", async (req: Request, res: Response) => {
    try {
      const user = await getHealthSystemUser(req, res);
      if (!user) return;

      const { aiSystemId } = req.params;

      // Verify AI system belongs to this health system
      const aiSystem = await storage.getAISystem(aiSystemId);
      if (!aiSystem || aiSystem.healthSystemId !== user.healthSystemId) {
        return res.status(404).json({ error: 'AI system not found' });
      }

      // Return verification history from AI system record
      res.json({
        aiSystemId,
        name: aiSystem.name,
        currentTier: aiSystem.verificationTier,
        verificationDate: aiSystem.verificationDate,
        verificationExpiry: aiSystem.verificationExpiry,
        daysUntilExpiry: aiSystem.verificationExpiry 
          ? Math.floor((aiSystem.verificationExpiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
          : null,
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to get re-verification history');
      res.status(500).json({ error: 'Failed to get re-verification history' });
    }
  });

  /**
   * ADMIN ONLY: Process all expired certifications manually
   */
  app.post("/api/re-verification/process-expired", async (req: Request, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user || user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      const results = await reVerificationService.processExpiredCertifications();
      
      res.json({
        message: 'Expired certifications processed',
        processed: results.length,
        downgraded: results.filter(r => r.action === 'downgraded').length,
        removed: results.filter(r => r.action === 'removed').length,
        failed: results.filter(r => r.action === 'failed').length,
        results,
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to process expired certifications');
      res.status(500).json({ error: 'Failed to process expired certifications' });
    }
  });
}
