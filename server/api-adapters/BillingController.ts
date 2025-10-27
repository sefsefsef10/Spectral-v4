/**
 * Billing Controller - API Adapter Layer
 * 
 * Translates HTTP requests/responses to/from Clean Architecture use cases.
 * This adapter sits between Express routes and application use cases.
 */

import { Request, Response } from 'express';
import { CreateHealthSystemSubscriptionUseCase } from '../application/subscriptions/CreateHealthSystemSubscriptionUseCase';
import { CheckUsageLimitsUseCase } from '../application/subscriptions/CheckUsageLimitsUseCase';
import { DrizzleSubscriptionRepository } from '../infrastructure/repositories/DrizzleSubscriptionRepository';
import { StripeGatewayImpl } from '../infrastructure/gateways/StripeGatewayImpl';
import { SubscriptionTier } from '../domain/entities/Subscription';
import { storage } from '../storage';
import { logger } from '../logger';

/**
 * Maps API tier strings to domain SubscriptionTier enum
 */
function mapTierToDomain(tier: string): SubscriptionTier {
  const tierMap: Record<string, SubscriptionTier> = {
    'starter': SubscriptionTier.STARTER,
    'professional': SubscriptionTier.PROFESSIONAL,
    'enterprise': SubscriptionTier.ENTERPRISE,
  };
  
  const mapped = tierMap[tier.toLowerCase()];
  if (!mapped) {
    throw new Error(`Invalid tier: ${tier}`);
  }
  return mapped;
}

/**
 * Controller for Clean Architecture billing operations
 */
export class BillingController {
  private subscriptionRepository: DrizzleSubscriptionRepository;
  private stripeGateway: StripeGatewayImpl;
  
  constructor() {
    this.subscriptionRepository = new DrizzleSubscriptionRepository();
    this.stripeGateway = new StripeGatewayImpl();
  }
  
  /**
   * POST /api/billing/subscriptions/health-system
   * Create health system subscription using Clean Architecture
   */
  async createHealthSystemSubscription(req: Request, res: Response): Promise<void> {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        res.status(401).json({ error: 'User not found' });
        return;
      }
      
      if (!user.healthSystemId) {
        res.status(403).json({ error: 'Only health system users can create health system subscriptions' });
        return;
      }
      
      // Get health system name for Stripe customer
      const healthSystem = await storage.getHealthSystem(user.healthSystemId);
      if (!healthSystem) {
        res.status(404).json({ error: 'Health system not found' });
        return;
      }
      
      const { tier } = req.body;
      const domainTier = mapTierToDomain(tier);
      
      // Execute use case
      const useCase = new CreateHealthSystemSubscriptionUseCase(
        this.subscriptionRepository,
        this.stripeGateway
      );
      
      const result = await useCase.execute({
        healthSystemId: user.healthSystemId,
        healthSystemName: healthSystem.name,
        tier: domainTier,
      });
      
      logger.info({ 
        healthSystemId: user.healthSystemId, 
        tier: domainTier,
        subscriptionId: result.subscriptionId,
      }, 'Health system subscription created (Clean Architecture)');
      
      // Return use case response directly (already in correct format)
      res.json(result);
    } catch (error) {
      logger.error({ error }, 'Failed to create health system subscription (Clean Architecture)');
      
      // Map domain errors to HTTP status codes
      if (error instanceof Error) {
        if (error.message.includes('already has')) {
          res.status(409).json({ error: error.message });
          return;
        }
      }
      
      res.status(500).json({ error: 'Failed to create subscription' });
    }
  }
  
  /**
   * GET /api/billing/usage/ai-systems
   * Check AI system usage limits using Clean Architecture
   */
  async checkAISystemUsageLimits(req: Request, res: Response): Promise<void> {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        res.status(401).json({ error: 'User not found' });
        return;
      }
      
      if (!user.healthSystemId) {
        res.status(403).json({ error: 'Only health system users can check AI system usage' });
        return;
      }
      
      // Get current AI system count from storage
      const aiSystems = await storage.getAISystemsByHealthSystem(user.healthSystemId);
      const currentCount = aiSystems.length;
      
      // Execute use case
      const useCase = new CheckUsageLimitsUseCase(this.subscriptionRepository);
      
      const result = await useCase.execute({
        healthSystemId: user.healthSystemId,
        currentAISystemCount: currentCount,
      });
      
      // Map use case response to API response format
      const isUnlimited = result.limit === -1;
      res.json({
        canAddSystem: result.allowed,
        currentCount: result.currentCount,
        limit: result.limit,
        tier: result.currentTier,
        isUnlimited,
        message: result.allowed 
          ? `You can add ${isUnlimited ? 'unlimited' : result.limit - result.currentCount} more AI systems`
          : (result.reason || `You've reached your limit of ${result.limit} AI systems. Upgrade to add more.`),
      });
    } catch (error) {
      logger.error({ error }, 'Failed to check AI system usage (Clean Architecture)');
      
      // Handle domain-specific errors
      if (error instanceof Error) {
        if (error.message.includes('No subscription found')) {
          res.status(404).json({ error: error.message });
          return;
        }
      }
      
      res.status(500).json({ error: 'Failed to check usage' });
    }
  }
}

// Singleton instance
export const billingController = new BillingController();
