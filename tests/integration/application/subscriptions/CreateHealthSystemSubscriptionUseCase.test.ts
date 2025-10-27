/**
 * Create Health System Subscription Use Case Tests
 * 
 * Integration tests for the use case using mock repository and gateway
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CreateHealthSystemSubscriptionUseCase } from '@server/application/subscriptions/CreateHealthSystemSubscriptionUseCase';
import { Subscription, SubscriptionTier, SubscriptionStatus } from '@server/domain/entities/Subscription';
import { SubscriptionRepository } from '@server/domain/repositories/SubscriptionRepository';
import { StripeGateway, StripeSubscriptionResult } from '@server/domain/gateways/StripeGateway';

/**
 * In-Memory Repository for Testing
 */
class InMemorySubscriptionRepository implements SubscriptionRepository {
  private subscriptions: Map<string, Subscription> = new Map();

  async findById(id: string): Promise<Subscription | null> {
    return this.subscriptions.get(id) || null;
  }

  async findByHealthSystemId(healthSystemId: string): Promise<Subscription | null> {
    for (const subscription of this.subscriptions.values()) {
      if (subscription.healthSystemId === healthSystemId) {
        return subscription;
      }
    }
    return null;
  }

  async save(subscription: Subscription): Promise<Subscription> {
    this.subscriptions.set(subscription.id, subscription);
    return subscription;
  }

  async exists(id: string): Promise<boolean> {
    return this.subscriptions.has(id);
  }

  clear() {
    this.subscriptions.clear();
  }
}

/**
 * Mock Stripe Gateway for Testing
 */
class MockStripeGateway implements StripeGateway {
  private customers: Map<string, string> = new Map(); // healthSystemId -> customerId

  async getOrCreateHealthSystemCustomer(healthSystemId: string, healthSystemName: string): Promise<string> {
    const existingCustomerId = this.customers.get(healthSystemId);
    if (existingCustomerId) {
      return existingCustomerId;
    }

    const customerId = `cus_${Date.now()}`;
    this.customers.set(healthSystemId, customerId);
    return customerId;
  }

  async createHealthSystemSubscription(
    customerId: string,
    tier: SubscriptionTier,
    healthSystemId: string
  ): Promise<StripeSubscriptionResult> {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setFullYear(periodEnd.getFullYear() + 1); // Annual

    return {
      stripeSubscriptionId: `sub_stripe_${Date.now()}`,
      clientSecret: `pi_secret_${Date.now()}`,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    };
  }

  async cancelSubscription(stripeSubscriptionId: string): Promise<void> {
    // Mock cancellation
  }

  clear() {
    this.customers.clear();
  }
}

describe('CreateHealthSystemSubscriptionUseCase', () => {
  let useCase: CreateHealthSystemSubscriptionUseCase;
  let repository: InMemorySubscriptionRepository;
  let stripeGateway: MockStripeGateway;

  beforeEach(() => {
    repository = new InMemorySubscriptionRepository();
    stripeGateway = new MockStripeGateway();
    useCase = new CreateHealthSystemSubscriptionUseCase(repository, stripeGateway);
  });

  describe('Subscription Creation', () => {
    it('should create Starter tier subscription with trial', async () => {
      const result = await useCase.execute({
        healthSystemId: 'health-1',
        healthSystemName: 'Test Hospital',
        tier: SubscriptionTier.STARTER,
      });

      expect(result.tier).toBe(SubscriptionTier.STARTER);
      expect(result.status).toBe(SubscriptionStatus.TRIALING); // Should start in trial!
      expect(result.clientSecret).toBeDefined();
      expect(result.trialEndsAt).toBeDefined();
      expect(result.currentPeriodEnd).toBeDefined();

      // Verify subscription was saved to repository
      const savedSubscription = await repository.findByHealthSystemId('health-1');
      expect(savedSubscription).not.toBeNull();
      expect(savedSubscription!.tier).toBe(SubscriptionTier.STARTER);
      expect(savedSubscription!.status).toBe(SubscriptionStatus.TRIALING); // Still in trial
    });

    it('should create Professional tier subscription', async () => {
      const result = await useCase.execute({
        healthSystemId: 'health-1',
        healthSystemName: 'Test Hospital',
        tier: SubscriptionTier.PROFESSIONAL,
      });

      expect(result.tier).toBe(SubscriptionTier.PROFESSIONAL);
      expect(result.status).toBe(SubscriptionStatus.TRIALING);
    });

    it('should create Enterprise tier subscription', async () => {
      const result = await useCase.execute({
        healthSystemId: 'health-1',
        healthSystemName: 'Test Hospital',
        tier: SubscriptionTier.ENTERPRISE,
      });

      expect(result.tier).toBe(SubscriptionTier.ENTERPRISE);
      expect(result.status).toBe(SubscriptionStatus.TRIALING);
    });

    it('should activate subscription with Stripe subscription ID', async () => {
      const result = await useCase.execute({
        healthSystemId: 'health-1',
        healthSystemName: 'Test Hospital',
        tier: SubscriptionTier.STARTER,
      });

      const savedSubscription = await repository.findByHealthSystemId('health-1');
      expect(savedSubscription!.stripeSubscriptionId).not.toBeNull();
      expect(savedSubscription!.stripeSubscriptionId).toContain('sub_stripe_');
    });

    it('should set annual billing period', async () => {
      const result = await useCase.execute({
        healthSystemId: 'health-1',
        healthSystemName: 'Test Hospital',
        tier: SubscriptionTier.STARTER,
      });

      const savedSubscription = await repository.findByHealthSystemId('health-1');
      const periodStart = savedSubscription!.currentPeriodStart;
      const periodEnd = savedSubscription!.currentPeriodEnd;

      // Period should be approximately 1 year
      const yearInMs = 365 * 24 * 60 * 60 * 1000;
      const periodLength = periodEnd.getTime() - periodStart.getTime();

      expect(periodLength).toBeGreaterThan(yearInMs * 0.99);
      expect(periodLength).toBeLessThan(yearInMs * 1.01);
    });
  });

  describe('Stripe Integration', () => {
    it('should create or retrieve Stripe customer', async () => {
      // First subscription
      await useCase.execute({
        healthSystemId: 'health-1',
        healthSystemName: 'Test Hospital',
        tier: SubscriptionTier.STARTER,
      });

      // Verify customer was created (idempotency is handled by gateway)
      const customerId = await stripeGateway.getOrCreateHealthSystemCustomer('health-1', 'Test Hospital');
      expect(customerId).toBeDefined();
      expect(customerId).toContain('cus_');
    });
  });

  describe('Error Handling', () => {
    it('should throw error if subscription already exists', async () => {
      // Create first subscription
      await useCase.execute({
        healthSystemId: 'health-1',
        healthSystemName: 'Test Hospital',
        tier: SubscriptionTier.STARTER,
      });

      // Try to create duplicate subscription
      await expect(
        useCase.execute({
          healthSystemId: 'health-1',
          healthSystemName: 'Test Hospital',
          tier: SubscriptionTier.PROFESSIONAL,
        })
      ).rejects.toThrow('Health system health-1 already has a subscription');
    });
  });

  describe('Response Structure', () => {
    it('should return complete subscription details', async () => {
      const result = await useCase.execute({
        healthSystemId: 'health-1',
        healthSystemName: 'Test Hospital',
        tier: SubscriptionTier.STARTER,
      });

      expect(result).toHaveProperty('subscriptionId');
      expect(result).toHaveProperty('clientSecret');
      expect(result).toHaveProperty('tier');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('trialEndsAt');
      expect(result).toHaveProperty('currentPeriodEnd');

      expect(result.subscriptionId).toBeDefined();
      expect(result.clientSecret).toBeDefined();
    });
  });
});
