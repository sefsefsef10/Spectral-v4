/**
 * INFRASTRUCTURE LAYER: Drizzle Policy Rule Repository
 * 
 * Implements IPolicyRuleRepository using Drizzle ORM.
 */

import { db } from '../../db';
import { policyRules } from '../../../shared/schema';
import { PolicyRule, type PolicyRuleProps } from '../../domain/entities/PolicyRule';
import type { IPolicyRuleRepository } from '../../application/policy-enforcement/repositories/IPolicyRuleRepository';
import { eq, and } from 'drizzle-orm';

export class DrizzlePolicyRuleRepository implements IPolicyRuleRepository {
  async create(policyRule: PolicyRule): Promise<PolicyRule> {
    const snapshot = policyRule.toSnapshot();

    const [inserted] = await db
      .insert(policyRules)
      .values({
        healthSystemId: snapshot.healthSystemId,
        policyName: snapshot.policyName,
        policyType: snapshot.policyType,
        scope: snapshot.scope,
        scopeFilter: snapshot.scopeFilter || null,
        conditions: snapshot.conditions || null,
        enforcementActions: snapshot.enforcementActions,
        approvalWorkflow: snapshot.approvalWorkflow || null,
        active: snapshot.active ?? true,
        createdBy: snapshot.createdBy,
      })
      .returning();

    return this.toDomain(inserted);
  }

  async findById(id: string): Promise<PolicyRule | null> {
    const result = await db
      .select()
      .from(policyRules)
      .where(eq(policyRules.id, id))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return this.toDomain(result[0]);
  }

  async findActiveByHealthSystem(healthSystemId: string): Promise<PolicyRule[]> {
    const results = await db
      .select()
      .from(policyRules)
      .where(and(eq(policyRules.healthSystemId, healthSystemId), eq(policyRules.active, true)));

    return results.map((row) => this.toDomain(row));
  }

  async findAllByHealthSystem(healthSystemId: string): Promise<PolicyRule[]> {
    const results = await db
      .select()
      .from(policyRules)
      .where(eq(policyRules.healthSystemId, healthSystemId));

    return results.map((row) => this.toDomain(row));
  }

  async update(policyRule: PolicyRule): Promise<PolicyRule> {
    if (!policyRule.id) {
      throw new Error('Cannot update policy rule without ID');
    }

    const snapshot = policyRule.toSnapshot();

    const [updated] = await db
      .update(policyRules)
      .set({
        policyName: snapshot.policyName,
        policyType: snapshot.policyType,
        scope: snapshot.scope,
        scopeFilter: snapshot.scopeFilter || null,
        conditions: snapshot.conditions || null,
        enforcementActions: snapshot.enforcementActions,
        approvalWorkflow: snapshot.approvalWorkflow || null,
        active: snapshot.active,
        updatedAt: new Date(),
      })
      .where(eq(policyRules.id, policyRule.id))
      .returning();

    return this.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await db.delete(policyRules).where(eq(policyRules.id, id));
  }

  /**
   * Map database row to domain entity
   */
  private toDomain(row: typeof policyRules.$inferSelect): PolicyRule {
    const props: PolicyRuleProps = {
      id: row.id,
      healthSystemId: row.healthSystemId,
      policyName: row.policyName,
      policyType: row.policyType as 'approval_required' | 'prohibited' | 'restricted' | 'monitored',
      scope: row.scope as 'all_ai' | 'department' | 'category' | 'vendor',
      scopeFilter: row.scopeFilter ? (row.scopeFilter as any) : undefined,
      conditions: row.conditions ? (row.conditions as any) : undefined,
      enforcementActions: row.enforcementActions as any,
      approvalWorkflow: row.approvalWorkflow ? (row.approvalWorkflow as any) : undefined,
      active: row.active,
      createdBy: row.createdBy || '',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    return PolicyRule.from(props);
  }
}
