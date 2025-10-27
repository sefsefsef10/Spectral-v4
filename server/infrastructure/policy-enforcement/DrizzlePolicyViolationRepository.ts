/**
 * INFRASTRUCTURE LAYER: Drizzle Policy Violation Repository
 * 
 * Implements IPolicyViolationRepository using policy_enforcement_logs table.
 */

import { db } from '../../db';
import { policyEnforcementLogs } from '../../../shared/schema';
import type { IPolicyViolationRepository, PolicyViolationData } from '../../application/policy-enforcement/repositories/IPolicyViolationRepository';
import { eq, isNull } from 'drizzle-orm';

export class DrizzlePolicyViolationRepository implements IPolicyViolationRepository {
  async create(
    violation: Omit<PolicyViolationData, 'id' | 'createdAt'>
  ): Promise<PolicyViolationData> {
    const [inserted] = await db
      .insert(policyEnforcementLogs)
      .values({
        policyId: violation.policyRuleId,
        aiSystemId: violation.aiSystemId,
        violationType: violation.violationType,
        actionTaken: violation.actionRequired, // Map actionRequired to actionTaken
        details: {
          healthSystemId: violation.healthSystemId,
          severity: violation.severity,
          actionTaken: violation.actionTaken,
        },
        resolvedAt: violation.resolvedAt || null,
      })
      .returning();

    return this.toDomain(inserted);
  }

  async findByAISystem(aiSystemId: string): Promise<PolicyViolationData[]> {
    const results = await db
      .select()
      .from(policyEnforcementLogs)
      .where(eq(policyEnforcementLogs.aiSystemId, aiSystemId));

    return results.map((row) => this.toDomain(row));
  }

  async findByHealthSystem(healthSystemId: string): Promise<PolicyViolationData[]> {
    // Since healthSystemId is in details JSONB, we need to use raw SQL or filter in memory
    const results = await db.select().from(policyEnforcementLogs);

    return results
      .filter((row) => {
        const details = row.details as any;
        return details?.healthSystemId === healthSystemId;
      })
      .map((row) => this.toDomain(row));
  }

  async findUnresolved(healthSystemId: string): Promise<PolicyViolationData[]> {
    const results = await db
      .select()
      .from(policyEnforcementLogs)
      .where(isNull(policyEnforcementLogs.resolvedAt));

    return results
      .filter((row) => {
        const details = row.details as any;
        return details?.healthSystemId === healthSystemId;
      })
      .map((row) => this.toDomain(row));
  }

  async resolve(id: string, actionTaken: string): Promise<PolicyViolationData> {
    // First fetch existing record
    const [existing] = await db
      .select()
      .from(policyEnforcementLogs)
      .where(eq(policyEnforcementLogs.id, id))
      .limit(1);

    if (!existing) {
      throw new Error(`Policy violation ${id} not found`);
    }

    // Update with merged details
    const [updated] = await db
      .update(policyEnforcementLogs)
      .set({
        resolvedAt: new Date(),
        details: {
          ...(existing.details as any),
          actionTaken,
        },
      })
      .where(eq(policyEnforcementLogs.id, id))
      .returning();

    return this.toDomain(updated);
  }

  /**
   * Map database row to domain data
   */
  private toDomain(row: typeof policyEnforcementLogs.$inferSelect): PolicyViolationData {
    const details = row.details as any;

    return {
      id: row.id,
      healthSystemId: details?.healthSystemId || '',
      policyRuleId: row.policyId,
      aiSystemId: row.aiSystemId,
      violationType: row.violationType,
      severity: (details?.severity as 'critical' | 'high' | 'medium' | 'low') || 'medium',
      actionRequired: row.actionTaken,
      actionTaken: details?.actionTaken || null,
      resolvedAt: row.resolvedAt || null,
      createdAt: row.createdAt,
    };
  }
}
