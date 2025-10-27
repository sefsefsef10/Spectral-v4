/**
 * Stripe Gateway Interface
 * 
 * Domain layer defines the interface for external Stripe API interactions.
 * Infrastructure layer implements the actual Stripe SDK calls.
 */

import { SubscriptionTier } from '../entities/Subscription';

export interface StripeSubscriptionResult {
  stripeSubscriptionId: string;
  clientSecret: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

export interface StripeGateway {
  /**
   * Create or retrieve Stripe customer for health system
   */
  getOrCreateHealthSystemCustomer(healthSystemId: string, healthSystemName: string): Promise<string>;

  /**
   * Create Stripe subscription for health system
   */
  createHealthSystemSubscription(
    customerId: string,
    tier: SubscriptionTier,
    healthSystemId: string
  ): Promise<StripeSubscriptionResult>;

  /**
   * Cancel Stripe subscription
   */
  cancelSubscription(stripeSubscriptionId: string): Promise<void>;
}
