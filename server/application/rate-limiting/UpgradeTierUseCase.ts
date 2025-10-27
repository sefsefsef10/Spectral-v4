/**
 * APPLICATION LAYER USE CASE: Upgrade Tier
 */

import { RateLimitPolicy, type RateLimitTier } from '../../domain/entities/RateLimitPolicy';
import type { IRateLimitPolicyRepository } from '../../domain/repositories/IRateLimitPolicyRepository';

export interface UpgradeTierInput {
  healthSystemId: string;
  newTier: RateLimitTier;
}

export interface UpgradeTierResult {
  healthSystemId: string;
  newTier: RateLimitTier;
  quotas: any[];
}

export class UpgradeTierUseCase {
  constructor(private rateLimitRepository: IRateLimitPolicyRepository) {}

  async execute(input: UpgradeTierInput): Promise<UpgradeTierResult> {
    const policy = await this.rateLimitRepository.findByHealthSystemId(input.healthSystemId);
    if (!policy) {
      throw new Error(`Rate limit policy not found for health system: ${input.healthSystemId}`);
    }

    policy.upgradeTier(input.newTier);
    await this.rateLimitRepository.save(policy);

    return {
      healthSystemId: policy.healthSystemId,
      newTier: policy.tier,
      quotas: policy.quotas,
    };
  }
}
