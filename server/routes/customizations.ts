import { Router } from 'express';
import { logger } from '../logger';
import { z } from 'zod';

export const customizationsRouter = Router();

// Get all customizations for the authenticated user's tenant
customizationsRouter.get('/', async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Mock data for now - would query actual customizationRequests table
    const customizations = {
      thresholdOverrides: [],
      controlToggles: [],
      customControls: [],
      auditTrail: [],
    };

    res.json(customizations);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch customizations');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pending approval requests (super admin only)
customizationsRouter.get('/pending', async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is super_admin
    // Would query users table for role
    
    // Mock data for now
    res.json([]);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch pending approvals');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit threshold override request
customizationsRouter.post('/threshold-override', async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const schema = z.object({
      eventType: z.string(),
      newThreshold: z.string(),
      justification: z.string(),
      evidenceUrl: z.string().optional(),
    });

    const data = schema.parse(req.body);

    // Would insert into customizationRequests table
    logger.info({ userId: req.session.userId, data }, 'Threshold override request submitted');

    res.status(201).json({ message: 'Request submitted for approval' });
  } catch (error) {
    logger.error({ err: error }, 'Failed to submit threshold override');
    res.status(400).json({ error: 'Invalid request' });
  }
});

// Submit custom control request
customizationsRouter.post('/custom-control', async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const schema = z.object({
      controlName: z.string(),
      description: z.string(),
      triggerEventType: z.string(),
      severity: z.string(),
      justification: z.string(),
    });

    const data = schema.parse(req.body);

    logger.info({ userId: req.session.userId, data }, 'Custom control request submitted');

    res.status(201).json({ message: 'Custom control request submitted' });
  } catch (error) {
    logger.error({ err: error }, 'Failed to submit custom control');
    res.status(400).json({ error: 'Invalid request' });
  }
});

// Review customization request (admin only)
customizationsRouter.post('/:id/review', async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const schema = z.object({
      action: z.enum(['approve', 'reject']),
      notes: z.string(),
    });

    const data = schema.parse(req.body);

    logger.info({ userId: req.session.userId, requestId: id, data }, 'Customization review completed');

    res.json({ message: `Request ${data.action}d successfully` });
  } catch (error) {
    logger.error({ err: error }, 'Failed to review customization');
    res.status(400).json({ error: 'Invalid request' });
  }
});
