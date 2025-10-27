/**
 * APPLICATION LAYER: Evaluate Policy Compliance Use Case
 * 
 * Evaluates an AI system against all applicable policies and returns violations.
 */

import type { PolicyRule, AISystemForEvaluation, PolicyViolationResult } from '../../domain/entities/PolicyRule';
import type { IPolicyRuleRepository } from './repositories/IPolicyRuleRepository';
import type { IPolicyViolationRepository } from './repositories/IPolicyViolationRepository';
import { logger } from '../../logger';

export interface EvaluatePolicyComplianceInput {
  healthSystemId: string;
  aiSystemId: string;
  aiSystemName: string;
  department?: string | null;
  category?: string | null;
  vendorId?: string | null;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  logViolations?: boolean; // Whether to persist violations to database
}

export interface PolicyViolationOutput {
  policyRuleId: string;
  policyName: string;
  violationType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  actionRequired: string;
}

export interface EvaluatePolicyComplianceOutput {
  compliant: boolean;
  violations: PolicyViolationOutput[];
  policiesEvaluated: number;
}

export class EvaluatePolicyComplianceUseCase {
  constructor(
    private readonly policyRuleRepository: IPolicyRuleRepository,
    private readonly policyViolationRepository: IPolicyViolationRepository
  ) {}

  async execute(input: EvaluatePolicyComplianceInput): Promise<EvaluatePolicyComplianceOutput> {
    try {
      // Fetch all active policies for health system
      const policies = await this.policyRuleRepository.findActiveByHealthSystem(input.healthSystemId);

      logger.info(
        { aiSystemId: input.aiSystemId, healthSystemId: input.healthSystemId, policyCount: policies.length },
        'Evaluating AI system against policies'
      );

      // Build AI system evaluation object
      const aiSystem: AISystemForEvaluation = {
        id: input.aiSystemId,
        healthSystemId: input.healthSystemId,
        name: input.aiSystemName,
        department: input.department,
        category: input.category,
        vendorId: input.vendorId,
        riskLevel: input.riskLevel,
      };

      const violations: PolicyViolationOutput[] = [];

      // Evaluate each policy
      for (const policy of policies) {
        // Check if policy applies to this AI system
        if (!policy.isApplicableTo(aiSystem)) {
          continue;
        }

        // Evaluate conditions
        const violationResult = policy.evaluateConditions(aiSystem);

        if (violationResult) {
          violations.push({
            policyRuleId: policy.id!,
            policyName: policy.policyName,
            violationType: violationResult.violationType,
            severity: violationResult.severity,
            actionRequired: violationResult.actionRequired,
          });

          // Persist violation if requested
          if (input.logViolations) {
            await this.policyViolationRepository.create({
              healthSystemId: input.healthSystemId,
              policyRuleId: policy.id!,
              aiSystemId: input.aiSystemId,
              violationType: violationResult.violationType,
              severity: violationResult.severity,
              actionRequired: violationResult.actionRequired,
            });
          }
        }
      }

      const compliant = violations.length === 0;

      logger.info(
        { aiSystemId: input.aiSystemId, compliant, violationCount: violations.length },
        'Policy compliance evaluation complete'
      );

      return {
        compliant,
        violations,
        policiesEvaluated: policies.length,
      };
    } catch (error) {
      logger.error({ error, input }, 'Failed to evaluate policy compliance');
      throw error;
    }
  }
}
