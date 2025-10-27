/**
 * INFRASTRUCTURE LAYER: Stripe Policy Limit Gateway
 * 
 * Checks subscription tier limits for policy creation.
 */

import { db } from '../../db';
import { healthSystems, subscriptions, policyRules } from '../../../shared/schema';
import type { ISubscriptionTierLimitGateway } from '../../application/policy-enforcement/CreatePolicyRuleUseCase';
import { eq, sql } from 'drizzle-orm';

export class StripePolicyLimitGateway implements ISubscriptionTierLimitGateway {
  async checkPolicyLimit(
    healthSystemId: string
  ): Promise<{ allowed: boolean; limit: number; current: number }> {
    // Get health system subscription
    const [healthSystem] = await db
      .select({
        subscriptionId: healthSystems.subscriptionId,
      })
      .from(healthSystems)
      .where(eq(healthSystems.id, healthSystemId))
      .limit(1);

    if (!healthSystem?.subscriptionId) {
      // No subscription = free tier (limit: 3)
      const currentCount = await this.getCurrentPolicyCount(healthSystemId);
      return {
        allowed: currentCount < 3,
        limit: 3,
        current: currentCount,
      };
    }

    // Get subscription tier
    const [subscription] = await db
      .select({
        planTier: subscriptions.planTier,
      })
      .from(subscriptions)
      .where(eq(subscriptions.id, healthSystem.subscriptionId))
      .limit(1);

    if (!subscription) {
      // Fallback to free tier
      const currentCount = await this.getCurrentPolicyCount(healthSystemId);
      return {
        allowed: currentCount < 3,
        limit: 3,
        current: currentCount,
      };
    }

    // Tier-based limits
    const limits: Record<string, number> = {
      foundation: 10,
      growth: 50,
      enterprise: 999999, // Unlimited
    };

    const limit = limits[subscription.planTier] || 3;
    const currentCount = await this.getCurrentPolicyCount(healthSystemId);

    return {
      allowed: currentCount < limit,
      limit,
      current: currentCount,
    };
  }

  /**
   * Get current policy count for health system
   */
  private async getCurrentPolicyCount(healthSystemId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(policyRules)
      .where(eq(policyRules.healthSystemId, healthSystemId));

    return result[0]?.count || 0;
  }
}
