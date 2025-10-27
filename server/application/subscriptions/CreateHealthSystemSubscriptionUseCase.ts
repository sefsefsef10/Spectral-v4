/**
 * Create Health System Subscription Use Case
 * 
 * Orchestrates subscription creation:
 * 1. Create/retrieve Stripe customer
 * 2. Create Stripe subscription
 * 3. Create domain subscription entity
 * 4. Persist to database
 */

import { SubscriptionRepository } from '../../domain/repositories/SubscriptionRepository';
import { StripeGateway } from '../../domain/gateways/StripeGateway';
import { Subscription, SubscriptionTier } from '../../domain/entities/Subscription';

export interface CreateHealthSystemSubscriptionRequest {
  healthSystemId: string;
  healthSystemName: string;
  tier: SubscriptionTier;
}

export interface CreateHealthSystemSubscriptionResponse {
  subscriptionId: string;
  clientSecret: string; // For Stripe payment UI
  tier: SubscriptionTier;
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date;
}

export class CreateHealthSystemSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly stripeGateway: StripeGateway
  ) {}

  async execute(request: CreateHealthSystemSubscriptionRequest): Promise<CreateHealthSystemSubscriptionResponse> {
    // Check if subscription already exists
    const existingSubscription = await this.subscriptionRepo.findByHealthSystemId(request.healthSystemId);
    if (existingSubscription) {
      throw new Error(`Health system ${request.healthSystemId} already has a subscription`);
    }

    // Create Stripe customer (idempotent)
    const customerId = await this.stripeGateway.getOrCreateHealthSystemCustomer(
      request.healthSystemId,
      request.healthSystemName
    );

    // Create Stripe subscription
    const stripeResult = await this.stripeGateway.createHealthSystemSubscription(
      customerId,
      request.tier,
      request.healthSystemId
    );

    // Create domain entity with trial (starts in TRIALING status)
    const subscription = Subscription.create(
      generateSubscriptionId(),
      request.healthSystemId,
      request.tier
    );

    // Set Stripe subscription ID and billing period
    // Subscription remains in TRIALING status (activate() called via webhook after payment)
    subscription.setStripeSubscriptionId(stripeResult.stripeSubscriptionId);
    subscription.updateBillingPeriod(stripeResult.currentPeriodStart, stripeResult.currentPeriodEnd);

    // Persist to database
    const savedSubscription = await this.subscriptionRepo.save(subscription);

    return {
      subscriptionId: savedSubscription.id,
      clientSecret: stripeResult.clientSecret,
      tier: savedSubscription.tier,
      status: savedSubscription.status,
      trialEndsAt: savedSubscription.trialEndsAt,
      currentPeriodEnd: savedSubscription.currentPeriodEnd,
    };
  }
}

/**
 * Generate unique subscription ID
 */
function generateSubscriptionId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
