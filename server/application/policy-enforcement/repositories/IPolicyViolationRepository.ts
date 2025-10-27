/**
 * APPLICATION LAYER: Policy Violation Repository Interface
 * 
 * Port for policy violation persistence (Infrastructure layer implements this).
 */

export interface PolicyViolationData {
  id?: string;
  healthSystemId: string;
  policyRuleId: string;
  aiSystemId: string;
  violationType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  actionRequired: string;
  actionTaken?: string | null;
  resolvedAt?: Date | null;
  createdAt?: Date;
}

export interface IPolicyViolationRepository {
  /**
   * Log a new policy violation
   */
  create(violation: Omit<PolicyViolationData, 'id' | 'createdAt'>): Promise<PolicyViolationData>;

  /**
   * Find violations by AI system
   */
  findByAISystem(aiSystemId: string): Promise<PolicyViolationData[]>;

  /**
   * Find violations by health system
   */
  findByHealthSystem(healthSystemId: string): Promise<PolicyViolationData[]>;

  /**
   * Find unresolved violations
   */
  findUnresolved(healthSystemId: string): Promise<PolicyViolationData[]>;

  /**
   * Mark violation as resolved
   */
  resolve(id: string, actionTaken: string): Promise<PolicyViolationData>;
}
