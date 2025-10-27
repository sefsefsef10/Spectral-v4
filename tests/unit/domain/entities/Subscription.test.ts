/**
 * Subscription Domain Entity Unit Tests
 * 
 * Tests business logic and rules for subscription management
 */

import { describe, it, expect } from 'vitest';
import { Subscription, SubscriptionTier, SubscriptionStatus } from '@server/domain/entities/Subscription';

describe('Subscription Domain Entity', () => {
  describe('Creation', () => {
    it('should create subscription with 30-day trial', () => {
      const subscription = Subscription.create(
        'sub-1',
        'health-system-1',
        SubscriptionTier.STARTER
      );

      expect(subscription.tier).toBe(SubscriptionTier.STARTER);
      expect(subscription.status).toBe(SubscriptionStatus.TRIALING);
      expect(subscription.stripeSubscriptionId).toBeNull();
      expect(subscription.trialEndsAt).toBeDefined();

      // Trial should end approximately 30 days from now
      const now = new Date();
      const expectedTrialEnd = new Date(now);
      expectedTrialEnd.setDate(expectedTrialEnd.getDate() + 30);

      const actualTrialEnd = subscription.trialEndsAt!;
      const timeDiff = Math.abs(actualTrialEnd.getTime() - expectedTrialEnd.getTime());
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });

    it('should create subscription with annual billing period', () => {
      const subscription = Subscription.create(
        'sub-1',
        'health-system-1',
        SubscriptionTier.PROFESSIONAL
      );

      const periodStart = subscription.currentPeriodStart;
      const periodEnd = subscription.currentPeriodEnd;

      // Period should be approximately 1 year
      const yearInMs = 365 * 24 * 60 * 60 * 1000;
      const periodLength = periodEnd.getTime() - periodStart.getTime();

      expect(periodLength).toBeGreaterThan(yearInMs * 0.99); // Allow for leap years
      expect(periodLength).toBeLessThan(yearInMs * 1.01);
    });
  });

  describe('Tier Limits', () => {
    it('should enforce Starter tier limit: 3 AI systems', () => {
      const subscription = Subscription.create(
        'sub-1',
        'health-system-1',
        SubscriptionTier.STARTER
      );

      const limits = subscription.getTierLimits();
      expect(limits.aiSystems).toBe(3);
    });

    it('should enforce Professional tier limit: 10 AI systems', () => {
      const subscription = Subscription.create(
        'sub-1',
        'health-system-1',
        SubscriptionTier.PROFESSIONAL
      );

      const limits = subscription.getTierLimits();
      expect(limits.aiSystems).toBe(10);
    });

    it('should enforce Enterprise tier limit: unlimited AI systems', () => {
      const subscription = Subscription.create(
        'sub-1',
        'health-system-1',
        SubscriptionTier.ENTERPRISE
      );

      const limits = subscription.getTierLimits();
      expect(limits.aiSystems).toBe(999999);
    });
  });

  describe('Tier Pricing', () => {
    it('should return correct pricing for Starter tier', () => {
      const pricing = Subscription.getTierPricing(SubscriptionTier.STARTER);

      expect(pricing.amount).toBe(7500000); // $75,000 in cents
      expect(pricing.name).toBe('Starter');
      expect(pricing.limits.aiSystems).toBe(3);
    });

    it('should return correct pricing for Professional tier', () => {
      const pricing = Subscription.getTierPricing(SubscriptionTier.PROFESSIONAL);

      expect(pricing.amount).toBe(20000000); // $200,000 in cents
      expect(pricing.name).toBe('Professional');
      expect(pricing.limits.aiSystems).toBe(10);
    });

    it('should return correct pricing for Enterprise tier', () => {
      const pricing = Subscription.getTierPricing(SubscriptionTier.ENTERPRISE);

      expect(pricing.amount).toBe(40000000); // $400,000 in cents
      expect(pricing.name).toBe('Enterprise');
      expect(pricing.limits.aiSystems).toBe(999999);
    });
  });

  describe('Usage Validation', () => {
    it('should allow adding AI system when under Starter limit (0/3)', () => {
      const subscription = Subscription.create(
        'sub-1',
        'health-system-1',
        SubscriptionTier.STARTER
      );

      const result = subscription.canAddAISystem(0);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should allow adding AI system when under Starter limit (2/3)', () => {
      const subscription = Subscription.create(
        'sub-1',
        'health-system-1',
        SubscriptionTier.STARTER
      );

      const result = subscription.canAddAISystem(2);

      expect(result.allowed).toBe(true);
    });

    it('should block adding AI system when at Starter limit (3/3)', () => {
      const subscription = Subscription.create(
        'sub-1',
        'health-system-1',
        SubscriptionTier.STARTER
      );

      const result = subscription.canAddAISystem(3);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("You've reached your plan limit of 3 AI systems. Please upgrade to add more.");
    });

    it('should allow adding AI system when under Professional limit (5/10)', () => {
      const subscription = Subscription.create(
        'sub-1',
        'health-system-1',
        SubscriptionTier.PROFESSIONAL
      );

      const result = subscription.canAddAISystem(5);

      expect(result.allowed).toBe(true);
    });

    it('should block adding AI system when at Professional limit (10/10)', () => {
      const subscription = Subscription.create(
        'sub-1',
        'health-system-1',
        SubscriptionTier.PROFESSIONAL
      );

      const result = subscription.canAddAISystem(10);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("You've reached your plan limit of 10 AI systems. Please upgrade to add more.");
    });

    it('should allow adding AI systems on Enterprise tier (effectively unlimited)', () => {
      const subscription = Subscription.create(
        'sub-1',
        'health-system-1',
        SubscriptionTier.ENTERPRISE
      );

      const result = subscription.canAddAISystem(1000);

      expect(result.allowed).toBe(true);
    });
  });

  describe('Status Management', () => {
    it('should start as trialing', () => {
      const subscription = Subscription.create(
        'sub-1',
        'health-system-1',
        SubscriptionTier.STARTER
      );

      expect(subscription.isActive()).toBe(true); // Trialing counts as active
      expect(subscription.status).toBe(SubscriptionStatus.TRIALING);
    });

    it('should activate subscription and clear trial', () => {
      const subscription = Subscription.create(
        'sub-1',
        'health-system-1',
        SubscriptionTier.STARTER
      );

      subscription.setStripeSubscriptionId('stripe_sub_123');
      subscription.activate();

      expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscription.stripeSubscriptionId).toBe('stripe_sub_123');
      expect(subscription.trialEndsAt).toBeNull(); // Trial cleared
    });

    it('should not activate canceled subscription', () => {
      const subscription = Subscription.reconstitute(
        'sub-1',
        'health-system-1',
        SubscriptionTier.STARTER,
        SubscriptionStatus.CANCELED,
        null,
        new Date(),
        new Date(),
        null,
        new Date()
      );

      expect(() => {
        subscription.activate();
      }).toThrow('Cannot activate a canceled subscription');
    });

    it('should identify active subscriptions', () => {
      const activeSubscription = Subscription.reconstitute(
        'sub-1',
        'health-system-1',
        SubscriptionTier.STARTER,
        SubscriptionStatus.ACTIVE,
        'stripe_sub_123',
        new Date(),
        new Date(),
        null,
        new Date()
      );

      expect(activeSubscription.isActive()).toBe(true);
    });

    it('should identify inactive subscriptions', () => {
      const canceledSubscription = Subscription.reconstitute(
        'sub-1',
        'health-system-1',
        SubscriptionTier.STARTER,
        SubscriptionStatus.CANCELED,
        'stripe_sub_123',
        new Date(),
        new Date(),
        null,
        new Date()
      );

      expect(canceledSubscription.isActive()).toBe(false);
    });

    it('should require payment for past_due status', () => {
      const pastDueSubscription = Subscription.reconstitute(
        'sub-1',
        'health-system-1',
        SubscriptionTier.STARTER,
        SubscriptionStatus.PAST_DUE,
        'stripe_sub_123',
        new Date(),
        new Date(),
        null,
        new Date()
      );

      expect(pastDueSubscription.requiresPayment()).toBe(true);
    });

    it('should require payment for incomplete status', () => {
      const incompleteSubscription = Subscription.reconstitute(
        'sub-1',
        'health-system-1',
        SubscriptionTier.STARTER,
        SubscriptionStatus.INCOMPLETE,
        'stripe_sub_123',
        new Date(),
        new Date(),
        null,
        new Date()
      );

      expect(incompleteSubscription.requiresPayment()).toBe(true);
    });
  });

  describe('Trial Management', () => {
    it('should detect expired trial', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // Yesterday

      const subscription = Subscription.reconstitute(
        'sub-1',
        'health-system-1',
        SubscriptionTier.STARTER,
        SubscriptionStatus.TRIALING,
        null,
        new Date(),
        new Date(),
        pastDate, // Trial ended yesterday
        new Date()
      );

      expect(subscription.isTrialExpired()).toBe(true);
    });

    it('should detect active trial', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15); // 15 days from now

      const subscription = Subscription.reconstitute(
        'sub-1',
        'health-system-1',
        SubscriptionTier.STARTER,
        SubscriptionStatus.TRIALING,
        null,
        new Date(),
        new Date(),
        futureDate,
        new Date()
      );

      expect(subscription.isTrialExpired()).toBe(false);
    });
  });

  describe('Tier Changes', () => {
    it('should allow upgrading from Starter to Professional', () => {
      const subscription = Subscription.create(
        'sub-1',
        'health-system-1',
        SubscriptionTier.STARTER
      );

      subscription.upgradeTo(SubscriptionTier.PROFESSIONAL);

      expect(subscription.tier).toBe(SubscriptionTier.PROFESSIONAL);
    });

    it('should allow upgrading from Professional to Enterprise', () => {
      const subscription = Subscription.create(
        'sub-1',
        'health-system-1',
        SubscriptionTier.PROFESSIONAL
      );

      subscription.upgradeTo(SubscriptionTier.ENTERPRISE);

      expect(subscription.tier).toBe(SubscriptionTier.ENTERPRISE);
    });

    it('should not allow upgrading to same tier', () => {
      const subscription = Subscription.create(
        'sub-1',
        'health-system-1',
        SubscriptionTier.PROFESSIONAL
      );

      expect(() => {
        subscription.upgradeTo(SubscriptionTier.PROFESSIONAL);
      }).toThrow('Cannot upgrade from professional to professional');
    });

    it('should not allow upgrading to lower tier', () => {
      const subscription = Subscription.create(
        'sub-1',
        'health-system-1',
        SubscriptionTier.PROFESSIONAL
      );

      expect(() => {
        subscription.upgradeTo(SubscriptionTier.STARTER);
      }).toThrow('Cannot upgrade from professional to starter');
    });

    it('should allow downgrading from Professional to Starter when usage permits', () => {
      const subscription = Subscription.create(
        'sub-1',
        'health-system-1',
        SubscriptionTier.PROFESSIONAL
      );

      subscription.downgradeTo(SubscriptionTier.STARTER, 2); // 2 AI systems (under Starter limit of 3)

      expect(subscription.tier).toBe(SubscriptionTier.STARTER);
    });

    it('should block downgrading when current usage exceeds new tier limit', () => {
      const subscription = Subscription.create(
        'sub-1',
        'health-system-1',
        SubscriptionTier.PROFESSIONAL
      );

      expect(() => {
        subscription.downgradeTo(SubscriptionTier.STARTER, 5); // 5 AI systems (exceeds Starter limit of 3)
      }).toThrow('Cannot downgrade to starter: current AI system count (5) exceeds tier limit (3)');
    });

    it('should not allow downgrading to higher tier', () => {
      const subscription = Subscription.create(
        'sub-1',
        'health-system-1',
        SubscriptionTier.STARTER
      );

      expect(() => {
        subscription.downgradeTo(SubscriptionTier.PROFESSIONAL, 1);
      }).toThrow('Cannot downgrade from starter to professional');
    });
  });

  describe('Cancellation', () => {
    it('should cancel active subscription', () => {
      const subscription = Subscription.create(
        'sub-1',
        'health-system-1',
        SubscriptionTier.PROFESSIONAL
      );
      subscription.setStripeSubscriptionId('stripe_sub_123');
      subscription.activate();

      subscription.cancel();

      expect(subscription.status).toBe(SubscriptionStatus.CANCELED);
      expect(subscription.isActive()).toBe(false);
    });
  });

  describe('Billing Period Updates', () => {
    it('should update billing period from webhook', () => {
      const subscription = Subscription.create(
        'sub-1',
        'health-system-1',
        SubscriptionTier.PROFESSIONAL
      );

      const newStart = new Date('2025-01-01');
      const newEnd = new Date('2026-01-01');

      subscription.updateBillingPeriod(newStart, newEnd);

      expect(subscription.currentPeriodStart).toEqual(newStart);
      expect(subscription.currentPeriodEnd).toEqual(newEnd);
    });

    it('should update status from webhook', () => {
      const subscription = Subscription.create(
        'sub-1',
        'health-system-1',
        SubscriptionTier.PROFESSIONAL
      );

      subscription.updateStatus(SubscriptionStatus.PAST_DUE);

      expect(subscription.status).toBe(SubscriptionStatus.PAST_DUE);
    });
  });
});
