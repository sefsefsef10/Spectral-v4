/**
 * DOMAIN LAYER: Rate Limit Policy Repository Interface
 * 
 * Centralized repository interface for RateLimitPolicy entity persistence.
 * Implements Repository pattern with dependency inversion principle.
 */

import { RateLimitPolicy } from '../entities/RateLimitPolicy';

export interface IRateLimitPolicyRepository {
  /**
   * Persist rate limit policy
   */
  save(policy: RateLimitPolicy): Promise<void>;

  /**
   * Find policy by unique identifier
   */
  findById(id: string): Promise<RateLimitPolicy | null>;

  /**
   * Find policy by API key
   */
  findByApiKey(apiKey: string): Promise<RateLimitPolicy | null>;

  /**
   * Check if policy exists by ID
   */
  exists(id: string): Promise<boolean>;
}
