/**
 * INFRASTRUCTURE LAYER: Rate Limit Policy Repository
 */

import { eq } from 'drizzle-orm';
import { RateLimitPolicy, type RateLimitTier } from '../../domain/entities/RateLimitPolicy';
import type { RateLimitPolicyRepository } from '../../application/rate-limiting/CheckRateLimitUseCase';
import { db } from '../../db';
import { rateLimitPolicies } from '../../../shared/schema';

export class DrizzleRateLimitPolicyRepository implements RateLimitPolicyRepository {
  async save(policy: RateLimitPolicy): Promise<void> {
    const data = this.toDatabase(policy);
    
    if (await this.findByClientId(policy.clientId)) {
      await db
        .update(rateLimitPolicies)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(rateLimitPolicies.clientId, policy.clientId));
    } else {
      await db.insert(rateLimitPolicies).values(data);
    }
  }

  async findByClientId(clientId: string): Promise<RateLimitPolicy | null> {
    const [row] = await db
      .select()
      .from(rateLimitPolicies)
      .where(eq(rateLimitPolicies.clientId, clientId))
      .limit(1);

    return row ? this.toDomain(row) : null;
  }

  private toDatabase(policy: RateLimitPolicy): any {
    return {
      id: policy.id,
      clientId: policy.clientId,
      tier: policy.tier,
      hourlyLimit: policy.hourlyLimit,
      dailyLimit: policy.dailyLimit,
      hourlyUsage: policy.hourlyUsage,
      dailyUsage: policy.dailyUsage,
      hourlyResetAt: policy.hourlyResetAt,
      dailyResetAt: policy.dailyResetAt,
      violations: policy.violations,
      blockedUntil: policy.blockedUntil,
      createdAt: policy.createdAt,
    };
  }

  private toDomain(row: any): RateLimitPolicy {
    return RateLimitPolicy.fromPersistence({
      id: row.id,
      clientId: row.clientId,
      tier: row.tier as RateLimitTier,
      hourlyLimit: row.hourlyLimit,
      dailyLimit: row.dailyLimit,
      hourlyUsage: row.hourlyUsage,
      dailyUsage: row.dailyUsage,
      hourlyResetAt: row.hourlyResetAt,
      dailyResetAt: row.dailyResetAt,
      violations: row.violations,
      blockedUntil: row.blockedUntil,
      createdAt: row.createdAt,
    });
  }
}
