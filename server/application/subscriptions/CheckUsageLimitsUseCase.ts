/**
 * Check Usage Limits Use Case
 * 
 * Validates if a health system can add an AI system based on their subscription tier limits.
 * This is a critical business capability for enforcing plan limits.
 */

import { SubscriptionRepository } from '../../domain/repositories/SubscriptionRepository';
import { Subscription, SubscriptionTier } from '../../domain/entities/Subscription';

export interface CheckUsageLimitsRequest {
  healthSystemId: string;
  currentAISystemCount: number;
}

export interface CheckUsageLimitsResponse {
  allowed: boolean;
  currentTier: SubscriptionTier;
  currentCount: number;
  limit: number;
  reason?: string;
}

export class CheckUsageLimitsUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository
  ) {}

  async execute(request: CheckUsageLimitsRequest): Promise<CheckUsageLimitsResponse> {
    // Load subscription for health system
    const subscription = await this.subscriptionRepo.findByHealthSystemId(request.healthSystemId);

    // If no subscription exists, default to Starter tier limits
    const effectiveSubscription = subscription || Subscription.create(
      'default',
      request.healthSystemId,
      SubscriptionTier.STARTER
    );

    // Use domain entity to check limits (business logic encapsulated)
    const limitCheck = effectiveSubscription.canAddAISystem(request.currentAISystemCount);
    const limits = effectiveSubscription.getTierLimits();

    return {
      allowed: limitCheck.allowed,
      currentTier: effectiveSubscription.tier,
      currentCount: request.currentAISystemCount,
      limit: limits.aiSystems,
      reason: limitCheck.reason,
    };
  }
}
