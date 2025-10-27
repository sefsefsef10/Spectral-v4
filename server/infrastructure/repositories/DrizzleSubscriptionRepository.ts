/**
 * Drizzle Subscription Repository
 * 
 * Infrastructure layer implementation of SubscriptionRepository interface.
 * Maps between Subscription domain entities and database persistence.
 */

import { db } from '@server/db';
import { healthSystems } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { Subscription, SubscriptionTier, SubscriptionStatus } from '@server/domain/entities/Subscription';
import { SubscriptionRepository } from '@server/domain/repositories/SubscriptionRepository';

export class DrizzleSubscriptionRepository implements SubscriptionRepository {
  async findById(id: string): Promise<Subscription | null> {
    // Find by subscription ID (not health system ID)
    const rows = await db
      .select()
      .from(healthSystems)
      .where(eq(healthSystems.subscriptionId, id));

    if (rows.length === 0) {
      return null;
    }

    return this.toDomain(rows[0]);
  }

  async findByHealthSystemId(healthSystemId: string): Promise<Subscription | null> {
    const [row] = await db
      .select()
      .from(healthSystems)
      .where(eq(healthSystems.id, healthSystemId));

    if (!row || !row.subscriptionTier) {
      return null;
    }

    return this.toDomain(row);
  }

  async save(subscription: Subscription): Promise<Subscription> {
    const data = this.toDatabase(subscription);

    // Update health system with subscription details
    const [updated] = await db
      .update(healthSystems)
      .set(data)
      .where(eq(healthSystems.id, subscription.healthSystemId))
      .returning();

    return this.toDomain(updated);
  }

  async exists(id: string): Promise<boolean> {
    // Check by subscription ID (not health system ID)
    const rows = await db
      .select({ subscriptionId: healthSystems.subscriptionId })
      .from(healthSystems)
      .where(eq(healthSystems.subscriptionId, id));

    return rows.length > 0 && rows[0].subscriptionId !== null;
  }

  /**
   * Map database row to domain entity
   */
  private toDomain(row: any): Subscription {
    // Handle missing subscription data (defaults to Starter)
    const tier = (row.subscriptionTier as SubscriptionTier) || SubscriptionTier.STARTER;
    const status = (row.subscriptionStatus as SubscriptionStatus) || SubscriptionStatus.TRIALING;

    return Subscription.reconstitute(
      row.subscriptionId || row.id, // Use subscription_id if available, fallback to health system id
      row.id, // healthSystemId
      tier,
      status,
      row.stripeSubscriptionId || null,
      row.currentPeriodStart || new Date(),
      row.currentPeriodEnd || new Date(),
      row.trialEndsAt || null,
      row.createdAt || new Date()
    );
  }

  /**
   * Map domain entity to database model
   */
  private toDatabase(subscription: Subscription): any {
    return {
      subscriptionId: subscription.id, // Store unique subscription ID
      subscriptionTier: subscription.tier,
      subscriptionStatus: subscription.status,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEndsAt: subscription.trialEndsAt,
      aiSystemLimit: subscription.getTierLimits().aiSystems,
    };
  }
}
