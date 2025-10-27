/**
 * 🔄 SENTINEL ROLLBACK SERVICE
 * 
 * Automated rollback infrastructure for AI system deployments:
 * - Rollback policy management
 * - Deployment history tracking
 * - Automated and manual rollback execution
 * - Approval workflows and cooldown enforcement
 */

import { db } from '../db';
import {
  rollbackPolicies,
  deploymentHistory,
  rollbackExecutions,
  aiSystems,
  type InsertRollbackPolicy,
  type InsertDeploymentHistory,
  type InsertRollbackExecution,
} from '../../shared/schema';
import { eq, and, desc, sql, gte } from 'drizzle-orm';
import { logger } from '../logger';

export class RollbackService {
  /**
   * Create or update rollback policy for an AI system
   */
  async upsertRollbackPolicy(data: InsertRollbackPolicy) {
    const existing = await db.select()
      .from(rollbackPolicies)
      .where(and(
        eq(rollbackPolicies.aiSystemId, data.aiSystemId),
        eq(rollbackPolicies.healthSystemId, data.healthSystemId)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Update existing policy
      const updated = await db.update(rollbackPolicies)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(rollbackPolicies.id, existing[0].id))
        .returning();

      logger.info({
        policyId: updated[0].id,
        aiSystemId: data.aiSystemId,
      }, 'Rollback policy updated');

      return updated[0];
    } else {
      // Create new policy
      const created = await db.insert(rollbackPolicies)
        .values(data)
        .returning();

      logger.info({
        policyId: created[0].id,
        aiSystemId: data.aiSystemId,
      }, 'Rollback policy created');

      return created[0];
    }
  }

  /**
   * Get rollback policy for an AI system
   */
  async getRollbackPolicy(aiSystemId: string, healthSystemId: string) {
    const policy = await db.select()
      .from(rollbackPolicies)
      .where(and(
        eq(rollbackPolicies.aiSystemId, aiSystemId),
        eq(rollbackPolicies.healthSystemId, healthSystemId)
      ))
      .limit(1);

    return policy[0] || null;
  }

  /**
   * Record new deployment for an AI system
   */
  async recordDeployment(data: InsertDeploymentHistory) {
    // Mark previous active deployments as deprecated
    await db.update(deploymentHistory)
      .set({ status: 'deprecated' })
      .where(and(
        eq(deploymentHistory.aiSystemId, data.aiSystemId),
        eq(deploymentHistory.status, 'active')
      ));

    // Insert new deployment
    const deployment = await db.insert(deploymentHistory)
      .values({
        ...data,
        status: 'active',
      })
      .returning();

    logger.info({
      deploymentId: deployment[0].id,
      aiSystemId: data.aiSystemId,
      version: data.version,
    }, 'Deployment recorded');

    return deployment[0];
  }

  /**
   * Get deployment history for an AI system
   */
  async getDeploymentHistory(aiSystemId: string, limit = 10) {
    return db.select()
      .from(deploymentHistory)
      .where(eq(deploymentHistory.aiSystemId, aiSystemId))
      .orderBy(desc(deploymentHistory.deployedAt))
      .limit(limit);
  }

  /**
   * Get currently active deployment for an AI system
   */
  async getActiveDeployment(aiSystemId: string) {
    const active = await db.select()
      .from(deploymentHistory)
      .where(and(
        eq(deploymentHistory.aiSystemId, aiSystemId),
        eq(deploymentHistory.status, 'active')
      ))
      .limit(1);

    return active[0] || null;
  }

  /**
   * Check if rollback should be triggered based on violation
   */
  async shouldTriggerRollback(
    aiSystemId: string,
    healthSystemId: string,
    violationType: string,
    severity: string
  ): Promise<{
    shouldRollback: boolean;
    reason: string;
    policy?: any;
  }> {
    const policy = await this.getRollbackPolicy(aiSystemId, healthSystemId);

    if (!policy || !policy.enabled) {
      return {
        shouldRollback: false,
        reason: 'No active rollback policy',
      };
    }

    // Check if trigger matches policy
    const triggers = policy.rollbackTriggers as any;
    if (!triggers || !Array.isArray(triggers)) {
      return {
        shouldRollback: false,
        reason: 'No rollback triggers configured',
      };
    }

    const matchesTrigger = triggers.some((trigger: any) => {
      return (
        (trigger.violationType === violationType || trigger.violationType === '*') &&
        (trigger.severity === severity || trigger.severity === '*' || 
         (severity === 'critical' && policy.autoRollbackOnCritical))
      );
    });

    if (!matchesTrigger) {
      return {
        shouldRollback: false,
        reason: 'Violation does not match rollback triggers',
      };
    }

    // Check cooldown period
    const cooldownEnd = await this.getCooldownEnd(aiSystemId);
    if (cooldownEnd && cooldownEnd > new Date()) {
      return {
        shouldRollback: false,
        reason: `Cooldown active until ${cooldownEnd.toISOString()}`,
        policy,
      };
    }

    // Check daily auto-rollback limit
    if (!policy.requiresApproval && policy.maxAutoRollbacks) {
      const todayCount = await this.getAutoRollbackCount(aiSystemId, 'today');
      if (todayCount >= policy.maxAutoRollbacks) {
        return {
          shouldRollback: false,
          reason: `Max auto-rollbacks per day reached (${policy.maxAutoRollbacks})`,
          policy,
        };
      }
    }

    return {
      shouldRollback: true,
      reason: 'Rollback criteria met',
      policy,
    };
  }

  /**
   * Create pending rollback (for approval workflow)
   */
  async createPendingRollback(
    aiSystemId: string,
    trigger: 'automated' | 'manual' | 'policy',
    options: {
      triggeredBy?: string;
      targetVersion?: string;
      reason?: string;
      actionId?: string;
    } = {}
  ) {
    const activeDeployment = await this.getActiveDeployment(aiSystemId);
    if (!activeDeployment) {
      throw new Error('No active deployment found for AI system');
    }

    // Determine target version
    let targetVersion = options.targetVersion;
    if (!targetVersion) {
      const history = await this.getDeploymentHistory(aiSystemId, 10);
      const previousStable = history.find(
        (d) => d.id !== activeDeployment.id && d.status !== 'rolled_back'
      );
      
      if (!previousStable) {
        throw new Error('No previous deployment available for rollback');
      }
      
      targetVersion = previousStable.version;
    }

    // Create pending rollback record
    const rollback = await db.insert(rollbackExecutions)
      .values({
        aiSystemId,
        actionId: options.actionId || null,
        fromVersion: activeDeployment.version,
        toVersion: targetVersion,
        trigger,
        triggeredBy: options.triggeredBy || null,
        status: 'pending_approval',
        metadata: { reason: options.reason },
      })
      .returning();

    logger.info({
      rollbackId: rollback[0].id,
      aiSystemId,
      fromVersion: activeDeployment.version,
      toVersion: targetVersion,
      trigger,
    }, 'Rollback created (pending approval)');

    return rollback[0];
  }

  /**
   * Execute rollback (automated or manual)
   * Can operate on existing pending rollback or create new one
   */
  async executeRollback(
    aiSystemId: string,
    trigger: 'automated' | 'manual' | 'policy',
    options: {
      triggeredBy?: string;
      approvedBy?: string;
      actionId?: string;
      targetVersion?: string;
      reason?: string;
      existingRollbackId?: string; // Use existing record for approval workflow
    } = {}
  ) {
    const activeDeployment = await this.getActiveDeployment(aiSystemId);
    if (!activeDeployment) {
      throw new Error('No active deployment found for AI system');
    }

    let rollbackId: string;
    let fromVersion: string;
    let toVersion: string;

    if (options.existingRollbackId) {
      // Update existing pending rollback record
      const existing = await db.select()
        .from(rollbackExecutions)
        .where(eq(rollbackExecutions.id, options.existingRollbackId))
        .limit(1);

      if (!existing[0]) {
        throw new Error('Rollback record not found');
      }

      rollbackId = existing[0].id;
      fromVersion = existing[0].fromVersion;
      toVersion = existing[0].toVersion;

      // Transition to in_progress
      await db.update(rollbackExecutions)
        .set({
          status: 'in_progress',
          startedAt: new Date(),
        })
        .where(eq(rollbackExecutions.id, rollbackId));
    } else {
      // Create new rollback execution record
      const targetVer = options.targetVersion || await this.findPreviousVersion(aiSystemId, activeDeployment.id);
      
      const rollback = await db.insert(rollbackExecutions)
        .values({
          aiSystemId,
          actionId: options.actionId || null,
          fromVersion: activeDeployment.version,
          toVersion: targetVer,
          trigger,
          triggeredBy: options.triggeredBy || null,
          approvedBy: options.approvedBy || null,
          status: 'in_progress',
          startedAt: new Date(),
          metadata: { reason: options.reason },
        })
        .returning();

      rollbackId = rollback[0].id;
      fromVersion = rollback[0].fromVersion;
      toVersion = rollback[0].toVersion;
    }

    logger.info({
      rollbackId,
      aiSystemId,
      fromVersion,
      toVersion,
      trigger,
    }, 'Rollback initiated');

    try {
      // Mark current deployment as rolled back
      await db.update(deploymentHistory)
        .set({ status: 'rolled_back' })
        .where(eq(deploymentHistory.id, activeDeployment.id));

      // Record new deployment as rollback
      await this.recordDeployment({
        aiSystemId,
        version: toVersion,
        deployedAt: new Date(),
        deployedBy: options.triggeredBy || null,
        deploymentType: 'rollback',
        rollbackFromVersion: fromVersion,
        metadata: {
          rollbackExecutionId: rollbackId,
          trigger,
        },
        notes: options.reason,
      });

      // Update rollback execution status to completed
      await db.update(rollbackExecutions)
        .set({
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(rollbackExecutions.id, rollbackId));

      logger.info({
        rollbackId,
        aiSystemId,
        toVersion,
      }, 'Rollback completed successfully');

      // Return the final rollback record
      const final = await db.select()
        .from(rollbackExecutions)
        .where(eq(rollbackExecutions.id, rollbackId))
        .limit(1);

      return final[0];
    } catch (error) {
      // Update rollback execution as failed
      await db.update(rollbackExecutions)
        .set({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        .where(eq(rollbackExecutions.id, rollbackId));

      logger.error({
        err: error,
        rollbackId,
        aiSystemId,
      }, 'Rollback execution failed');

      throw error;
    }
  }

  /**
   * Helper to find previous stable version
   */
  private async findPreviousVersion(aiSystemId: string, currentDeploymentId: string): Promise<string> {
    const history = await this.getDeploymentHistory(aiSystemId, 10);
    const previousStable = history.find(
      (d) => d.id !== currentDeploymentId && d.status !== 'rolled_back'
    );
    
    if (!previousStable) {
      throw new Error('No previous deployment available for rollback');
    }
    
    return previousStable.version;
  }

  /**
   * Get cooldown end time for an AI system
   */
  async getCooldownEnd(aiSystemId: string): Promise<Date | null> {
    const policy = await db.select()
      .from(rollbackPolicies)
      .where(eq(rollbackPolicies.aiSystemId, aiSystemId))
      .limit(1);

    if (!policy[0] || !policy[0].cooldownMinutes) {
      return null;
    }

    const lastRollback = await db.select()
      .from(rollbackExecutions)
      .where(and(
        eq(rollbackExecutions.aiSystemId, aiSystemId),
        eq(rollbackExecutions.status, 'completed')
      ))
      .orderBy(desc(rollbackExecutions.completedAt))
      .limit(1);

    if (!lastRollback[0] || !lastRollback[0].completedAt) {
      return null;
    }

    const cooldownEnd = new Date(lastRollback[0].completedAt);
    cooldownEnd.setMinutes(cooldownEnd.getMinutes() + policy[0].cooldownMinutes);

    return cooldownEnd > new Date() ? cooldownEnd : null;
  }

  /**
   * Get count of auto-rollbacks within time period
   */
  async getAutoRollbackCount(aiSystemId: string, period: 'today' | 'week' | 'month'): Promise<number> {
    const startDate = new Date();
    
    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    const count = await db.select({ count: sql<number>`count(*)` })
      .from(rollbackExecutions)
      .where(and(
        eq(rollbackExecutions.aiSystemId, aiSystemId),
        eq(rollbackExecutions.trigger, 'automated'),
        gte(rollbackExecutions.createdAt, startDate)
      ));

    return Number(count[0]?.count || 0);
  }

  /**
   * Get rollback execution history
   */
  async getRollbackHistory(aiSystemId: string, limit = 20) {
    return db.select()
      .from(rollbackExecutions)
      .where(eq(rollbackExecutions.aiSystemId, aiSystemId))
      .orderBy(desc(rollbackExecutions.createdAt))
      .limit(limit);
  }

  /**
   * Approve pending rollback (enforces approver membership)
   */
  async approveRollback(rollbackId: string, approverId: string) {
    const rollback = await db.select()
      .from(rollbackExecutions)
      .where(eq(rollbackExecutions.id, rollbackId))
      .limit(1);

    if (!rollback[0]) {
      throw new Error('Rollback not found');
    }

    if (rollback[0].status !== 'pending_approval') {
      throw new Error('Rollback is not pending approval');
    }

    // Verify approver is authorized
    const policy = await db.select()
      .from(rollbackPolicies)
      .where(eq(rollbackPolicies.aiSystemId, rollback[0].aiSystemId))
      .limit(1);

    if (policy[0] && policy[0].approvers && policy[0].approvers.length > 0) {
      // Get user to check their role
      const { storage } = await import('../storage');
      const approver = await storage.getUser(approverId);
      
      if (!approver) {
        throw new Error('Approver not found');
      }

      // Check if user's role is in the approvers list
      if (!policy[0].approvers.includes(approver.role)) {
        throw new Error(`Unauthorized: Only ${policy[0].approvers.join(', ')} can approve rollbacks`);
      }
    }

    // Update rollback to approved status
    await db.update(rollbackExecutions)
      .set({
        approvedBy: approverId,
        status: 'approved',
      })
      .where(eq(rollbackExecutions.id, rollbackId));

    logger.info({
      rollbackId,
      approverId,
    }, 'Rollback approved');

    // Execute the approved rollback using the existing record
    return this.executeRollback(
      rollback[0].aiSystemId,
      'manual',
      {
        triggeredBy: rollback[0].triggeredBy || undefined,
        approvedBy: approverId,
        actionId: rollback[0].actionId || undefined,
        existingRollbackId: rollbackId, // Use existing record!
      }
    );
  }
}

export const rollbackService = new RollbackService();
