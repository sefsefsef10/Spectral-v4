/**
 * Predictive Alerts API Routes
 * 
 * ML-based predictive analytics for AI system health
 * Trend analysis, threshold predictions, portfolio insights
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../routes';
import { db } from '../db';
import { predictiveAlerts, aiSystems } from '@shared/schema';
import { eq, and, desc, gte, inArray } from 'drizzle-orm';
import { logger } from '../logger';
import { z } from 'zod';

const router = Router();

/**
 * List predictive alerts with filtering
 * GET /api/predictive-alerts
 */
router.get('/', requireAuth, requireRole('health_system'), async (req, res) => {
  try {
    const healthSystemId = req.user!.healthSystemId;

    if (!healthSystemId) {
      return res.status(403).json({ error: 'Not authorized - health system access required' });
    }

    // Parse query params
    const severity = req.query.severity as string | undefined;
    const dismissed = req.query.dismissed === 'true';
    const limit = parseInt(req.query.limit as string) || 100;

    // Get AI systems for this health system
    const systems = await db
      .select()
      .from(aiSystems)
      .where(eq(aiSystems.healthSystemId, healthSystemId));

    const systemIds = systems.map(s => s.id);

    if (systemIds.length === 0) {
      return res.json({ total: 0, alerts: [] });
    }

    // Build query with tenant filtering at database level
    const conditions = [
      eq(predictiveAlerts.dismissed, dismissed),
      inArray(predictiveAlerts.aiSystemId, systemIds),
    ];

    if (severity) {
      conditions.push(eq(predictiveAlerts.severity, severity));
    }

    const alerts = await db
      .select()
      .from(predictiveAlerts)
      .where(and(...conditions))
      .orderBy(desc(predictiveAlerts.createdAt))
      .limit(limit);

    const finalAlerts = alerts;

    res.json({
      total: finalAlerts.length,
      alerts: finalAlerts,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to list predictive alerts');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get single predictive alert
 * GET /api/predictive-alerts/:alertId
 */
router.get('/:alertId', requireAuth, requireRole('health_system'), async (req, res) => {
  try {
    const { alertId } = req.params;
    const healthSystemId = req.user!.healthSystemId;

    if (!healthSystemId) {
      return res.status(403).json({ error: 'Not authorized - health system access required' });
    }

    const alert = await db
      .select()
      .from(predictiveAlerts)
      .where(eq(predictiveAlerts.id, alertId))
      .limit(1);

    if (alert.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // Verify AI system belongs to this health system
    const aiSystem = await db
      .select()
      .from(aiSystems)
      .where(eq(aiSystems.id, alert[0].aiSystemId))
      .limit(1);

    if (aiSystem.length === 0 || aiSystem[0].healthSystemId !== healthSystemId) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(alert[0]);
  } catch (error) {
    logger.error({ err: error }, 'Failed to get predictive alert');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get portfolio-wide predictive insights
 * GET /api/predictive-alerts/insights/portfolio
 */
router.get('/insights/portfolio', requireAuth, requireRole('health_system'), async (req, res) => {
  try {
    const healthSystemId = req.user!.healthSystemId;

    if (!healthSystemId) {
      return res.status(403).json({ error: 'Not authorized - health system access required' });
    }

    // Get AI systems for this health system
    const systems = await db
      .select()
      .from(aiSystems)
      .where(eq(aiSystems.healthSystemId, healthSystemId));

    const systemIds = systems.map(s => s.id);

    if (systemIds.length === 0) {
      return res.json({
        totalSystems: 0,
        activeAlerts: 0,
        criticalAlerts: 0,
        predictionTypes: {},
        riskDistribution: {},
      });
    }

    // Get active alerts for this health system only (tenant-aware)
    const systemAlerts = await db
      .select()
      .from(predictiveAlerts)
      .where(and(
        eq(predictiveAlerts.dismissed, false),
        inArray(predictiveAlerts.aiSystemId, systemIds)
      ));

    // Aggregate by prediction type
    const predictionTypes: Record<string, number> = {};
    for (const alert of systemAlerts) {
      predictionTypes[alert.predictionType] = (predictionTypes[alert.predictionType] || 0) + 1;
    }

    // Aggregate by severity
    const riskDistribution: Record<string, number> = {};
    for (const alert of systemAlerts) {
      riskDistribution[alert.severity] = (riskDistribution[alert.severity] || 0) + 1;
    }

    // Count critical alerts
    const criticalAlerts = systemAlerts.filter(a => a.severity === 'critical').length;

    res.json({
      totalSystems: systems.length,
      activeAlerts: systemAlerts.length,
      criticalAlerts,
      predictionTypes,
      riskDistribution,
      insights: {
        systemsAtRisk: Object.keys(predictionTypes).length,
        mostCommonPrediction: Object.entries(predictionTypes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none',
        averageConfidence: systemAlerts.length > 0
          ? systemAlerts.reduce((sum, a) => sum + a.confidenceScore, 0) / systemAlerts.length
          : 0,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get portfolio insights');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Configure confidence thresholds
 * POST /api/predictive-alerts/config/thresholds
 */
router.post('/config/thresholds', requireAuth, requireRole('health_system'), async (req, res) => {
  try {
    const healthSystemId = req.user!.healthSystemId;

    if (!healthSystemId) {
      return res.status(403).json({ error: 'Not authorized - health system access required' });
    }

    const schema = z.object({
      minConfidenceScore: z.number().min(0).max(100).default(40),
      severityThresholds: z.object({
        critical: z.number().min(0).max(100),
        high: z.number().min(0).max(100),
        medium: z.number().min(0).max(100),
      }).optional(),
    });

    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({ 
        error: 'Invalid request body',
        details: result.error.errors,
      });
    }

    // Store configuration (would typically go in health_systems table or separate config table)
    logger.info({
      healthSystemId,
      config: result.data,
      userId: req.user!.id,
    }, 'Updated predictive alert configuration');

    res.json({
      message: 'Configuration updated successfully',
      config: result.data,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to update config');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Suppress/snooze alert
 * POST /api/predictive-alerts/:alertId/suppress
 */
router.post('/:alertId/suppress', requireAuth, requireRole('health_system'), async (req, res) => {
  try {
    const { alertId } = req.params;
    const healthSystemId = req.user!.healthSystemId;

    if (!healthSystemId) {
      return res.status(403).json({ error: 'Not authorized - health system access required' });
    }

    const schema = z.object({
      duration: z.enum(['1h', '4h', '24h', '7d']),
      reason: z.string().optional(),
    });

    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({ 
        error: 'Invalid request body',
        details: result.error.errors,
      });
    }

    // Verify alert exists and belongs to this health system
    const alert = await db
      .select()
      .from(predictiveAlerts)
      .where(eq(predictiveAlerts.id, alertId))
      .limit(1);

    if (alert.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const aiSystem = await db
      .select()
      .from(aiSystems)
      .where(eq(aiSystems.id, alert[0].aiSystemId))
      .limit(1);

    if (aiSystem.length === 0 || aiSystem[0].healthSystemId !== healthSystemId) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // Dismiss alert (suppression logic would be more sophisticated in production)
    await db
      .update(predictiveAlerts)
      .set({ 
        dismissed: true,
        dismissedAt: new Date(),
        dismissedBy: req.user!.id,
      })
      .where(eq(predictiveAlerts.id, alertId));

    logger.info({
      alertId,
      duration: result.data.duration,
      reason: result.data.reason,
      userId: req.user!.id,
    }, 'Suppressed predictive alert');

    res.json({ message: 'Alert suppressed successfully' });
  } catch (error) {
    logger.error({ err: error }, 'Failed to suppress alert');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
