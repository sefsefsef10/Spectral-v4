/**
 * 💰 BILLING API ROUTES
 * 
 * Comprehensive Stripe integration for revenue collection:
 * - Subscription creation (health systems + vendors)
 * - Usage limit enforcement
 * - Webhook processing
 * - Customer portal access
 */

import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import Stripe from 'stripe';
import { stripeBillingService, HEALTH_SYSTEM_PRICING, VENDOR_PRICING } from '../services/stripe-billing';
import { storage } from '../storage';
import { logger } from '../logger';
import { isFeatureEnabled } from '../config/feature-flags';
import { billingController } from '../api-adapters/BillingController';

if (!process.env.STRIPE_SECRET_KEY) {
  logger.warn('STRIPE_SECRET_KEY not set - billing routes will not function');
}

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Validation schemas
const createHealthSystemSubscriptionSchema = z.object({
  tier: z.enum(['starter', 'professional', 'enterprise']),
});

const createVendorSubscriptionSchema = z.object({
  certificationTier: z.enum(['verified', 'certified', 'trusted']),
});

// Middleware to require authentication
function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

export function registerBillingRoutes(app: Express) {
  /**
   * GET /api/billing/pricing
   * Get pricing information for all tiers
   */
  app.get('/api/billing/pricing', (req, res) => {
    res.json({
      healthSystems: HEALTH_SYSTEM_PRICING,
      vendors: VENDOR_PRICING,
    });
  });

  /**
   * POST /api/billing/subscriptions/health-system
   * Create subscription for health system
   * 
   * ⚡ FEATURE FLAG: Uses Clean Architecture implementation when enabled
   */
  app.post('/api/billing/subscriptions/health-system', requireAuth, async (req, res) => {
    // Feature flag: Use Clean Architecture or legacy implementation
    if (isFeatureEnabled('useCleanArchitectureBilling')) {
      return billingController.createHealthSystemSubscription(req, res);
    }
    
    // Legacy implementation (to be deprecated)
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      if (!user.healthSystemId) {
        return res.status(403).json({ error: 'Only health system users can create health system subscriptions' });
      }
      
      const { tier } = createHealthSystemSubscriptionSchema.parse(req.body);
      
      const result = await stripeBillingService.createHealthSystemSubscription(
        user.healthSystemId,
        tier
      );
      
      logger.info({ healthSystemId: user.healthSystemId, tier }, 'Health system subscription created (legacy)');
      
      res.json(result);
    } catch (error) {
      logger.error({ error }, 'Failed to create health system subscription');
      res.status(500).json({ error: 'Failed to create subscription' });
    }
  });

  /**
   * POST /api/billing/subscriptions/vendor
   * Create subscription for vendor
   */
  app.post('/api/billing/subscriptions/vendor', requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      if (!user.vendorId) {
        return res.status(403).json({ error: 'Only vendor users can create vendor subscriptions' });
      }
      
      const { certificationTier } = createVendorSubscriptionSchema.parse(req.body);
      
      const result = await stripeBillingService.createVendorSubscription(
        user.vendorId,
        certificationTier
      );
      
      logger.info({ vendorId: user.vendorId, certificationTier }, 'Vendor subscription created');
      
      res.json(result);
    } catch (error) {
      logger.error({ error }, 'Failed to create vendor subscription');
      res.status(500).json({ error: 'Failed to create subscription' });
    }
  });

  /**
   * GET /api/billing/subscription/status
   * Get current subscription status
   */
  app.get('/api/billing/subscription/status', requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      if (user.healthSystemId) {
        const status = await stripeBillingService.getHealthSystemSubscriptionStatus(user.healthSystemId);
        return res.json({ type: 'health_system', ...status });
      }
      
      if (user.vendorId) {
        const status = await stripeBillingService.getVendorSubscriptionStatus(user.vendorId);
        return res.json({ type: 'vendor', ...status });
      }
      
      res.json({ type: 'none', status: 'no_subscription' });
    } catch (error) {
      logger.error({ error }, 'Failed to get subscription status');
      res.status(500).json({ error: 'Failed to get subscription status' });
    }
  });

  /**
   * GET /api/billing/usage/ai-systems
   * Check usage limits for AI systems
   * 
   * ⚡ FEATURE FLAG: Uses Clean Architecture implementation when enabled
   */
  app.get('/api/billing/usage/ai-systems', requireAuth, async (req, res) => {
    // Feature flag: Use Clean Architecture or legacy implementation
    if (isFeatureEnabled('useCleanArchitectureBilling')) {
      return billingController.checkAISystemUsageLimits(req, res);
    }
    
    // Legacy implementation (to be deprecated)
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      if (!user.healthSystemId) {
        return res.status(403).json({ error: 'Only health system users can check AI system usage' });
      }
      
      const usage = await stripeBillingService.canAddAISystem(user.healthSystemId);
      
      res.json(usage);
    } catch (error) {
      logger.error({ error }, 'Failed to check AI system usage');
      res.status(500).json({ error: 'Failed to check usage' });
    }
  });

  /**
   * POST /api/billing/cancel-subscription
   * Cancel active subscription
   */
  app.post('/api/billing/cancel-subscription', requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      let subscriptionId: string | null = null;
      
      if (user.healthSystemId) {
        const healthSystem = await storage.getHealthSystem(user.healthSystemId);
        subscriptionId = healthSystem?.stripeSubscriptionId || null;
      } else if (user.vendorId) {
        const vendor = await storage.getVendor(user.vendorId);
        subscriptionId = vendor?.stripeSubscriptionId || null;
      }
      
      if (!subscriptionId) {
        return res.status(404).json({ error: 'No active subscription found' });
      }
      
      await stripeBillingService.cancelSubscription(subscriptionId);
      
      logger.info({ subscriptionId, userId: user.id }, 'Subscription canceled');
      
      res.json({ success: true, message: 'Subscription canceled successfully' });
    } catch (error) {
      logger.error({ error }, 'Failed to cancel subscription');
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  });

  /**
   * POST /api/billing/webhooks/stripe
   * Stripe webhook endpoint for subscription events
   */
  app.post('/api/billing/webhooks/stripe', async (req, res) => {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe not configured' });
    }
    
    const sig = req.headers['stripe-signature'];
    
    if (!sig) {
      logger.error('Missing Stripe signature');
      return res.status(400).json({ error: 'Missing signature' });
    }
    
    let event: Stripe.Event;
    
    try {
      // Verify webhook signature (requires raw body)
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );
    } catch (error) {
      logger.error({ error }, 'Stripe webhook signature verification failed');
      return res.status(400).json({ error: 'Invalid signature' });
    }
    
    try {
      // Handle different event types
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          const subscription = event.data.object as Stripe.Subscription;
          await stripeBillingService.handleSubscriptionUpdated(subscription);
          logger.info({ subscriptionId: subscription.id, eventType: event.type }, 'Subscription event processed');
          break;
          
        case 'customer.subscription.deleted':
          const deletedSubscription = event.data.object as Stripe.Subscription;
          await stripeBillingService.handleSubscriptionUpdated(deletedSubscription);
          logger.info({ subscriptionId: deletedSubscription.id }, 'Subscription deleted');
          break;
          
        case 'invoice.payment_succeeded':
          const invoice = event.data.object as Stripe.Invoice;
          logger.info({ invoiceId: invoice.id, customerId: invoice.customer }, 'Payment succeeded');
          break;
          
        case 'invoice.payment_failed':
          const failedInvoice = event.data.object as Stripe.Invoice;
          logger.error({ invoiceId: failedInvoice.id, customerId: failedInvoice.customer }, 'Payment failed');
          break;
          
        default:
          logger.info({ eventType: event.type }, 'Unhandled Stripe webhook event');
      }
      
      res.json({ received: true });
    } catch (error) {
      logger.error({ error, eventType: event.type }, 'Failed to process Stripe webhook');
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });
}
