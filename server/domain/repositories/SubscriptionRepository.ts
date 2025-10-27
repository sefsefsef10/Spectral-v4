/**
 * Subscription Repository Interface
 * 
 * Domain layer defines the interface, infrastructure layer implements it.
 * This follows the Dependency Inversion Principle.
 */

import { Subscription } from '../entities/Subscription';

export interface SubscriptionRepository {
  /**
   * Find subscription by ID
   */
  findById(id: string): Promise<Subscription | null>;

  /**
   * Find subscription by health system ID
   */
  findByHealthSystemId(healthSystemId: string): Promise<Subscription | null>;

  /**
   * Save subscription (insert or update)
   */
  save(subscription: Subscription): Promise<Subscription>;

  /**
   * Check if subscription exists
   */
  exists(id: string): Promise<boolean>;
}
