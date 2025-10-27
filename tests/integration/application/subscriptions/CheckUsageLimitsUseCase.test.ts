/**
 * Check Usage Limits Use Case Tests
 * 
 * Integration tests for the use case using in-memory repository
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CheckUsageLimitsUseCase } from '@server/application/subscriptions/CheckUsageLimitsUseCase';
import { Subscription, SubscriptionTier } from '@server/domain/entities/Subscription';
import { SubscriptionRepository } from '@server/domain/repositories/SubscriptionRepository';

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

  // Test helper
  clear() {
    this.subscriptions.clear();
  }
}

describe('CheckUsageLimitsUseCase', () => {
  let useCase: CheckUsageLimitsUseCase;
  let repository: InMemorySubscriptionRepository;

  beforeEach(() => {
    repository = new InMemorySubscriptionRepository();
    useCase = new CheckUsageLimitsUseCase(repository);
  });

  describe('Starter Tier Limits', () => {
    it('should allow adding AI system when under limit (0/3)', async () => {
      const subscription = Subscription.create('sub-1', 'health-1', SubscriptionTier.STARTER);
      await repository.save(subscription);

      const result = await useCase.execute({
        healthSystemId: 'health-1',
        currentAISystemCount: 0,
      });

      expect(result.allowed).toBe(true);
      expect(result.currentTier).toBe(SubscriptionTier.STARTER);
      expect(result.limit).toBe(3);
      expect(result.currentCount).toBe(0);
      expect(result.reason).toBeUndefined();
    });

    it('should allow adding AI system when under limit (2/3)', async () => {
      const subscription = Subscription.create('sub-1', 'health-1', SubscriptionTier.STARTER);
      await repository.save(subscription);

      const result = await useCase.execute({
        healthSystemId: 'health-1',
        currentAISystemCount: 2,
      });

      expect(result.allowed).toBe(true);
      expect(result.currentCount).toBe(2);
    });

    it('should block adding AI system when at limit (3/3)', async () => {
      const subscription = Subscription.create('sub-1', 'health-1', SubscriptionTier.STARTER);
      await repository.save(subscription);

      const result = await useCase.execute({
        healthSystemId: 'health-1',
        currentAISystemCount: 3,
      });

      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(3);
      expect(result.currentCount).toBe(3);
      expect(result.reason).toBe("You've reached your plan limit of 3 AI systems. Please upgrade to add more.");
    });

    it('should default to Starter limits when no subscription exists', async () => {
      const result = await useCase.execute({
        healthSystemId: 'health-no-sub',
        currentAISystemCount: 0,
      });

      expect(result.allowed).toBe(true);
      expect(result.currentTier).toBe(SubscriptionTier.STARTER);
      expect(result.limit).toBe(3);
    });

    it('should enforce Starter limits when no subscription exists (at limit)', async () => {
      const result = await useCase.execute({
        healthSystemId: 'health-no-sub',
        currentAISystemCount: 3,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("You've reached your plan limit of 3 AI systems. Please upgrade to add more.");
    });
  });

  describe('Professional Tier Limits', () => {
    it('should allow adding AI system when under limit (5/10)', async () => {
      const subscription = Subscription.create('sub-1', 'health-1', SubscriptionTier.PROFESSIONAL);
      await repository.save(subscription);

      const result = await useCase.execute({
        healthSystemId: 'health-1',
        currentAISystemCount: 5,
      });

      expect(result.allowed).toBe(true);
      expect(result.currentTier).toBe(SubscriptionTier.PROFESSIONAL);
      expect(result.limit).toBe(10);
      expect(result.currentCount).toBe(5);
    });

    it('should block adding AI system when at limit (10/10)', async () => {
      const subscription = Subscription.create('sub-1', 'health-1', SubscriptionTier.PROFESSIONAL);
      await repository.save(subscription);

      const result = await useCase.execute({
        healthSystemId: 'health-1',
        currentAISystemCount: 10,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("You've reached your plan limit of 10 AI systems. Please upgrade to add more.");
    });
  });

  describe('Enterprise Tier Limits', () => {
    it('should allow unlimited AI systems for Enterprise tier', async () => {
      const subscription = Subscription.create('sub-1', 'health-1', SubscriptionTier.ENTERPRISE);
      await repository.save(subscription);

      const result = await useCase.execute({
        healthSystemId: 'health-1',
        currentAISystemCount: 1000,
      });

      expect(result.allowed).toBe(true);
      expect(result.currentTier).toBe(SubscriptionTier.ENTERPRISE);
      expect(result.limit).toBe(999999);
      expect(result.currentCount).toBe(1000);
    });

    it('should allow even very high AI system counts for Enterprise', async () => {
      const subscription = Subscription.create('sub-1', 'health-1', SubscriptionTier.ENTERPRISE);
      await repository.save(subscription);

      const result = await useCase.execute({
        healthSystemId: 'health-1',
        currentAISystemCount: 50000,
      });

      expect(result.allowed).toBe(true);
    });
  });
});
