/**
 * Stripe Gateway Implementation
 * 
 * Infrastructure layer implementation wrapping Stripe SDK.
 * Isolates external Stripe API calls from domain logic.
 */

import { StripeGateway, StripeSubscriptionResult } from '@server/domain/gateways/StripeGateway';
import { SubscriptionTier } from '@server/domain/entities/Subscription';
import { stripe, HEALTH_SYSTEM_PRICING } from '@server/services/stripe-billing';
import { storage } from '@server/storage';
import { logger } from '@server/logger';
import Stripe from 'stripe';

export class StripeGatewayImpl implements StripeGateway {
  async getOrCreateHealthSystemCustomer(
    healthSystemId: string,
    healthSystemName: string
  ): Promise<string> {
    const healthSystem = await storage.getHealthSystem(healthSystemId);
    if (!healthSystem) {
      throw new Error(`Health system ${healthSystemId} not found`);
    }

    // Return existing customer if already created
    if (healthSystem.stripeCustomerId) {
      return healthSystem.stripeCustomerId;
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      name: healthSystemName,
      metadata: {
        healthSystemId,
        type: 'health_system',
      },
    });

    // Update database
    await storage.updateHealthSystemStripeCustomer(healthSystemId, customer.id);

    logger.info({ healthSystemId, customerId: customer.id }, 'Created Stripe customer for health system');
    return customer.id;
  }

  async createHealthSystemSubscription(
    customerId: string,
    tier: SubscriptionTier,
    healthSystemId: string
  ): Promise<StripeSubscriptionResult> {
    // Map domain tier to pricing
    const pricingKey = tier as keyof typeof HEALTH_SYSTEM_PRICING;
    const pricing = HEALTH_SYSTEM_PRICING[pricingKey];

    // Create Stripe subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Spectral ${pricing.name} Plan`,
            description: `Up to ${pricing.aiSystemLimit === 999999 ? 'unlimited' : pricing.aiSystemLimit} AI systems`,
          },
          unit_amount: pricing.amount,
          recurring: {
            interval: 'year',
          },
        } as Stripe.SubscriptionCreateParams.Item.PriceData,
      }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      trial_period_days: 30, // 30-day trial
      metadata: {
        healthSystemId,
        tier,
      },
    });

    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    const periodStart = (subscription as any).current_period_start;
    const periodEnd = (subscription as any).current_period_end;

    logger.info({ healthSystemId, subscriptionId: subscription.id, tier }, 'Created Stripe subscription');

    return {
      stripeSubscriptionId: subscription.id,
      clientSecret: paymentIntent.client_secret!,
      currentPeriodStart: periodStart ? new Date(periodStart * 1000) : new Date(),
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : new Date(),
    };
  }

  async cancelSubscription(stripeSubscriptionId: string): Promise<void> {
    await stripe.subscriptions.cancel(stripeSubscriptionId);
    logger.info({ stripeSubscriptionId }, 'Subscription canceled');
  }
}
