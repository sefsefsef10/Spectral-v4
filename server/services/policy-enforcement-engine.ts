/**
 * 🔒 POLICY ENFORCEMENT ENGINE - Phase 4 Business Model
 * 
 * Real-time governance policy evaluation and enforcement
 * Enables automated compliance policy management
 */

import { db } from "../db";
import {
  policyRules,
  policyEnforcementLogs,
  aiSystems,
  healthSystems,
  monitoringAlerts,
} from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../logger";

export interface PolicyRuleConfig {
  healthSystemId: string;
  policyName: string;
  policyType: 'approval_required' | 'prohibited' | 'restricted' | 'monitored';
  scope: 'all_ai' | 'department' | 'category' | 'vendor';
  scopeFilter?: {
    departments?: string[];
    categories?: string[];
    vendorIds?: string[];
    riskLevels?: string[];
  };
  conditions?: {
    minRiskScore?: number;
    maxRiskScore?: number;
    requiresCertification?: boolean;
    requiredFrameworks?: string[];
  };
  enforcementActions: {
    blockDeployment?: boolean;
    requireApproval?: boolean;
    sendAlert?: boolean;
    restrictAccess?: boolean;
    escalateToAdmin?: boolean;
  };
  approvalWorkflow?: {
    approvers: string[]; // User IDs
    requireAllApprovals?: boolean;
    escalationTimeout?: number; // Hours
  };
  createdBy: string;
}

export interface PolicyRule {
  id: string;
  healthSystemId: string;
  policyName: string;
  policyType: string;
  scope: string;
  scopeFilter?: any;
  conditions?: any;
  enforcementActions: any;
  approvalWorkflow?: any;
  active: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyViolation {
  id: string;
  policyId: string;
  aiSystemId: string;
  violationType: string;
  actionTaken: string;
  details: any;
  resolvedBy?: string | null;
  resolvedAt?: Date | null;
  createdAt: Date;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  violations: Array<{
    policyId: string;
    policyName: string;
    violationType: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    actionRequired: string;
  }>;
  requiresApproval: boolean;
  approvers?: string[];
}

export class PolicyEnforcementEngine {
  /**
   * Create a new policy rule
   */
  async createPolicy(config: PolicyRuleConfig): Promise<PolicyRule> {
    logger.info({
      healthSystemId: config.healthSystemId,
      policyName: config.policyName,
      policyType: config.policyType,
    }, "Creating policy rule");

    const created = await db
      .insert(policyRules)
      .values({
        healthSystemId: config.healthSystemId,
        policyName: config.policyName,
        policyType: config.policyType,
        scope: config.scope,
        scopeFilter: config.scopeFilter ? JSON.stringify(config.scopeFilter) : null,
        conditions: config.conditions ? JSON.stringify(config.conditions) : null,
        enforcementActions: JSON.stringify(config.enforcementActions),
        approvalWorkflow: config.approvalWorkflow ? JSON.stringify(config.approvalWorkflow) : null,
        active: true,
        createdBy: config.createdBy,
      })
      .returning();

    logger.info({
      policyId: created[0].id,
      policyName: config.policyName,
    }, "Policy rule created");

    return this.formatPolicyRule(created[0]);
  }

  /**
   * Evaluate if an AI system complies with all active policies
   */
  async evaluateAISystem(
    aiSystemId: string,
    action: 'deployment' | 'modification' | 'access' | 'monitoring'
  ): Promise<PolicyEvaluationResult> {
    logger.info({
      aiSystemId,
      action,
    }, "Evaluating AI system against policies");

    // Get AI system details
    const aiSystem = await db
      .select()
      .from(aiSystems)
      .where(eq(aiSystems.id, aiSystemId))
      .limit(1);

    if (aiSystem.length === 0) {
      throw new Error("AI system not found");
    }

    const system = aiSystem[0];

    // Get all active policies for this health system
    const policies = await db
      .select()
      .from(policyRules)
      .where(
        and(
          eq(policyRules.healthSystemId, system.healthSystemId),
          eq(policyRules.active, true)
        )
      );

    const violations: PolicyEvaluationResult['violations'] = [];
    let requiresApproval = false;
    let approvers: string[] = [];

    // Evaluate each policy
    for (const policy of policies) {
      const applicable = this.isPolicyApplicable(system, policy);

      if (!applicable) {
        continue;
      }

      // Check conditions
      const conditionsRaw = policy.conditions;
      const conditions = typeof conditionsRaw === 'string'
        ? JSON.parse(conditionsRaw)
        : (conditionsRaw || {});

      const enforcementActionsRaw = policy.enforcementActions;
      const enforcementActions = typeof enforcementActionsRaw === 'string'
        ? JSON.parse(enforcementActionsRaw)
        : (enforcementActionsRaw || {});

      let violated = false;
      let violationType = '';

      // Check risk level (using predefined levels: low, medium, high, critical)
      const riskLevelValues: Record<string, number> = {
        'low': 1,
        'medium': 2,
        'high': 3,
        'critical': 4,
      };

      if (conditions.minRiskScore !== undefined) {
        const riskValue = riskLevelValues[system.riskLevel] || 0;
        if (riskValue < conditions.minRiskScore) {
          violated = true;
          violationType = 'risk_level_too_low';
        }
      }

      if (conditions.maxRiskScore !== undefined) {
        const riskValue = riskLevelValues[system.riskLevel] || 0;
        if (riskValue > conditions.maxRiskScore) {
          violated = true;
          violationType = 'risk_level_too_high';
        }
      }

      // Check certification requirement (vendor must have certifications)
      // Note: This is a simplified check - in production would query complianceCertifications table
      if (conditions.requiresCertification && !system.vendorId) {
        violated = true;
        violationType = 'certification_required';
      }

      // Check prohibited AI
      if (policy.policyType === 'prohibited') {
        violated = true;
        violationType = 'prohibited_ai_system';
      }

      // Handle violations
      if (violated || policy.policyType === 'approval_required') {
        const severity = this.calculateViolationSeverity(policy.policyType);

        if (policy.policyType === 'approval_required' || enforcementActions.requireApproval) {
          requiresApproval = true;

          // Get approvers from workflow
          const workflowRaw = policy.approvalWorkflow;
          const workflow = typeof workflowRaw === 'string'
            ? JSON.parse(workflowRaw)
            : (workflowRaw || {});

          if (workflow.approvers) {
            approvers = [...approvers, ...workflow.approvers];
          }
        }

        if (violated) {
          violations.push({
            policyId: policy.id,
            policyName: policy.policyName,
            violationType,
            severity,
            actionRequired: this.getRequiredAction(enforcementActions),
          });

          // Log violation
          await this.logViolation({
            policyId: policy.id,
            aiSystemId,
            violationType,
            actionTaken: this.getRequiredAction(enforcementActions),
            details: {
              policyName: policy.policyName,
              policyType: policy.policyType,
              systemName: system.name,
              action,
            },
          });

          // Execute enforcement actions
          await this.executeEnforcementActions(
            policy,
            system,
            enforcementActions,
            violationType
          );
        }
      }
    }

    const allowed = violations.length === 0 && !requiresApproval;

    logger.info({
      aiSystemId,
      allowed,
      violationsCount: violations.length,
      requiresApproval,
    }, "Policy evaluation complete");

    return {
      allowed,
      violations,
      requiresApproval,
      approvers: requiresApproval ? Array.from(new Set(approvers)) : undefined,
    };
  }

  /**
   * Check if a policy applies to a given AI system
   */
  private isPolicyApplicable(system: any, policy: any): boolean {
    // Check scope
    if (policy.scope === 'all_ai') {
      return true;
    }

    const scopeFilterRaw = policy.scopeFilter;
    const scopeFilter = typeof scopeFilterRaw === 'string'
      ? JSON.parse(scopeFilterRaw)
      : (scopeFilterRaw || {});

    // Department scope
    if (policy.scope === 'department' && scopeFilter.departments) {
      if (!scopeFilter.departments.includes(system.department)) {
        return false;
      }
    }

    // Category scope
    if (policy.scope === 'category' && scopeFilter.categories) {
      if (!scopeFilter.categories.includes(system.category)) {
        return false;
      }
    }

    // Vendor scope
    if (policy.scope === 'vendor' && scopeFilter.vendorIds) {
      if (!scopeFilter.vendorIds.includes(system.vendorId)) {
        return false;
      }
    }

    // Risk level scope
    if (scopeFilter.riskLevels) {
      if (!scopeFilter.riskLevels.includes(system.riskLevel)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate violation severity
   */
  private calculateViolationSeverity(policyType: string): 'critical' | 'high' | 'medium' | 'low' {
    switch (policyType) {
      case 'prohibited':
        return 'critical';
      case 'approval_required':
        return 'high';
      case 'restricted':
        return 'medium';
      case 'monitored':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Get required action from enforcement actions
   */
  private getRequiredAction(enforcementActions: any): string {
    if (enforcementActions.blockDeployment) return 'deployment_blocked';
    if (enforcementActions.requireApproval) return 'approval_required';
    if (enforcementActions.restrictAccess) return 'access_restricted';
    if (enforcementActions.sendAlert) return 'alert_sent';
    if (enforcementActions.escalateToAdmin) return 'escalated_to_admin';
    return 'flagged_for_review';
  }

  /**
   * Execute enforcement actions
   */
  private async executeEnforcementActions(
    policy: any,
    system: any,
    enforcementActions: any,
    violationType: string
  ): Promise<void> {
    // Send alert if required
    if (enforcementActions.sendAlert || enforcementActions.escalateToAdmin) {
      await db.insert(monitoringAlerts).values({
        aiSystemId: system.id,
        type: 'policy_violation',
        severity: this.calculateViolationSeverity(policy.policyType),
        message: `Policy Violation: ${policy.policyName} - AI system "${system.name}" violated policy (${violationType})`,
        resolved: false,
      });

      logger.info({
        policyId: policy.id,
        aiSystemId: system.id,
        violationType,
      }, "Policy violation alert created");
    }

    // TODO: Implement other enforcement actions:
    // - blockDeployment: Update deployment status
    // - restrictAccess: Update access controls
    // - escalateToAdmin: Send notifications to admins
  }

  /**
   * Log policy violation
   */
  private async logViolation(violation: {
    policyId: string;
    aiSystemId: string;
    violationType: string;
    actionTaken: string;
    details: any;
  }): Promise<PolicyViolation> {
    const created = await db
      .insert(policyEnforcementLogs)
      .values({
        policyId: violation.policyId,
        aiSystemId: violation.aiSystemId,
        violationType: violation.violationType,
        actionTaken: violation.actionTaken,
        details: JSON.stringify(violation.details),
      })
      .returning();

    return {
      id: created[0].id,
      policyId: created[0].policyId,
      aiSystemId: created[0].aiSystemId,
      violationType: created[0].violationType,
      actionTaken: created[0].actionTaken,
      details: typeof created[0].details === 'string'
        ? JSON.parse(created[0].details)
        : created[0].details,
      resolvedBy: created[0].resolvedBy,
      resolvedAt: created[0].resolvedAt,
      createdAt: created[0].createdAt,
    };
  }

  /**
   * Get all policies for a health system
   */
  async getPolicies(healthSystemId: string): Promise<PolicyRule[]> {
    const results = await db
      .select()
      .from(policyRules)
      .where(eq(policyRules.healthSystemId, healthSystemId))
      .orderBy(desc(policyRules.createdAt));

    return results.map(p => this.formatPolicyRule(p));
  }

  /**
   * Get policy violations
   */
  async getViolations(
    healthSystemId: string,
    filters?: { resolved?: boolean; policyId?: string }
  ): Promise<PolicyViolation[]> {
    // Get AI systems for this health system
    const systems = await db
      .select()
      .from(aiSystems)
      .where(eq(aiSystems.healthSystemId, healthSystemId));

    const systemIds = systems.map(s => s.id);

    if (systemIds.length === 0) {
      return [];
    }

    // Get violations for these systems
    let query = db
      .select()
      .from(policyEnforcementLogs);

    // Apply filters
    const violations = await query.orderBy(desc(policyEnforcementLogs.createdAt));

    // Filter to this health system's AI systems only
    const filtered = violations.filter(v => systemIds.includes(v.aiSystemId));

    // Apply additional filters
    let result = filtered;

    if (filters?.resolved !== undefined) {
      result = result.filter(v => 
        filters.resolved ? v.resolvedAt !== null : v.resolvedAt === null
      );
    }

    if (filters?.policyId) {
      result = result.filter(v => v.policyId === filters.policyId);
    }

    return result.map(v => ({
      id: v.id,
      policyId: v.policyId,
      aiSystemId: v.aiSystemId,
      violationType: v.violationType,
      actionTaken: v.actionTaken,
      details: typeof v.details === 'string' ? JSON.parse(v.details) : v.details,
      resolvedBy: v.resolvedBy,
      resolvedAt: v.resolvedAt,
      createdAt: v.createdAt,
    }));
  }

  /**
   * Resolve a policy violation
   */
  async resolveViolation(violationId: string, resolvedBy: string): Promise<void> {
    await db
      .update(policyEnforcementLogs)
      .set({
        resolvedBy,
        resolvedAt: new Date(),
      })
      .where(eq(policyEnforcementLogs.id, violationId));

    logger.info({
      violationId,
      resolvedBy,
    }, "Policy violation resolved");
  }

  /**
   * Update policy (activate/deactivate)
   */
  async updatePolicy(
    policyId: string,
    updates: { active?: boolean; enforcementActions?: any }
  ): Promise<void> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (updates.active !== undefined) {
      updateData.active = updates.active;
    }

    if (updates.enforcementActions) {
      updateData.enforcementActions = JSON.stringify(updates.enforcementActions);
    }

    await db
      .update(policyRules)
      .set(updateData)
      .where(eq(policyRules.id, policyId));

    logger.info({ policyId, updates }, "Policy updated");
  }

  /**
   * Delete policy
   */
  async deletePolicy(policyId: string): Promise<void> {
    await db
      .delete(policyRules)
      .where(eq(policyRules.id, policyId));

    logger.info({ policyId }, "Policy deleted");
  }

  /**
   * Format policy rule for output
   */
  private formatPolicyRule(policy: any): PolicyRule {
    return {
      id: policy.id,
      healthSystemId: policy.healthSystemId,
      policyName: policy.policyName,
      policyType: policy.policyType,
      scope: policy.scope,
      scopeFilter: typeof policy.scopeFilter === 'string'
        ? JSON.parse(policy.scopeFilter)
        : policy.scopeFilter,
      conditions: typeof policy.conditions === 'string'
        ? JSON.parse(policy.conditions)
        : policy.conditions,
      enforcementActions: typeof policy.enforcementActions === 'string'
        ? JSON.parse(policy.enforcementActions)
        : policy.enforcementActions,
      approvalWorkflow: typeof policy.approvalWorkflow === 'string'
        ? JSON.parse(policy.approvalWorkflow)
        : policy.approvalWorkflow,
      active: policy.active,
      createdBy: policy.createdBy,
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt,
    };
  }

  /**
   * Get policy enforcement statistics
   */
  async getPolicyStats(healthSystemId: string): Promise<{
    totalPolicies: number;
    activePolicies: number;
    totalViolations: number;
    unresolvedViolations: number;
    violationsByType: Record<string, number>;
  }> {
    const policies = await this.getPolicies(healthSystemId);
    const violations = await this.getViolations(healthSystemId);

    const violationsByType: Record<string, number> = {};
    violations.forEach(v => {
      violationsByType[v.violationType] = (violationsByType[v.violationType] || 0) + 1;
    });

    return {
      totalPolicies: policies.length,
      activePolicies: policies.filter(p => p.active).length,
      totalViolations: violations.length,
      unresolvedViolations: violations.filter(v => !v.resolvedAt).length,
      violationsByType,
    };
  }
}

export const policyEnforcementEngine = new PolicyEnforcementEngine();
