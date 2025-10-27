/**
 * DOMAIN LAYER: User Repository Interface
 * 
 * Centralized repository interface for User entity persistence.
 * Implements Repository pattern with dependency inversion principle.
 */

import { User } from '../entities/User';

export interface IUserRepository {
  /**
   * Persist user with hashed password
   */
  saveWithPassword(user: User, hashedPassword: string): Promise<void>;

  /**
   * Persist user changes
   */
  save(user: User): Promise<void>;

  /**
   * Find user by unique identifier
   */
  findById(id: string): Promise<User | null>;

  /**
   * Find user by email address
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Check if user exists by ID
   */
  exists(id: string): Promise<boolean>;
}
