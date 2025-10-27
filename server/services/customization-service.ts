/**
 * 🎯 TIERED CUSTOMIZATION SERVICE
 * 
 * Manages Translation Engine customization based on subscription tier:
 * - Foundation ($75K): Read-only, no customization
 * - Growth ($200K): Threshold tuning, control toggles
 * - Enterprise ($400K): Custom controls, policy extensions
 */

import { db } from '../db';
import { 
  thresholdOverrides,
  customComplianceControls,
  customizationApprovals,
  customizationAuditLog,
  controlToggles,
  healthSystems,
  complianceControls,
  type InsertThresholdOverride,
  type InsertCustomComplianceControl,
  type InsertCustomizationApproval,
  type InsertCustomizationAuditLog,
  type InsertControlToggle,
} from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../logger';

// Tier permissions
export const TIER_PERMISSIONS = {
  starter: {
    canCustomizeThresholds: false,
    canToggleControls: false,
    canCreateCustomControls: false,
    maxCustomControls: 0,
  },
  professional: {
    canCustomizeThresholds: true,
    canToggleControls: true,
    canCreateCustomControls: false,
    maxCustomControls: 0,
  },
  enterprise: {
    canCustomizeThresholds: true,
    canToggleControls: true,
    canCreateCustomControls: true,
    maxCustomControls: 100, // Generous limit
  },
};

export class CustomizationService {
  
  /**
   * Check if health system can perform customization based on tier
   */
  async checkTierPermission(
    healthSystemId: string,
    permission: 'canCustomizeThresholds' | 'canToggleControls' | 'canCreateCustomControls'
  ): Promise<boolean> {
    const healthSystem = await db.select()
      .from(healthSystems)
      .where(eq(healthSystems.id, healthSystemId))
      .limit(1);

    if (healthSystem.length === 0) {
      throw new Error('Health system not found');
    }

    const tier = healthSystem[0].subscriptionTier || 'starter';
    const tierKey = tier as keyof typeof TIER_PERMISSIONS;
    const permissions = TIER_PERMISSIONS[tierKey] || TIER_PERMISSIONS.starter;

    return permissions[permission] as boolean;
  }

  /**
   * GROWTH TIER: Create threshold override
   */
  async createThresholdOverride(
    healthSystemId: string,
    data: Omit<InsertThresholdOverride, 'healthSystemId'>,
    userId: string
  ) {
    // Check permission
    const canCustomize = await this.checkTierPermission(healthSystemId, 'canCustomizeThresholds');
    if (!canCustomize) {
      throw new Error('Threshold customization requires Growth or Enterprise tier');
    }

    // Validate regulatory guardrails
    if (data.controlId) {
      const control = await db.select()
        .from(complianceControls)
        .where(eq(complianceControls.id, data.controlId))
        .limit(1);

      if (control.length > 0 && control[0].framework === 'HIPAA') {
        // HIPAA controls have minimum thresholds
        const minThreshold = this.getMinimumThreshold(control[0].controlId);
        if (parseFloat(data.customThreshold) < minThreshold) {
          throw new Error(`Cannot set threshold below regulatory minimum of ${minThreshold}`);
        }
      }
    }

    // Create override
    const override = await db.insert(thresholdOverrides).values({
      healthSystemId,
      ...data,
      approvedBy: userId,
      approvedAt: new Date(),
    }).returning();

    // Audit log
    await this.logCustomization({
      healthSystemId,
      customizationType: 'threshold_override',
      customizationId: override[0].id,
      action: 'created',
      changedBy: userId,
      changeReason: data.overrideReason,
      newValue: data.customThreshold,
      approvalRequired: false,
      approvalStatus: 'approved',
    });

    logger.info({ 
      healthSystemId, 
      eventType: data.eventType,
      threshold: data.customThreshold 
    }, 'Threshold override created');

    return override[0];
  }

  /**
   * GROWTH TIER: Toggle control on/off
   */
  async toggleControl(
    healthSystemId: string,
    controlId: string,
    enabled: boolean,
    userId: string,
    reason?: string,
    aiSystemId?: string
  ) {
    const canToggle = await this.checkTierPermission(healthSystemId, 'canToggleControls');
    if (!canToggle) {
      throw new Error('Control toggling requires Growth or Enterprise tier');
    }

    // Check if control has regulatory guardrail
    const control = await db.select()
      .from(complianceControls)
      .where(eq(complianceControls.id, controlId))
      .limit(1);

    if (control.length === 0) {
      throw new Error('Control not found');
    }

    const isHIPAA = control[0].framework === 'HIPAA';
    if (isHIPAA && !enabled) {
      throw new Error('HIPAA controls cannot be disabled (regulatory guardrail)');
    }

    // Check if toggle already exists (use IS NULL semantics for nullable aiSystemId)
    const { isNull, or } = await import('drizzle-orm');
    const existing = await db.select()
      .from(controlToggles)
      .where(and(
        eq(controlToggles.healthSystemId, healthSystemId),
        eq(controlToggles.controlId, controlId),
        aiSystemId ? eq(controlToggles.aiSystemId, aiSystemId) : isNull(controlToggles.aiSystemId)
      ))
      .limit(1);

    let toggle;
    if (existing.length > 0) {
      // Update existing
      toggle = await db.update(controlToggles)
        .set({
          enabled,
          disableReason: reason,
          disabledBy: !enabled ? userId : null,
          disabledAt: !enabled ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(controlToggles.id, existing[0].id))
        .returning();
    } else {
      // Create new
      toggle = await db.insert(controlToggles).values({
        healthSystemId,
        aiSystemId: aiSystemId || null,
        controlId,
        enabled,
        disableReason: reason,
        disabledBy: !enabled ? userId : null,
        disabledAt: !enabled ? new Date() : null,
        regulatoryGuardrail: isHIPAA,
      }).returning();
    }

    // Audit log
    await this.logCustomization({
      healthSystemId,
      customizationType: 'control_toggle',
      customizationId: toggle[0].id,
      action: enabled ? 'enabled' : 'disabled',
      changedBy: userId,
      changeReason: reason,
      newValue: enabled.toString(),
      approvalRequired: false,
      approvalStatus: 'approved',
    });

    return toggle[0];
  }

  /**
   * ENTERPRISE TIER: Create custom compliance control
   */
  async createCustomControl(
    healthSystemId: string,
    data: Omit<InsertCustomComplianceControl, 'healthSystemId' | 'createdBy'>,
    userId: string
  ) {
    const canCreate = await this.checkTierPermission(healthSystemId, 'canCreateCustomControls');
    if (!canCreate) {
      throw new Error('Custom control creation requires Enterprise tier');
    }

    // Check if at limit
    const existingCount = await db.select()
      .from(customComplianceControls)
      .where(eq(customComplianceControls.healthSystemId, healthSystemId));

    const limit = TIER_PERMISSIONS.enterprise.maxCustomControls;
    if (existingCount.length >= limit) {
      throw new Error(`Maximum custom controls limit reached (${limit})`);
    }

    // Create custom control (pending review)
    const customControl = await db.insert(customComplianceControls).values({
      healthSystemId,
      createdBy: userId,
      ...data,
      status: 'pending_review',
      active: false, // Only active after Spectral approval
    }).returning();

    // Create approval request
    await this.createApprovalRequest({
      healthSystemId,
      customizationType: 'custom_control',
      customizationId: customControl[0].id,
      requestedBy: userId,
      requestJustification: `Custom control: ${data.controlName}`,
      regulatoryContext: data.description,
      slaDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 business days
    });

    // Audit log
    await this.logCustomization({
      healthSystemId,
      customizationType: 'custom_control',
      customizationId: customControl[0].id,
      action: 'created',
      changedBy: userId,
      approvalRequired: true,
      approvalStatus: 'pending',
    });

    logger.info({
      healthSystemId,
      controlId: data.controlId,
      controlName: data.controlName,
    }, 'Custom control created (pending review)');

    return customControl[0];
  }

  /**
   * Create approval request (Enterprise only)
   */
  async createApprovalRequest(data: InsertCustomizationApproval) {
    return db.insert(customizationApprovals).values(data).returning();
  }

  /**
   * Spectral admin: Approve/reject customization
   */
  async reviewCustomization(
    approvalId: string,
    reviewerId: string,
    decision: 'approved' | 'rejected',
    reviewNotes: string
  ) {
    const approval = await db.select()
      .from(customizationApprovals)
      .where(eq(customizationApprovals.id, approvalId))
      .limit(1);

    if (approval.length === 0) {
      throw new Error('Approval request not found');
    }

    // Update approval
    await db.update(customizationApprovals)
      .set({
        status: decision === 'approved' ? 'approved' : 'rejected',
        assignedReviewer: reviewerId,
        reviewStartedAt: new Date(),
        reviewCompletedAt: new Date(),
        reviewDecision: decision,
        reviewNotes,
        updatedAt: new Date(),
      })
      .where(eq(customizationApprovals.id, approvalId));

    // If approved, activate the customization
    if (decision === 'approved') {
      const customType = approval[0].customizationType;
      const customId = approval[0].customizationId;

      if (customType === 'custom_control') {
        await db.update(customComplianceControls)
          .set({
            status: 'approved',
            active: true,
            reviewedBy: reviewerId,
            reviewedAt: new Date(),
            approvalDate: new Date(),
            effectiveDate: new Date(),
          })
          .where(eq(customComplianceControls.id, customId));
      }
    }

    // Audit log
    await this.logCustomization({
      healthSystemId: approval[0].healthSystemId,
      customizationType: approval[0].customizationType,
      customizationId: approval[0].customizationId,
      action: decision,
      changedBy: reviewerId,
      changeReason: reviewNotes,
      approvalRequired: true,
      approvalStatus: decision,
    });

    logger.info({ approvalId, decision, reviewerId }, 'Customization reviewed');
  }

  /**
   * Get all customizations for a health system
   */
  async getCustomizations(healthSystemId: string) {
    const [thresholds, toggles, customs] = await Promise.all([
      db.select().from(thresholdOverrides).where(eq(thresholdOverrides.healthSystemId, healthSystemId)),
      db.select().from(controlToggles).where(eq(controlToggles.healthSystemId, healthSystemId)),
      db.select().from(customComplianceControls).where(eq(customComplianceControls.healthSystemId, healthSystemId)),
    ]);

    return {
      thresholdOverrides: thresholds,
      controlToggles: toggles,
      customControls: customs,
    };
  }

  /**
   * Get audit trail for customizations
   */
  async getCustomizationAudit(healthSystemId: string, limit: number = 100) {
    return db.select()
      .from(customizationAuditLog)
      .where(eq(customizationAuditLog.healthSystemId, healthSystemId))
      .orderBy(desc(customizationAuditLog.createdAt))
      .limit(limit);
  }

  /**
   * Log customization action
   */
  private async logCustomization(data: InsertCustomizationAuditLog) {
    return db.insert(customizationAuditLog).values(data);
  }

  /**
   * Get minimum threshold for regulatory compliance
   */
  private getMinimumThreshold(controlId: string): number {
    // Regulatory minimums (example - would be comprehensive in production)
    const minimums: Record<string, number> = {
      '164.312(b)': 0, // HIPAA PHI exposure: ZERO tolerance
      '164.308(a)(1)(i)': 0.05, // Risk assessment: 5% minimum
    };

    return minimums[controlId] || 0;
  }
}

export const customizationService = new CustomizationService();
