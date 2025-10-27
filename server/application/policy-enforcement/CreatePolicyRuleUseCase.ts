/**
 * APPLICATION LAYER: Create Policy Rule Use Case
 * 
 * Orchestrates creation of a new policy rule with tier limit enforcement.
 */

import { PolicyRule, type PolicyRuleProps } from '../../domain/entities/PolicyRule';
import type { IPolicyRuleRepository } from './repositories/IPolicyRuleRepository';
import { logger } from '../../logger';

export interface CreatePolicyRuleInput {
  healthSystemId: string;
  policyName: string;
  policyType: 'approval_required' | 'prohibited' | 'restricted' | 'monitored';
  scope: 'all_ai' | 'department' | 'category' | 'vendor';
  scopeFilter?: {
    departments?: string[];
    categories?: string[];
    vendorIds?: string[];
    riskLevels?: ('low' | 'medium' | 'high' | 'critical')[];
  };
  conditions?: {
    minRiskScore?: number;
    maxRiskScore?: number;
    requiresCertification?: boolean;
    requiredFrameworks?: string[];
  };
  enforcementActions: {
    blockDeployment?: boolean;
    requireApproval?: boolean;
    sendAlert?: boolean;
    restrictAccess?: boolean;
    escalateToAdmin?: boolean;
  };
  approvalWorkflow?: {
    approvers: string[];
    requireAllApprovals?: boolean;
    escalationTimeout?: number;
  };
  createdBy: string;
}

export interface CreatePolicyRuleOutput {
  success: boolean;
  policyRule?: PolicyRuleProps;
  error?: string;
}

export interface ISubscriptionTierLimitGateway {
  checkPolicyLimit(healthSystemId: string): Promise<{ allowed: boolean; limit: number; current: number }>;
}

export class CreatePolicyRuleUseCase {
  constructor(
    private readonly policyRuleRepository: IPolicyRuleRepository,
    private readonly tierLimitGateway: ISubscriptionTierLimitGateway
  ) {}

  async execute(input: CreatePolicyRuleInput): Promise<CreatePolicyRuleOutput> {
    try {
      // Check tier limits
      const limitCheck = await this.tierLimitGateway.checkPolicyLimit(input.healthSystemId);
      
      if (!limitCheck.allowed) {
        logger.warn(
          { healthSystemId: input.healthSystemId, limit: limitCheck.limit, current: limitCheck.current },
          'Policy creation blocked: tier limit reached'
        );
        return {
          success: false,
          error: `Policy limit reached (${limitCheck.current}/${limitCheck.limit}). Upgrade your plan to create more policies.`,
        };
      }

      // Create domain entity (validates business rules)
      const policyRule = PolicyRule.create({
        healthSystemId: input.healthSystemId,
        policyName: input.policyName,
        policyType: input.policyType,
        scope: input.scope,
        scopeFilter: input.scopeFilter,
        conditions: input.conditions,
        enforcementActions: input.enforcementActions,
        approvalWorkflow: input.approvalWorkflow,
        createdBy: input.createdBy,
      });

      // Persist to database
      const savedPolicyRule = await this.policyRuleRepository.create(policyRule);

      logger.info(
        { policyRuleId: savedPolicyRule.id, healthSystemId: input.healthSystemId },
        'Policy rule created successfully'
      );

      return {
        success: true,
        policyRule: savedPolicyRule.toSnapshot(),
      };
    } catch (error) {
      logger.error({ error, input }, 'Failed to create policy rule');
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating policy rule',
      };
    }
  }
}
