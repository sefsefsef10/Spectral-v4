/**
 * 🔄 SENTINEL ROLLBACK API ROUTES
 * 
 * Endpoints for rollback policy management and execution:
 * - GET /api/rollback/policies/:aiSystemId - Get rollback policy
 * - POST /api/rollback/policies - Create/update rollback policy
 * - GET /api/rollback/deployment-history/:aiSystemId - Get deployment history
 * - POST /api/rollback/deployments - Record new deployment
 * - POST /api/rollback/execute - Execute rollback (manual)
 * - GET /api/rollback/history/:aiSystemId - Get rollback execution history
 * - POST /api/rollback/approve/:rollbackId - Approve pending rollback
 */

import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { rollbackService } from '../services/rollback-service';
import { logger } from '../logger';
import { storage } from '../storage';

// Validation schemas
const rollbackPolicySchema = z.object({
  aiSystemId: z.string(),
  healthSystemId: z.string(),
  enabled: z.boolean().default(false),
  autoRollbackOnCritical: z.boolean().default(false),
  requiresApproval: z.boolean().default(true),
  approvers: z.array(z.string()).optional(),
  rollbackTriggers: z.array(z.object({
    violationType: z.string(),
    severity: z.enum(['critical', 'high', 'medium', 'low', '*']),
  })).optional(),
  maxAutoRollbacks: z.number().default(3),
  cooldownMinutes: z.number().default(60),
  notificationChannels: z.array(z.string()).default(['email', 'slack']),
});

const deploymentSchema = z.object({
  aiSystemId: z.string(),
  version: z.string(),
  deployedAt: z.string().transform(val => new Date(val)),
  deployedBy: z.string().optional(),
  deploymentType: z.enum(['initial', 'update', 'rollback', 'hotfix']),
  rollbackFromVersion: z.string().optional(),
  metadata: z.any().optional(),
  notes: z.string().optional(),
});

const executeRollbackSchema = z.object({
  aiSystemId: z.string(),
  targetVersion: z.string().optional(),
  reason: z.string(),
});

const approveRollbackSchema = z.object({
  approverNotes: z.string().optional(),
});

// Helper to get user and verify they're a health system user
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

// Helper to get any authenticated user (for approval workflow)
async function getAuthenticatedUser(req: Request, res: Response) {
  if (!req.session.userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }

  const user = await storage.getUser(req.session.userId);
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return null;
  }

  return user;
}

export function registerRollbackRoutes(app: Express) {
  
  /**
   * Get rollback policy for an AI system
   */
  app.get("/api/rollback/policies/:aiSystemId", async (req: Request, res: Response) => {
    try {
      const user = await getHealthSystemUser(req, res);
      if (!user) return;

      const { aiSystemId } = req.params;
      const policy = await rollbackService.getRollbackPolicy(aiSystemId, user.healthSystemId!);

      if (!policy) {
        return res.status(404).json({ error: 'Rollback policy not found' });
      }

      res.json(policy);
    } catch (error) {
      logger.error({ err: error }, 'Failed to get rollback policy');
      res.status(500).json({ error: 'Failed to get rollback policy' });
    }
  });

  /**
   * Create or update rollback policy
   */
  app.post("/api/rollback/policies", async (req: Request, res: Response) => {
    try {
      const user = await getHealthSystemUser(req, res);
      if (!user) return;

      const data = rollbackPolicySchema.parse(req.body);

      // Verify AI system belongs to health system
      const aiSystem = await storage.getAISystem(data.aiSystemId);
      if (!aiSystem || aiSystem.healthSystemId !== user.healthSystemId) {
        return res.status(403).json({ error: 'AI system not found or access denied' });
      }

      const policy = await rollbackService.upsertRollbackPolicy(data);
      res.json(policy);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      logger.error({ err: error }, 'Failed to create/update rollback policy');
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save rollback policy' });
    }
  });

  /**
   * Get deployment history for an AI system
   */
  app.get("/api/rollback/deployment-history/:aiSystemId", async (req: Request, res: Response) => {
    try {
      const user = await getHealthSystemUser(req, res);
      if (!user) return;

      const { aiSystemId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;

      // Verify AI system belongs to health system
      const aiSystem = await storage.getAISystem(aiSystemId);
      if (!aiSystem || aiSystem.healthSystemId !== user.healthSystemId) {
        return res.status(403).json({ error: 'AI system not found or access denied' });
      }

      const history = await rollbackService.getDeploymentHistory(aiSystemId, limit);
      res.json(history);
    } catch (error) {
      logger.error({ err: error }, 'Failed to get deployment history');
      res.status(500).json({ error: 'Failed to get deployment history' });
    }
  });

  /**
   * Record new deployment (for health systems to track their deployments)
   */
  app.post("/api/rollback/deployments", async (req: Request, res: Response) => {
    try {
      const user = await getHealthSystemUser(req, res);
      if (!user) return;

      const data = deploymentSchema.parse(req.body);

      // Verify AI system belongs to health system
      const aiSystem = await storage.getAISystem(data.aiSystemId);
      if (!aiSystem || aiSystem.healthSystemId !== user.healthSystemId) {
        return res.status(403).json({ error: 'AI system not found or access denied' });
      }

      // Default deployedBy to current user if not provided
      if (!data.deployedBy) {
        data.deployedBy = user.id;
      }

      const deployment = await rollbackService.recordDeployment(data);
      res.status(201).json(deployment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      logger.error({ err: error }, 'Failed to record deployment');
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to record deployment' });
    }
  });

  /**
   * Execute manual rollback (honors approval workflow)
   */
  app.post("/api/rollback/execute", async (req: Request, res: Response) => {
    try {
      const user = await getHealthSystemUser(req, res);
      if (!user) return;

      const data = executeRollbackSchema.parse(req.body);

      // Verify AI system belongs to health system
      const aiSystem = await storage.getAISystem(data.aiSystemId);
      if (!aiSystem || aiSystem.healthSystemId !== user.healthSystemId) {
        return res.status(403).json({ error: 'AI system not found or access denied' });
      }

      // Check rollback policy approval requirements
      const policy = await rollbackService.getRollbackPolicy(data.aiSystemId, user.healthSystemId!);
      
      if (policy && policy.requiresApproval) {
        // Create pending rollback for approval
        const pendingRollback = await rollbackService.createPendingRollback(
          data.aiSystemId,
          'manual',
          {
            triggeredBy: user.id,
            targetVersion: data.targetVersion,
            reason: data.reason,
          }
        );

        return res.status(202).json({
          ...pendingRollback,
          message: 'Rollback created and pending approval',
          requiresApproval: true,
          approvers: policy.approvers,
        });
      } else {
        // No approval required, execute immediately
        const rollback = await rollbackService.executeRollback(
          data.aiSystemId,
          'manual',
          {
            triggeredBy: user.id,
            targetVersion: data.targetVersion,
            reason: data.reason,
          }
        );

        res.status(201).json(rollback);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      logger.error({ err: error }, 'Failed to execute rollback');
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to execute rollback' });
    }
  });

  /**
   * Get rollback execution history
   */
  app.get("/api/rollback/history/:aiSystemId", async (req: Request, res: Response) => {
    try {
      const user = await getHealthSystemUser(req, res);
      if (!user) return;

      const { aiSystemId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;

      // Verify AI system belongs to health system
      const aiSystem = await storage.getAISystem(aiSystemId);
      if (!aiSystem || aiSystem.healthSystemId !== user.healthSystemId) {
        return res.status(403).json({ error: 'AI system not found or access denied' });
      }

      const history = await rollbackService.getRollbackHistory(aiSystemId, limit);
      res.json(history);
    } catch (error) {
      logger.error({ err: error }, 'Failed to get rollback history');
      res.status(500).json({ error: 'Failed to get rollback history' });
    }
  });

  /**
   * Approve pending rollback (allows configured approver roles)
   */
  app.post("/api/rollback/approve/:rollbackId", async (req: Request, res: Response) => {
    try {
      const user = await getAuthenticatedUser(req, res);
      if (!user) return;

      const { rollbackId } = req.params;
      approveRollbackSchema.parse(req.body);

      const rollback = await rollbackService.approveRollback(rollbackId, user.id);
      res.json(rollback);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      
      // Map authorization errors to 403
      if (error instanceof Error) {
        if (error.message.includes('Unauthorized') || error.message.includes('can approve rollbacks')) {
          return res.status(403).json({ error: error.message });
        }
        if (error.message.includes('not found') && error.message.includes('Rollback')) {
          return res.status(404).json({ error: error.message });
        }
      }
      
      logger.error({ err: error }, 'Failed to approve rollback');
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to approve rollback' });
    }
  });
}
