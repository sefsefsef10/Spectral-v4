/**
 * Telemetry Polling API Routes
 * 
 * Manages telemetry polling configuration for AI systems
 * Supports LangSmith, Arize, LangFuse, and Weights & Biases platforms
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../routes';
import { telemetryPoller } from '../services/telemetry-poller';
import { storage } from '../storage';
import { logger } from '../logger';
import { z } from 'zod';

const router = Router();

// Validation schema for polling config
const pollingConfigSchema = z.object({
  platform: z.enum(['langsmith', 'arize', 'langfuse', 'wandb']),
  projectName: z.string().min(1).max(255),
  pollIntervalMinutes: z.number().int().min(5).max(1440).default(15),
  lookbackMinutes: z.number().int().min(1).max(1440).default(15),
  enabled: z.boolean().default(true),
});

/**
 * Register or update telemetry polling for an AI system
 * POST /api/telemetry-polling/:aiSystemId
 */
router.post('/:aiSystemId', requireAuth, requireRole('health_system'), async (req, res) => {
  try {
    const { aiSystemId } = req.params;
    const healthSystemId = req.user!.healthSystemId;

    if (!healthSystemId) {
      return res.status(403).json({ error: 'Not authorized - health system access required' });
    }

    // Validate AI system exists and belongs to this health system
    const aiSystem = await storage.getAISystem(aiSystemId);
    
    if (!aiSystem || aiSystem.healthSystemId !== healthSystemId) {
      return res.status(404).json({ error: 'AI system not found' });
    }

    // Validate request body
    const result = pollingConfigSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Invalid request body',
        details: result.error.errors,
      });
    }

    // Register or update polling config
    const config = await telemetryPoller.registerAISystem({
      aiSystemId,
      ...result.data,
    });

    logger.info({
      aiSystemId,
      platform: config.platform,
      healthSystemId,
      userId: req.user!.id,
    }, 'Registered AI system for telemetry polling');

    res.json(config);
  } catch (error) {
    logger.error({ err: error }, 'Failed to register polling config');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get polling configuration for an AI system
 * GET /api/telemetry-polling/:aiSystemId
 */
router.get('/:aiSystemId', requireAuth, requireRole('health_system'), async (req, res) => {
  try {
    const { aiSystemId } = req.params;
    const healthSystemId = req.user!.healthSystemId;

    if (!healthSystemId) {
      return res.status(403).json({ error: 'Not authorized - health system access required' });
    }

    // Validate AI system belongs to this health system
    const aiSystem = await storage.getAISystem(aiSystemId);
    
    if (!aiSystem || aiSystem.healthSystemId !== healthSystemId) {
      return res.status(404).json({ error: 'AI system not found' });
    }

    const config = await telemetryPoller.getPollingConfig(aiSystemId);

    if (!config) {
      return res.status(404).json({ error: 'Polling not configured for this AI system' });
    }

    res.json(config);
  } catch (error) {
    logger.error({ err: error }, 'Failed to get polling config');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get all polling configurations for health system
 * GET /api/telemetry-polling
 */
router.get('/', requireAuth, requireRole('health_system'), async (req, res) => {
  try {
    const healthSystemId = req.user!.healthSystemId;

    if (!healthSystemId) {
      return res.status(403).json({ error: 'Not authorized - health system access required' });
    }

    // Get all AI systems for this health system
    const aiSystems = await storage.getAISystemsByHealthSystem(healthSystemId);
    const aiSystemIds = aiSystems.map(sys => sys.id);

    // Get all polling configs
    const allConfigs = await telemetryPoller.getAllConfigs();
    
    // Filter to only this health system's AI systems
    const configs = allConfigs.filter(config => 
      aiSystemIds.includes(config.aiSystemId)
    );

    res.json({ 
      total: configs.length,
      configs,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get polling configs');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Delete polling configuration
 * DELETE /api/telemetry-polling/:aiSystemId
 */
router.delete('/:aiSystemId', requireAuth, requireRole('health_system'), async (req, res) => {
  try {
    const { aiSystemId } = req.params;
    const healthSystemId = req.user!.healthSystemId;

    if (!healthSystemId) {
      return res.status(403).json({ error: 'Not authorized - health system access required' });
    }

    // Validate AI system belongs to this health system
    const aiSystem = await storage.getAISystem(aiSystemId);
    
    if (!aiSystem || aiSystem.healthSystemId !== healthSystemId) {
      return res.status(404).json({ error: 'AI system not found' });
    }

    await telemetryPoller.unregisterAISystem(aiSystemId);

    logger.info({
      aiSystemId,
      healthSystemId,
      userId: req.user!.id,
    }, 'Unregistered AI system from telemetry polling');

    res.json({ message: 'Polling configuration deleted successfully' });
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete polling config');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Manually trigger polling for an AI system
 * POST /api/telemetry-polling/:aiSystemId/poll
 */
router.post('/:aiSystemId/poll', requireAuth, requireRole('health_system'), async (req, res) => {
  try {
    const { aiSystemId } = req.params;
    const healthSystemId = req.user!.healthSystemId;

    if (!healthSystemId) {
      return res.status(403).json({ error: 'Not authorized - health system access required' });
    }

    // Validate AI system belongs to this health system
    const aiSystem = await storage.getAISystem(aiSystemId);
    
    if (!aiSystem || aiSystem.healthSystemId !== healthSystemId) {
      return res.status(404).json({ error: 'AI system not found' });
    }

    // Trigger immediate poll
    const result = await telemetryPoller.pollSystem(aiSystemId);

    logger.info({
      aiSystemId,
      platform: result.platform,
      success: result.success,
      eventsIngested: result.eventsIngested,
      healthSystemId,
      userId: req.user!.id,
    }, 'Manual telemetry poll triggered');

    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Failed to trigger manual poll');
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
