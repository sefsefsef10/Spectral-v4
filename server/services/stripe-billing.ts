/**
 * 💰 STRIPE BILLING SERVICE
 * 
 * Comprehensive billing infrastructure for revenue collection:
 * - Health System subscriptions: $75K/$200K/$400K (Starter/Professional/Enterprise)
 * - Vendor certifications: $15K/$50K/$100K (Verified/Certified/Trusted)
 * - Usage metering, tier limits, automatic upgrades
 */

import Stripe from 'stripe';
import { storage } from '../storage';
import { logger } from '../logger';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const stripeKey = IS_PRODUCTION
  ? process.env.STRIPE_SECRET_KEY
  : process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY;

if (!stripeKey) {
  throw new Error(`Stripe key required for ${process.env.NODE_ENV} environment`);
}

export const stripe = new Stripe(stripeKey, {
  apiVersion: '2024-11-20.acacia',
  typescript: true,
});

logger.info({ 
  mode: process.env.NODE_ENV,
  testMode: !IS_PRODUCTION 
}, 'Stripe initialized');

// Pricing tiers (annual pricing in cents)
export const HEALTH_SYSTEM_PRICING = {
  starter: { amount: 75000_00, aiSystemLimit: 3, name: 'Starter' },
  professional: { amount: 200000_00, aiSystemLimit: 10, name: 'Professional' },
  enterprise: { amount: 400000_00, aiSystemLimit: 999999, name: 'Enterprise' },
} as const;

export const VENDOR_PRICING = {
  verified: { amount: 15000_00, tier: 'verified', name: 'Verified' },
  certified: { amount: 50000_00, tier: 'certified', name: 'Certified' },
  trusted: { amount: 100000_00, tier: 'trusted', name: 'Trusted' },
} as const;

export class StripeBillingService {
  /**
   * Create or retrieve Stripe customer for health system
   */
  async getOrCreateHealthSystemCustomer(healthSystemId: string): Promise<string> {
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
      name: healthSystem.name,
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
  
  /**
   * Create or retrieve Stripe customer for vendor
   */
  async getOrCreateVendorCustomer(vendorId: string): Promise<string> {
    const vendor = await storage.getVendor(vendorId);
    if (!vendor) {
      throw new Error(`Vendor ${vendorId} not found`);
    }
    
    if (vendor.stripeCustomerId) {
      return vendor.stripeCustomerId;
    }
    
    const customer = await stripe.customers.create({
      name: vendor.name,
      email: vendor.website, // Use website as placeholder
      metadata: {
        vendorId,
        type: 'vendor',
      },
    });
    
    await storage.updateVendorStripeCustomer(vendorId, customer.id);
    
    logger.info({ vendorId, customerId: customer.id }, 'Created Stripe customer for vendor');
    return customer.id;
  }
  
  /**
   * Create health system subscription
   */
  async createHealthSystemSubscription(
    healthSystemId: string,
    tier: keyof typeof HEALTH_SYSTEM_PRICING
  ): Promise<{ clientSecret: string; subscriptionId: string }> {
    const customerId = await this.getOrCreateHealthSystemCustomer(healthSystemId);
    const pricing = HEALTH_SYSTEM_PRICING[tier];
    
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
    
    // Update database with subscription details
    const periodStart = (subscription as any).current_period_start;
    const periodEnd = (subscription as any).current_period_end;
    const trialEnd = (subscription as any).trial_end;
    
    await storage.updateHealthSystemSubscription(healthSystemId, {
      stripeSubscriptionId: subscription.id,
      subscriptionTier: tier,
      subscriptionStatus: subscription.status,
      currentPeriodStart: periodStart ? new Date(periodStart * 1000) : new Date(),
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : new Date(),
      trialEndsAt: trialEnd ? new Date(trialEnd * 1000) : null,
      aiSystemLimit: pricing.aiSystemLimit,
    });
    
    logger.info({ healthSystemId, subscriptionId: subscription.id, tier }, 'Created health system subscription');
    
    return {
      clientSecret: paymentIntent.client_secret!,
      subscriptionId: subscription.id,
    };
  }
  
  /**
   * Create vendor certification subscription
   */
  async createVendorSubscription(
    vendorId: string,
    certificationTier: keyof typeof VENDOR_PRICING
  ): Promise<{ clientSecret: string; subscriptionId: string }> {
    const customerId = await this.getOrCreateVendorCustomer(vendorId);
    const pricing = VENDOR_PRICING[certificationTier];
    
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Spectral ${pricing.name} Certification`,
            description: `Annual ${pricing.tier} tier certification`,
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
      metadata: {
        vendorId,
        certificationTier,
      },
    });
    
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;
    
    // Calculate certification expiry (1 year from now)
    const certificationExpiresAt = new Date();
    certificationExpiresAt.setFullYear(certificationExpiresAt.getFullYear() + 1);
    
    const periodStart = (subscription as any).current_period_start;
    const periodEnd = (subscription as any).current_period_end;
    
    await storage.updateVendorSubscription(vendorId, {
      stripeSubscriptionId: subscription.id,
      certificationTier,
      subscriptionStatus: subscription.status,
      currentPeriodStart: periodStart ? new Date(periodStart * 1000) : new Date(),
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : new Date(),
      certificationExpiresAt,
    });
    
    logger.info({ vendorId, subscriptionId: subscription.id, certificationTier }, 'Created vendor subscription');
    
    return {
      clientSecret: paymentIntent.client_secret!,
      subscriptionId: subscription.id,
    };
  }
  
  /**
   * Check if health system can add more AI systems (tier limits)
   */
  async canAddAISystem(healthSystemId: string): Promise<{ allowed: boolean; limit: number; current: number; message?: string }> {
    const healthSystem = await storage.getHealthSystem(healthSystemId);
    if (!healthSystem) {
      throw new Error(`Health system ${healthSystemId} not found`);
    }
    
    const aiSystemLimit = healthSystem.aiSystemLimit || 3; // Default to starter
    const aiSystems = await storage.getAISystemsByHealthSystem(healthSystemId);
    const currentCount = aiSystems.length;
    
    if (currentCount >= aiSystemLimit) {
      return {
        allowed: false,
        limit: aiSystemLimit,
        current: currentCount,
        message: `You've reached your plan limit of ${aiSystemLimit} AI systems. Please upgrade to add more.`,
      };
    }
    
    return {
      allowed: true,
      limit: aiSystemLimit,
      current: currentCount,
    };
  }
  
  /**
   * Get subscription status for health system
   */
  async getHealthSystemSubscriptionStatus(healthSystemId: string) {
    const healthSystem = await storage.getHealthSystem(healthSystemId);
    if (!healthSystem) {
      throw new Error(`Health system ${healthSystemId} not found`);
    }
    
    const aiSystems = await storage.getAISystemsByHealthSystem(healthSystemId);
    
    return {
      subscriptionId: healthSystem.stripeSubscriptionId,
      tier: healthSystem.subscriptionTier || 'none',
      status: healthSystem.subscriptionStatus || 'none',
      aiSystemLimit: healthSystem.aiSystemLimit || 3,
      aiSystemCount: aiSystems.length,
      currentPeriodEnd: healthSystem.currentPeriodEnd,
      trialEndsAt: healthSystem.trialEndsAt,
    };
  }
  
  /**
   * Get subscription status for vendor
   */
  async getVendorSubscriptionStatus(vendorId: string) {
    const vendor = await storage.getVendor(vendorId);
    if (!vendor) {
      throw new Error(`Vendor ${vendorId} not found`);
    }
    
    return {
      subscriptionId: vendor.stripeSubscriptionId,
      certificationTier: vendor.certificationTier || 'none',
      status: vendor.subscriptionStatus || 'none',
      currentPeriodEnd: vendor.currentPeriodEnd,
      certificationExpiresAt: vendor.certificationExpiresAt,
    };
  }
  
  /**
   * Handle Stripe webhook for subscription updates
   */
  async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const metadata = subscription.metadata;
    const periodStart = (subscription as any).current_period_start;
    const periodEnd = (subscription as any).current_period_end;
    
    if (metadata.healthSystemId) {
      // Update health system subscription
      await storage.updateHealthSystemSubscription(metadata.healthSystemId, {
        subscriptionStatus: subscription.status,
        currentPeriodStart: periodStart ? new Date(periodStart * 1000) : new Date(),
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : new Date(),
      });
      
      logger.info({ healthSystemId: metadata.healthSystemId, status: subscription.status }, 'Health system subscription updated');
    } else if (metadata.vendorId) {
      // Update vendor subscription
      await storage.updateVendorSubscription(metadata.vendorId, {
        subscriptionStatus: subscription.status,
        currentPeriodStart: periodStart ? new Date(periodStart * 1000) : new Date(),
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : new Date(),
      });
      
      logger.info({ vendorId: metadata.vendorId, status: subscription.status }, 'Vendor subscription updated');
    }
  }
  
  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string) {
    const subscription = await stripe.subscriptions.cancel(subscriptionId);
    
    logger.info({ subscriptionId }, 'Subscription canceled');
    return subscription;
  }
}

export const stripeBillingService = new StripeBillingService();
