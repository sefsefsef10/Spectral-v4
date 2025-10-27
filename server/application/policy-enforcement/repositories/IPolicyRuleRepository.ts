/**
 * APPLICATION LAYER: Policy Rule Repository Interface
 * 
 * Port for policy rule persistence (Infrastructure layer implements this).
 */

import type { PolicyRule } from '../../../domain/entities/PolicyRule';

export interface IPolicyRuleRepository {
  /**
   * Save a new policy rule
   */
  create(policyRule: PolicyRule): Promise<PolicyRule>;

  /**
   * Find policy rule by ID
   */
  findById(id: string): Promise<PolicyRule | null>;

  /**
   * Find all active policies for a health system
   */
  findActiveByHealthSystem(healthSystemId: string): Promise<PolicyRule[]>;

  /**
   * Find all policies (active and inactive) for a health system
   */
  findAllByHealthSystem(healthSystemId: string): Promise<PolicyRule[]>;

  /**
   * Update an existing policy rule
   */
  update(policyRule: PolicyRule): Promise<PolicyRule>;

  /**
   * Delete a policy rule
   */
  delete(id: string): Promise<void>;
}
