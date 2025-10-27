/**
 * API ADAPTER: Policy Controller
 * 
 * Adapts HTTP requests to Clean Architecture use cases.
 * Handles field name normalization and error translation.
 */

import type { Request, Response } from 'express';
import { CreatePolicyRuleUseCase } from '../application/policy-enforcement/CreatePolicyRuleUseCase';
import { EvaluatePolicyComplianceUseCase } from '../application/policy-enforcement/EvaluatePolicyComplianceUseCase';
import { DrizzlePolicyRuleRepository } from '../infrastructure/policy-enforcement/DrizzlePolicyRuleRepository';
import { DrizzlePolicyViolationRepository } from '../infrastructure/policy-enforcement/DrizzlePolicyViolationRepository';
import { StripePolicyLimitGateway } from '../infrastructure/policy-enforcement/StripePolicyLimitGateway';
import { logger } from '../logger';

export class PolicyController {
  private createPolicyUseCase: CreatePolicyRuleUseCase;
  private evaluatePolicyUseCase: EvaluatePolicyComplianceUseCase;

  constructor() {
    const policyRuleRepository = new DrizzlePolicyRuleRepository();
    const policyViolationRepository = new DrizzlePolicyViolationRepository();
    const tierLimitGateway = new StripePolicyLimitGateway();

    this.createPolicyUseCase = new CreatePolicyRuleUseCase(policyRuleRepository, tierLimitGateway);
    this.evaluatePolicyUseCase = new EvaluatePolicyComplianceUseCase(
      policyRuleRepository,
      policyViolationRepository
    );
  }

  /**
   * POST /api/policies
   * Create a new policy rule
   */
  async createPolicy(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const healthSystemId = user?.healthSystemId;

      if (!healthSystemId) {
        res.status(403).json({ error: 'Health system access required' });
        return;
      }

      const result = await this.createPolicyUseCase.execute({
        healthSystemId,
        policyName: req.body.policyName,
        policyType: req.body.policyType,
        scope: req.body.scope,
        scopeFilter: req.body.scopeFilter,
        conditions: req.body.conditions,
        enforcementActions: req.body.enforcementActions,
        approvalWorkflow: req.body.approvalWorkflow,
        createdBy: user.id,
      });

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.status(201).json(result.policyRule);
    } catch (error) {
      logger.error({ error }, 'Failed to create policy');
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * POST /api/ai-systems/:id/evaluate-policies
   * Evaluate AI system against all applicable policies
   */
  async evaluatePolicies(req: Request, res: Response): Promise<void> {
    try {
      const { id: aiSystemId } = req.params;
      const user = (req as any).user;
      const healthSystemId = user?.healthSystemId;

      if (!healthSystemId) {
        res.status(403).json({ error: 'Health system access required' });
        return;
      }

      // Field name normalization (support both usesPhi and usesPHI for API compatibility)
      const riskLevel = req.body.riskLevel || 'medium';

      const result = await this.evaluatePolicyUseCase.execute({
        healthSystemId,
        aiSystemId,
        aiSystemName: req.body.name || req.body.aiSystemName || 'Unknown',
        department: req.body.department || null,
        category: req.body.category || null,
        vendorId: req.body.vendorId || null,
        riskLevel,
        logViolations: req.body.logViolations !== false, // Default true
      });

      res.json(result);
    } catch (error) {
      logger.error({ error }, 'Failed to evaluate policies');
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

// Singleton instance
export const policyController = new PolicyController();
