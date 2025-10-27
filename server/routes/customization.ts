/**
 * 🎯 TIERED CUSTOMIZATION API ROUTES
 * 
 * Tier-based customization endpoints:
 * - Growth tier: Threshold overrides, control toggles
 * - Enterprise tier: Custom controls, approval workflow
 */

import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { customizationService, TIER_PERMISSIONS } from '../services/customization-service';
import { logger } from '../logger';

// Validation schemas
const createThresholdOverrideSchema = z.object({
  aiSystemId: z.string().optional(),
  eventType: z.string(),
  controlId: z.string().optional(),
  originalThreshold: z.string().optional(),
  customThreshold: z.string(),
  thresholdUnit: z.string().optional(),
  overrideReason: z.string(),
  effectiveDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  expiresAt: z.string().optional().transform(val => val ? new Date(val) : undefined),
});

const toggleControlSchema = z.object({
  controlId: z.string(),
  enabled: z.boolean(),
  reason: z.string().optional(),
  aiSystemId: z.string().optional(),
});

const createCustomControlSchema = z.object({
  framework: z.string().default('INTERNAL'),
  controlId: z.string(),
  controlName: z.string(),
  description: z.string(),
  mappedEventTypes: z.array(z.string()),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  requiresReporting: z.boolean().default(false),
  reportingDeadlineDays: z.number().optional(),
  detectionLogic: z.string().optional(),
  remediationSteps: z.array(z.any()).optional(),
});

const reviewCustomizationSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reviewNotes: z.string(),
});

export function registerCustomizationRoutes(app: Express) {
  
  /**
   * Get tier permissions for current health system
   */
  app.get("/api/customization/tier-permissions", async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.role !== 'health_system' || !req.user.healthSystemId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const healthSystemId = req.user.healthSystemId;
      
      // Get subscription tier
      const { db } = await import('../db');
      const { healthSystems } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const healthSystem = await db.select()
        .from(healthSystems)
        .where(eq(healthSystems.id, healthSystemId))
        .limit(1);

      if (healthSystem.length === 0) {
        return res.status(404).json({ error: 'Health system not found' });
      }

      const tier = healthSystem[0].subscriptionTier || 'starter';
      const tierKey = tier as keyof typeof TIER_PERMISSIONS;
      const permissions = TIER_PERMISSIONS[tierKey] || TIER_PERMISSIONS.starter;

      res.json({
        tier,
        permissions,
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to get tier permissions');
      res.status(500).json({ error: 'Failed to load tier permissions' });
    }
  });

  /**
   * Get all customizations for health system
   */
  app.get("/api/customization/overview", async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.role !== 'health_system' || !req.user.healthSystemId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const customizations = await customizationService.getCustomizations(req.user.healthSystemId);
      res.json(customizations);
    } catch (error) {
      logger.error({ err: error }, 'Failed to get customizations');
      res.status(500).json({ error: 'Failed to load customizations' });
    }
  });

  /**
   * GROWTH TIER: Create threshold override
   */
  app.post("/api/customization/threshold-override", async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.role !== 'health_system' || !req.user.healthSystemId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const data = createThresholdOverrideSchema.parse(req.body);
      
      const override = await customizationService.createThresholdOverride(
        req.user.healthSystemId,
        data,
        req.user.id
      );

      res.status(201).json(override);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      logger.error({ err: error }, 'Failed to create threshold override');
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create threshold override' });
    }
  });

  /**
   * GROWTH TIER: Toggle control on/off
   */
  app.post("/api/customization/toggle-control", async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.role !== 'health_system' || !req.user.healthSystemId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const data = toggleControlSchema.parse(req.body);
      
      const toggle = await customizationService.toggleControl(
        req.user.healthSystemId,
        data.controlId,
        data.enabled,
        req.user.id,
        data.reason,
        data.aiSystemId
      );

      res.status(201).json(toggle);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      logger.error({ err: error }, 'Failed to toggle control');
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to toggle control' });
    }
  });

  /**
   * ENTERPRISE TIER: Create custom control
   */
  app.post("/api/customization/custom-control", async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.role !== 'health_system' || !req.user.healthSystemId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const data = createCustomControlSchema.parse(req.body);
      
      const customControl = await customizationService.createCustomControl(
        req.user.healthSystemId,
        data,
        req.user.id
      );

      res.status(201).json(customControl);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      logger.error({ err: error }, 'Failed to create custom control');
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create custom control' });
    }
  });

  /**
   * SPECTRAL ADMIN: Get pending approvals
   */
  app.get("/api/customization/approvals/pending", async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.permissions !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin only' });
      }

      const { db } = await import('../db');
      const { customizationApprovals } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const pending = await db.select()
        .from(customizationApprovals)
        .where(eq(customizationApprovals.status, 'pending'));

      res.json(pending);
    } catch (error) {
      logger.error({ err: error }, 'Failed to get pending approvals');
      res.status(500).json({ error: 'Failed to load pending approvals' });
    }
  });

  /**
   * SPECTRAL ADMIN: Review customization
   */
  app.post("/api/customization/approvals/:approvalId/review", async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.permissions !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin only' });
      }

      const { approvalId } = req.params;
      const data = reviewCustomizationSchema.parse(req.body);
      
      await customizationService.reviewCustomization(
        approvalId,
        req.user.id,
        data.decision,
        data.reviewNotes
      );

      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      logger.error({ err: error }, 'Failed to review customization');
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to review customization' });
    }
  });

  /**
   * Get customization audit trail
   */
  app.get("/api/customization/audit", async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.role !== 'health_system' || !req.user.healthSystemId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const audit = await customizationService.getCustomizationAudit(req.user.healthSystemId, limit);
      
      res.json(audit);
    } catch (error) {
      logger.error({ err: error }, 'Failed to get audit trail');
      res.status(500).json({ error: 'Failed to load audit trail' });
    }
  });
}
