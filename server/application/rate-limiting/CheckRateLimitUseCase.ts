/**
 * APPLICATION LAYER USE CASE: Check Rate Limit
 */

import { RateLimitPolicy, type RateLimitAction } from '../../domain/entities/RateLimitPolicy';
import type { IRateLimitPolicyRepository } from '../../domain/repositories/IRateLimitPolicyRepository';

export interface CheckRateLimitInput {
  healthSystemId: string;
}

export interface CheckRateLimitResult {
  action: RateLimitAction;
  remaining: number;
  resetAt: number;
  tier: string;
}

export class CheckRateLimitUseCase {
  constructor(private rateLimitRepository: IRateLimitPolicyRepository) {}

  async execute(input: CheckRateLimitInput): Promise<CheckRateLimitResult> {
    let policy = await this.rateLimitRepository.findByHealthSystemId(input.healthSystemId);
    
    if (!policy) {
      policy = RateLimitPolicy.create({
        tier: 'free',
        healthSystemId: input.healthSystemId,
      });
      await this.rateLimitRepository.save(policy);
    }

    if (policy.shouldAutoUnblock()) {
      policy.clearViolations();
      await this.rateLimitRepository.save(policy);
    }

    const action = policy.checkRequest();
    
    if (action === 'allow') {
      policy.recordRequest();
      await this.rateLimitRepository.save(policy);
    } else if (action === 'block') {
      policy.recordViolation();
      await this.rateLimitRepository.save(policy);
    }

    return {
      action,
      remaining: policy.getRemainingQuota('1hour'),
      resetAt: policy.getTimeUntilReset('1hour'),
      tier: policy.tier,
    };
  }
}
