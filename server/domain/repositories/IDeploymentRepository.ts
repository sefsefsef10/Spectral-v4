/**
 * DOMAIN LAYER: Deployment Repository Interface
 * 
 * Centralized repository interface for Deployment entity persistence.
 * Implements Repository pattern with dependency inversion principle.
 */

import { Deployment } from '../entities/Deployment';

export interface IDeploymentRepository {
  /**
   * Persist deployment
   */
  save(deployment: Deployment): Promise<void>;

  /**
   * Find deployment by unique identifier
   */
  findById(id: string): Promise<Deployment | null>;

  /**
   * Find all deployments for an AI system
   */
  findByAiSystemId(aiSystemId: string): Promise<Deployment[]>;

  /**
   * Find all deployments (for listing/filtering)
   */
  findAll(): Promise<Deployment[]>;

  /**
   * Check if deployment exists by ID
   */
  exists(id: string): Promise<boolean>;
}
