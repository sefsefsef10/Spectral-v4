/**
 * DOMAIN ENTITY: PolicyRule
 * 
 * Represents a governance policy rule for AI system compliance.
 * Encapsulates business logic for policy enforcement and evaluation.
 */

export type PolicyType = 'approval_required' | 'prohibited' | 'restricted' | 'monitored';
export type PolicyScope = 'all_ai' | 'department' | 'category' | 'vendor';
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ScopeFilter {
  departments?: string[];
  categories?: string[];
  vendorIds?: string[];
  riskLevels?: RiskLevel[];
}

export interface PolicyConditions {
  minRiskScore?: number;
  maxRiskScore?: number;
  requiresCertification?: boolean;
  requiredFrameworks?: string[];
}

export interface EnforcementActions {
  blockDeployment?: boolean;
  requireApproval?: boolean;
  sendAlert?: boolean;
  restrictAccess?: boolean;
  escalateToAdmin?: boolean;
}

export interface ApprovalWorkflow {
  approvers: string[]; // User IDs
  requireAllApprovals?: boolean;
  escalationTimeout?: number; // Hours
}

export interface PolicyRuleProps {
  id?: string;
  healthSystemId: string;
  policyName: string;
  policyType: PolicyType;
  scope: PolicyScope;
  scopeFilter?: ScopeFilter;
  conditions?: PolicyConditions;
  enforcementActions: EnforcementActions;
  approvalWorkflow?: ApprovalWorkflow;
  active?: boolean;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AISystemForEvaluation {
  id: string;
  healthSystemId: string;
  name: string;
  department?: string | null;
  category?: string | null;
  vendorId?: string | null;
  riskLevel: RiskLevel;
}

export interface PolicyViolationResult {
  violationType: string;
  severity: SeverityLevel;
  actionRequired: string;
}

/**
 * PolicyRule Domain Entity
 * 
 * Pure business logic for policy enforcement with zero infrastructure dependencies.
 */
export class PolicyRule {
  private readonly props: Required<Omit<PolicyRuleProps, 'id' | 'scopeFilter' | 'conditions' | 'approvalWorkflow'>> & {
    id?: string;
    scopeFilter?: ScopeFilter;
    conditions?: PolicyConditions;
    approvalWorkflow?: ApprovalWorkflow;
  };

  private constructor(props: PolicyRuleProps) {
    this.props = {
      id: props.id,
      healthSystemId: props.healthSystemId,
      policyName: props.policyName,
      policyType: props.policyType,
      scope: props.scope,
      scopeFilter: props.scopeFilter,
      conditions: props.conditions,
      enforcementActions: props.enforcementActions,
      approvalWorkflow: props.approvalWorkflow,
      active: props.active ?? true,
      createdBy: props.createdBy,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };
  }

  /**
   * Factory: Create new policy rule
   */
  static create(props: Omit<PolicyRuleProps, 'id' | 'createdAt' | 'updatedAt'>): PolicyRule {
    PolicyRule.validate(props);
    return new PolicyRule(props);
  }

  /**
   * Factory: Reconstitute from persistence
   */
  static from(props: PolicyRuleProps): PolicyRule {
    if (!props.id) {
      throw new Error('PolicyRule.from() requires an id');
    }
    return new PolicyRule(props);
  }

  /**
   * Validate policy rule configuration
   */
  private static validate(props: Omit<PolicyRuleProps, 'id' | 'createdAt' | 'updatedAt'>): void {
    if (!props.policyName || props.policyName.trim().length === 0) {
      throw new Error('Policy name cannot be empty');
    }

    if (!props.healthSystemId) {
      throw new Error('Health system ID is required');
    }

    if (!props.createdBy) {
      throw new Error('Created by user ID is required');
    }

    // Validate scope filter matches scope type
    if (props.scope === 'department' && !props.scopeFilter?.departments) {
      throw new Error('Department scope requires departments filter');
    }

    if (props.scope === 'category' && !props.scopeFilter?.categories) {
      throw new Error('Category scope requires categories filter');
    }

    if (props.scope === 'vendor' && !props.scopeFilter?.vendorIds) {
      throw new Error('Vendor scope requires vendor IDs filter');
    }

    // Validate approval workflow if approval required
    if (props.enforcementActions.requireApproval || props.policyType === 'approval_required') {
      if (!props.approvalWorkflow?.approvers || props.approvalWorkflow.approvers.length === 0) {
        throw new Error('Approval workflow requires at least one approver');
      }
    }

    // Validate risk score ranges
    if (props.conditions?.minRiskScore !== undefined) {
      if (props.conditions.minRiskScore < 0 || props.conditions.minRiskScore > 4) {
        throw new Error('minRiskScore must be between 0 and 4');
      }
    }

    if (props.conditions?.maxRiskScore !== undefined) {
      if (props.conditions.maxRiskScore < 0 || props.conditions.maxRiskScore > 4) {
        throw new Error('maxRiskScore must be between 0 and 4');
      }
    }

    if (
      props.conditions?.minRiskScore !== undefined &&
      props.conditions?.maxRiskScore !== undefined &&
      props.conditions.minRiskScore > props.conditions.maxRiskScore
    ) {
      throw new Error('minRiskScore cannot be greater than maxRiskScore');
    }
  }

  /**
   * Check if this policy applies to a given AI system
   */
  isApplicableTo(aiSystem: AISystemForEvaluation): boolean {
    // Must be same health system
    if (this.props.healthSystemId !== aiSystem.healthSystemId) {
      return false;
    }

    // Must be active
    if (!this.props.active) {
      return false;
    }

    const filter = this.props.scopeFilter;

    // Check scope-specific filters
    if (this.props.scope !== 'all_ai') {
      if (!filter) {
        return false;
      }

      // Department scope
      if (this.props.scope === 'department' && filter.departments) {
        if (!aiSystem.department || !filter.departments.includes(aiSystem.department)) {
          return false;
        }
      }

      // Category scope
      if (this.props.scope === 'category' && filter.categories) {
        if (!aiSystem.category || !filter.categories.includes(aiSystem.category)) {
          return false;
        }
      }

      // Vendor scope
      if (this.props.scope === 'vendor' && filter.vendorIds) {
        if (!aiSystem.vendorId || !filter.vendorIds.includes(aiSystem.vendorId)) {
          return false;
        }
      }
    }

    // Risk level filter applies across ALL scopes (including 'all_ai')
    if (filter?.riskLevels && !filter.riskLevels.includes(aiSystem.riskLevel)) {
      return false;
    }

    return true;
  }

  /**
   * Evaluate if AI system violates this policy's conditions
   */
  evaluateConditions(aiSystem: AISystemForEvaluation): PolicyViolationResult | null {
    const conditions = this.props.conditions;

    // Prohibited policies always violate if applicable
    if (this.props.policyType === 'prohibited') {
      return {
        violationType: 'prohibited_ai_system',
        severity: this.calculateSeverity(),
        actionRequired: this.getRequiredAction(),
      };
    }

    // Approval required policies always trigger (not a violation, but requires action)
    if (this.props.policyType === 'approval_required') {
      return {
        violationType: 'approval_required',
        severity: this.calculateSeverity(),
        actionRequired: this.getRequiredAction(),
      };
    }

    if (!conditions) {
      return null;
    }

    const riskValue = this.getRiskValue(aiSystem.riskLevel);

    // Check risk level too low
    if (conditions.minRiskScore !== undefined && riskValue < conditions.minRiskScore) {
      return {
        violationType: 'risk_level_too_low',
        severity: this.calculateSeverity(),
        actionRequired: this.getRequiredAction(),
      };
    }

    // Check risk level too high
    if (conditions.maxRiskScore !== undefined && riskValue > conditions.maxRiskScore) {
      return {
        violationType: 'risk_level_too_high',
        severity: this.calculateSeverity(),
        actionRequired: this.getRequiredAction(),
      };
    }

    // Check certification requirement
    if (conditions.requiresCertification && !aiSystem.vendorId) {
      return {
        violationType: 'certification_required',
        severity: this.calculateSeverity(),
        actionRequired: this.getRequiredAction(),
      };
    }

    return null;
  }

  /**
   * Calculate violation severity based on policy type
   */
  private calculateSeverity(): SeverityLevel {
    switch (this.props.policyType) {
      case 'prohibited':
        return 'critical';
      case 'approval_required':
        return 'high';
      case 'restricted':
        return 'medium';
      case 'monitored':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Get required action from enforcement actions
   */
  private getRequiredAction(): string {
    const actions = this.props.enforcementActions;

    if (actions.blockDeployment) return 'deployment_blocked';
    if (actions.requireApproval) return 'approval_required';
    if (actions.restrictAccess) return 'access_restricted';
    if (actions.sendAlert) return 'alert_sent';
    if (actions.escalateToAdmin) return 'escalated_to_admin';
    
    return 'flagged_for_review';
  }

  /**
   * Convert risk level to numeric value for comparison
   */
  private getRiskValue(riskLevel: RiskLevel): number {
    const values: Record<RiskLevel, number> = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4,
    };
    return values[riskLevel] || 0;
  }

  /**
   * Check if this policy requires approval
   */
  requiresApproval(): boolean {
    return (
      this.props.enforcementActions.requireApproval === true ||
      this.props.policyType === 'approval_required'
    );
  }

  /**
   * Get list of approvers
   */
  getApprovers(): string[] {
    return this.props.approvalWorkflow?.approvers || [];
  }

  /**
   * Deactivate this policy
   */
  deactivate(): void {
    this.props.active = false;
    this.props.updatedAt = new Date();
  }

  /**
   * Activate this policy
   */
  activate(): void {
    this.props.active = true;
    this.props.updatedAt = new Date();
  }

  /**
   * Update enforcement actions
   */
  updateEnforcementActions(actions: EnforcementActions): void {
    // Validate approval workflow if now requiring approval
    if (actions.requireApproval && !this.props.approvalWorkflow?.approvers?.length) {
      throw new Error('Cannot require approval without approvers in workflow');
    }

    this.props.enforcementActions = actions;
    this.props.updatedAt = new Date();
  }

  /**
   * Test method: Set ID (only for persistence layer)
   */
  _setId(id: string): void {
    if (this.props.id) {
      throw new Error('Cannot set ID on entity that already has one');
    }
    this.props.id = id;
  }

  // Getters
  get id(): string | undefined {
    return this.props.id;
  }

  get healthSystemId(): string {
    return this.props.healthSystemId;
  }

  get policyName(): string {
    return this.props.policyName;
  }

  get policyType(): PolicyType {
    return this.props.policyType;
  }

  get scope(): PolicyScope {
    return this.props.scope;
  }

  get scopeFilter(): ScopeFilter | undefined {
    return this.props.scopeFilter;
  }

  get conditions(): PolicyConditions | undefined {
    return this.props.conditions;
  }

  get enforcementActions(): EnforcementActions {
    return this.props.enforcementActions;
  }

  get approvalWorkflow(): ApprovalWorkflow | undefined {
    return this.props.approvalWorkflow;
  }

  get active(): boolean {
    return this.props.active;
  }

  get createdBy(): string {
    return this.props.createdBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Return snapshot for persistence/serialization
   */
  toSnapshot(): PolicyRuleProps {
    return {
      id: this.props.id,
      healthSystemId: this.props.healthSystemId,
      policyName: this.props.policyName,
      policyType: this.props.policyType,
      scope: this.props.scope,
      scopeFilter: this.props.scopeFilter ? JSON.parse(JSON.stringify(this.props.scopeFilter)) : undefined,
      conditions: this.props.conditions ? JSON.parse(JSON.stringify(this.props.conditions)) : undefined,
      enforcementActions: JSON.parse(JSON.stringify(this.props.enforcementActions)),
      approvalWorkflow: this.props.approvalWorkflow ? JSON.parse(JSON.stringify(this.props.approvalWorkflow)) : undefined,
      active: this.props.active,
      createdBy: this.props.createdBy,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
