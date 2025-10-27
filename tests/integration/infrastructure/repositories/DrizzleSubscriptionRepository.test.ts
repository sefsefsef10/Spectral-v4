/**
 * Drizzle Subscription Repository Integration Tests
 * 
 * Tests verify round-trip persistence (entity → database → entity)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DrizzleSubscriptionRepository } from '@server/infrastructure/repositories/DrizzleSubscriptionRepository';
import { Subscription, SubscriptionTier, SubscriptionStatus } from '@server/domain/entities/Subscription';
import { storage } from '@server/storage';

describe('DrizzleSubscriptionRepository (Integration)', () => {
  let repository: DrizzleSubscriptionRepository;

  beforeEach(() => {
    repository = new DrizzleSubscriptionRepository();
  });

  describe('Round-trip Persistence', () => {
    it('should save and retrieve Starter tier subscription', async () => {
      // Create health system first
      const healthSystem = await storage.createHealthSystem({
        name: 'Test Hospital',
      });

      // Create subscription
      const subscription = Subscription.create(
        healthSystem.id,
        healthSystem.id,
        SubscriptionTier.STARTER
      );
      subscription.setStripeSubscriptionId('sub_test_123');

      // Save to database
      const saved = await repository.save(subscription);
      expect(saved.id).toBe(subscription.id); // Subscription ID preserved

      // Retrieve from database by health system ID
      const retrieved = await repository.findByHealthSystemId(healthSystem.id);

      // Verify round-trip fidelity
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(subscription.id); // Subscription ID matches
      expect(retrieved!.tier).toBe(SubscriptionTier.STARTER);
      expect(retrieved!.status).toBe(SubscriptionStatus.TRIALING);
      expect(retrieved!.stripeSubscriptionId).toBe('sub_test_123');
      expect(retrieved!.getTierLimits().aiSystems).toBe(3);
    });

    it('should persist unique subscription ID (not health system ID)', async () => {
      const healthSystem = await storage.createHealthSystem({
        name: 'ID Test Hospital',
      });

      // Create subscription with generated ID
      const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const subscription = Subscription.reconstitute(
        subscriptionId,
        healthSystem.id,
        SubscriptionTier.PROFESSIONAL,
        SubscriptionStatus.TRIALING,
        null,
        new Date(),
        new Date(),
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        new Date()
      );

      // Verify subscription ID is different from health system ID
      expect(subscription.id).not.toBe(healthSystem.id);
      expect(subscription.id).toContain('sub_'); // Should be a subscription ID

      const saved = await repository.save(subscription);

      // Verify saved subscription ID matches original
      expect(saved.id).toBe(subscription.id);
      expect(saved.id).not.toBe(healthSystem.id);
    });

    it('should find subscription by subscription ID', async () => {
      const healthSystem = await storage.createHealthSystem({
        name: 'FindById Test Hospital',
      });

      const subscription = Subscription.create(
        healthSystem.id,
        healthSystem.id,
        SubscriptionTier.ENTERPRISE
      );

      await repository.save(subscription);

      // Find by subscription ID (not health system ID)
      const found = await repository.findById(subscription.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(subscription.id);
      expect(found!.healthSystemId).toBe(healthSystem.id);
      expect(found!.tier).toBe(SubscriptionTier.ENTERPRISE);
    });

    it('should save and retrieve Professional tier subscription', async () => {
      const healthSystem = await storage.createHealthSystem({
        name: 'Professional Hospital',
      });

      const subscription = Subscription.create(
        healthSystem.id,
        healthSystem.id,
        SubscriptionTier.PROFESSIONAL
      );
      subscription.setStripeSubscriptionId('sub_professional_123');

      await repository.save(subscription);
      const retrieved = await repository.findByHealthSystemId(healthSystem.id);

      expect(retrieved!.tier).toBe(SubscriptionTier.PROFESSIONAL);
      expect(retrieved!.getTierLimits().aiSystems).toBe(10);
    });

    it('should save and retrieve Enterprise tier subscription', async () => {
      const healthSystem = await storage.createHealthSystem({
        name: 'Enterprise Hospital',
      });

      const subscription = Subscription.create(
        healthSystem.id,
        healthSystem.id,
        SubscriptionTier.ENTERPRISE
      );

      await repository.save(subscription);
      const retrieved = await repository.findByHealthSystemId(healthSystem.id);

      expect(retrieved!.tier).toBe(SubscriptionTier.ENTERPRISE);
      expect(retrieved!.getTierLimits().aiSystems).toBe(999999);
    });

    it('should update existing subscription (upsert logic)', async () => {
      const healthSystem = await storage.createHealthSystem({
        name: 'Update Test Hospital',
      });

      // Create and save initial subscription
      const subscription = Subscription.create(
        healthSystem.id,
        healthSystem.id,
        SubscriptionTier.STARTER
      );
      await repository.save(subscription);

      // Activate and update
      subscription.setStripeSubscriptionId('sub_activated_123');
      subscription.activate();

      // Save updates
      await repository.save(subscription);

      // Verify updates persisted
      const retrieved = await repository.findByHealthSystemId(healthSystem.id);
      expect(retrieved!.status).toBe(SubscriptionStatus.ACTIVE);
      expect(retrieved!.stripeSubscriptionId).toBe('sub_activated_123');
      expect(retrieved!.trialEndsAt).toBeNull(); // Trial cleared after activation
    });

    it('should preserve billing period dates', async () => {
      const healthSystem = await storage.createHealthSystem({
        name: 'Billing Period Hospital',
      });

      const subscription = Subscription.create(
        healthSystem.id,
        healthSystem.id,
        SubscriptionTier.PROFESSIONAL
      );

      const periodStart = new Date('2025-01-01');
      const periodEnd = new Date('2026-01-01');
      subscription.updateBillingPeriod(periodStart, periodEnd);

      await repository.save(subscription);
      const retrieved = await repository.findByHealthSystemId(healthSystem.id);

      expect(retrieved!.currentPeriodStart.toISOString()).toBe(periodStart.toISOString());
      expect(retrieved!.currentPeriodEnd.toISOString()).toBe(periodEnd.toISOString());
    });
  });

  describe('Query Methods', () => {
    it('should return null for non-existent health system', async () => {
      const retrieved = await repository.findByHealthSystemId('non-existent-id');
      expect(retrieved).toBeNull();
    });

    it('should return null for health system without subscription', async () => {
      const healthSystem = await storage.createHealthSystem({
        name: 'No Subscription Hospital',
      });

      const retrieved = await repository.findByHealthSystemId(healthSystem.id);
      expect(retrieved).toBeNull();
    });

    it('should check existence correctly', async () => {
      const healthSystem = await storage.createHealthSystem({
        name: 'Exists Test Hospital',
      });

      const existsBefore = await repository.exists(healthSystem.id);
      expect(existsBefore).toBe(true); // Health system exists

      const existsInvalid = await repository.exists('non-existent-id');
      expect(existsInvalid).toBe(false);
    });
  });

  describe('AI System Limit Persistence', () => {
    it('should persist aiSystemLimit based on tier', async () => {
      const healthSystem = await storage.createHealthSystem({
        name: 'Limit Test Hospital',
      });

      const subscription = Subscription.create(
        healthSystem.id,
        healthSystem.id,
        SubscriptionTier.PROFESSIONAL
      );

      await repository.save(subscription);

      // Check database directly
      const dbHealthSystem = await storage.getHealthSystem(healthSystem.id);
      expect(dbHealthSystem!.aiSystemLimit).toBe(10); // Professional tier limit
    });

    it('should update aiSystemLimit when tier changes', async () => {
      const healthSystem = await storage.createHealthSystem({
        name: 'Upgrade Test Hospital',
      });

      // Start with Starter
      const subscription = Subscription.create(
        healthSystem.id,
        healthSystem.id,
        SubscriptionTier.STARTER
      );
      await repository.save(subscription);

      let dbHealthSystem = await storage.getHealthSystem(healthSystem.id);
      expect(dbHealthSystem!.aiSystemLimit).toBe(3);

      // Upgrade to Professional
      subscription.upgradeTo(SubscriptionTier.PROFESSIONAL);
      await repository.save(subscription);

      dbHealthSystem = await storage.getHealthSystem(healthSystem.id);
      expect(dbHealthSystem!.aiSystemLimit).toBe(10);
    });
  });
});
