import { Router } from 'express';
import { logger } from '../logger';
import { z } from 'zod';
import { db } from '../db';
import { 
  users, 
  healthSystems,
  thresholdOverrides, 
  customComplianceControls,
  customizationApprovals,
  customizationAuditLog,
  auditLogs
} from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { 
  validateThresholdOverride,
  validateCustomControl,
  logGuardrailViolation
} from '../services/regulatory-guardrails';

export const customizationsRouter = Router();

// Middleware: Require authentication and Enterprise tier
async function requireEnterpriseTier(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, req.session.userId),
    with: { healthSystem: true },
  });

  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  // Check if health system has Enterprise tier
  if (user.healthSystem?.subscriptionTier !== 'enterprise') {
    return res.status(403).json({ 
      error: 'Enterprise tier required',
      message: 'Customization features require an Enterprise subscription'
    });
  }

  req.user = user;
  next();
}

// Middleware: Require super_admin role
async function requireSuperAdmin(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, req.session.userId),
  });

  if (!user || user.permissions !== 'admin') {
    return res.status(403).json({ error: 'Administrator privileges required' });
  }

  req.user = user;
  next();
}

// Get all customizations for the authenticated user's tenant
customizationsRouter.get('/', requireEnterpriseTier, async (req: any, res) => {
  try {
    const user = req.user;
    const healthSystemId = user.healthSystemId;

    // Get threshold overrides
    const overrides = await db.query.thresholdOverrides.findMany({
      where: eq(thresholdOverrides.healthSystemId, healthSystemId!),
      orderBy: desc(thresholdOverrides.createdAt),
    });

    // Get custom controls
    const customControls = await db.query.customComplianceControls.findMany({
      where: eq(customComplianceControls.healthSystemId, healthSystemId!),
      orderBy: desc(customComplianceControls.createdAt),
    });

    // Get audit trail
    const auditTrail = await db.query.customizationAuditLog.findMany({
      where: eq(customizationAuditLog.healthSystemId, healthSystemId!),
      orderBy: desc(customizationAuditLog.createdAt),
      limit: 50,
    });

    res.json({
      thresholdOverrides: overrides,
      customControls,
      auditTrail,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch customizations');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pending approval requests (super admin only)
customizationsRouter.get('/pending', requireSuperAdmin, async (req: any, res) => {
  try {
    const pendingApprovals = await db.query.customizationApprovals.findMany({
      where: eq(customizationApprovals.status, 'pending'),
      orderBy: desc(customizationApprovals.createdAt),
      with: {
        requestedBy: true,
        healthSystem: true,
      },
    });

    res.json(pendingApprovals);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch pending approvals');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit threshold override request
customizationsRouter.post('/threshold-override', requireEnterpriseTier, async (req: any, res) => {
  try {
    const user = req.user;
    const healthSystemId = user.healthSystemId!;

    const schema = z.object({
      eventType: z.string(),
      aiSystemId: z.string().optional(),
      newThreshold: z.string(),
      justification: z.string(),
      regulatoryContext: z.string().optional(),
      controlId: z.string().optional(),
    });

    const data = schema.parse(req.body);

    // 🔒 REGULATORY GUARDRAILS: Validate threshold override
    try {
      validateThresholdOverride(data.eventType, data.newThreshold, data.controlId);
    } catch (error) {
      // Log guardrail violation
      logGuardrailViolation(user.id, healthSystemId, 'threshold_override', {
        eventType: data.eventType,
        newThreshold: data.newThreshold,
        controlId: data.controlId,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return res.status(403).json({ 
        error: 'Regulatory guardrail violation',
        message: error instanceof Error ? error.message : 'This customization violates mandatory regulatory requirements'
      });
    }

    // Create the threshold override (pending approval)
    const [override] = await db.insert(thresholdOverrides).values({
      healthSystemId,
      aiSystemId: data.aiSystemId || null,
      eventType: data.eventType,
      customThreshold: data.newThreshold,
      overrideReason: data.justification,
      active: false, // Not active until approved
    }).returning();

    // Create approval request
    await db.insert(customizationApprovals).values({
      healthSystemId,
      customizationType: 'threshold_override',
      customizationId: override.id,
      requestedBy: user.id,
      requestJustification: data.justification,
      regulatoryContext: data.regulatoryContext,
      status: 'pending',
      slaDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 business days
    });

    // Audit log
    await db.insert(customizationAuditLog).values({
      healthSystemId,
      customizationType: 'threshold_override',
      customizationId: override.id,
      action: 'created',
      changedBy: user.id,
      changeReason: data.justification,
      approvalRequired: true,
      approvalStatus: 'pending',
    });

    // General audit log
    await db.insert(auditLogs).values({
      userId: user.id,
      action: 'create',
      resourceType: 'threshold_override',
      resourceId: override.id,
      metadata: { eventType: data.eventType, threshold: data.newThreshold },
      healthSystemId,
    });

    logger.info({ userId: user.id, overrideId: override.id }, 'Threshold override request submitted');

    res.status(201).json({ 
      message: 'Threshold override submitted for approval',
      id: override.id 
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to submit threshold override');
    res.status(400).json({ error: 'Invalid request' });
  }
});

// Submit custom control request
customizationsRouter.post('/custom-control', requireEnterpriseTier, async (req: any, res) => {
  try {
    const user = req.user;
    const healthSystemId = user.healthSystemId!;

    const schema = z.object({
      controlId: z.string(),
      controlName: z.string(),
      description: z.string(),
      mappedEventTypes: z.array(z.string()),
      severity: z.enum(['critical', 'high', 'medium', 'low']),
      justification: z.string(),
      regulatoryContext: z.string().optional(),
    });

    const data = schema.parse(req.body);

    // 🔒 REGULATORY GUARDRAILS: Validate custom control
    try {
      validateCustomControl(data.controlId, data.mappedEventTypes);
    } catch (error) {
      // Log guardrail violation
      logGuardrailViolation(user.id, healthSystemId, 'custom_control', {
        controlId: data.controlId,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return res.status(403).json({ 
        error: 'Regulatory guardrail violation',
        message: error instanceof Error ? error.message : 'This customization violates mandatory regulatory requirements'
      });
    }

    // Create custom control (pending review)
    const [control] = await db.insert(customComplianceControls).values({
      healthSystemId,
      controlId: data.controlId,
      controlName: data.controlName,
      description: data.description,
      mappedEventTypes: data.mappedEventTypes,
      severity: data.severity,
      createdBy: user.id,
      status: 'pending_review',
      active: false, // Not active until Spectral approves
    }).returning();

    // Create approval request
    await db.insert(customizationApprovals).values({
      healthSystemId,
      customizationType: 'custom_control',
      customizationId: control.id,
      requestedBy: user.id,
      requestJustification: data.justification,
      regulatoryContext: data.regulatoryContext,
      status: 'pending',
      slaDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 business days
    });

    // Audit log
    await db.insert(customizationAuditLog).values({
      healthSystemId,
      customizationType: 'custom_control',
      customizationId: control.id,
      action: 'created',
      changedBy: user.id,
      changeReason: data.justification,
      approvalRequired: true,
      approvalStatus: 'pending',
    });

    // General audit log
    await db.insert(auditLogs).values({
      userId: user.id,
      action: 'create',
      resourceType: 'custom_control',
      resourceId: control.id,
      metadata: { controlId: data.controlId, controlName: data.controlName },
      healthSystemId,
    });

    logger.info({ userId: user.id, controlId: control.id }, 'Custom control request submitted');

    res.status(201).json({ 
      message: 'Custom control submitted for approval',
      id: control.id 
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to submit custom control');
    res.status(400).json({ error: 'Invalid request' });
  }
});

// Review customization request (admin only)
customizationsRouter.post('/:id/review', requireSuperAdmin, async (req: any, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    
    const schema = z.object({
      action: z.enum(['approve', 'reject']),
      notes: z.string(),
    });

    const data = schema.parse(req.body);

    // Get the approval request
    const approval = await db.query.customizationApprovals.findFirst({
      where: eq(customizationApprovals.id, id),
    });

    if (!approval) {
      return res.status(404).json({ error: 'Approval request not found' });
    }

    // Update approval status
    await db.update(customizationApprovals)
      .set({
        status: data.action === 'approve' ? 'approved' : 'rejected',
        assignedReviewer: user.id,
        reviewCompletedAt: new Date(),
        reviewDecision: data.action === 'approve' ? 'approved' : 'rejected',
        reviewNotes: data.notes,
      })
      .where(eq(customizationApprovals.id, id));

    // If approved, activate the customization
    if (data.action === 'approve') {
      if (approval.customizationType === 'threshold_override') {
        await db.update(thresholdOverrides)
          .set({ 
            active: true,
            approvedBy: user.id,
            approvedAt: new Date(),
          })
          .where(eq(thresholdOverrides.id, approval.customizationId));
      } else if (approval.customizationType === 'custom_control') {
        await db.update(customComplianceControls)
          .set({ 
            active: true,
            status: 'approved',
            reviewedBy: user.id,
            reviewedAt: new Date(),
            reviewNotes: data.notes,
            approvalDate: new Date(),
          })
          .where(eq(customComplianceControls.id, approval.customizationId));
      }
    }

    // Audit log
    await db.insert(customizationAuditLog).values({
      healthSystemId: approval.healthSystemId,
      customizationType: approval.customizationType,
      customizationId: approval.customizationId,
      action: data.action === 'approve' ? 'approved' : 'rejected',
      changedBy: user.id,
      changeReason: data.notes,
      approvalRequired: false,
      approvalStatus: data.action === 'approve' ? 'approved' : 'rejected',
    });

    // General audit log
    await db.insert(auditLogs).values({
      userId: user.id,
      action: 'update',
      resourceType: 'customization_approval',
      resourceId: id,
      metadata: { decision: data.action, notes: data.notes },
      healthSystemId: approval.healthSystemId,
    });

    logger.info({ 
      userId: user.id, 
      approvalId: id, 
      decision: data.action 
    }, 'Customization review completed');

    res.json({ message: `Request ${data.action}d successfully` });
  } catch (error) {
    logger.error({ err: error }, 'Failed to review customization');
    res.status(400).json({ error: 'Invalid request' });
  }
});
