/**
 * UNIT TESTS - EvaluatePolicyComplianceUseCase
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EvaluatePolicyComplianceUseCase, type EvaluatePolicyComplianceInput } from '../../../../server/application/policy-enforcement/EvaluatePolicyComplianceUseCase';
import { PolicyRule } from '../../../../server/domain/entities/PolicyRule';
import type { IPolicyRuleRepository } from '../../../../server/application/policy-enforcement/repositories/IPolicyRuleRepository';
import type { IPolicyViolationRepository } from '../../../../server/application/policy-enforcement/repositories/IPolicyViolationRepository';

describe('EvaluatePolicyComplianceUseCase', () => {
  let mockPolicyRepository: IPolicyRuleRepository;
  let mockViolationRepository: IPolicyViolationRepository;
  let useCase: EvaluatePolicyComplianceUseCase;

  beforeEach(() => {
    mockPolicyRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findActiveByHealthSystem: vi.fn(),
      findAllByHealthSystem: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockViolationRepository = {
      create: vi.fn(),
      findByAISystem: vi.fn(),
      findByHealthSystem: vi.fn(),
      findUnresolved: vi.fn(),
      resolve: vi.fn(),
    };

    useCase = new EvaluatePolicyComplianceUseCase(mockPolicyRepository, mockViolationRepository);
  });

  const testInput: EvaluatePolicyComplianceInput = {
    healthSystemId: 'hs-123',
    aiSystemId: 'ai-456',
    aiSystemName: 'Diagnostic AI',
    department: 'Radiology',
    category: 'diagnostic_imaging',
    vendorId: 'vendor-1',
    riskLevel: 'high',
  };

  describe('Policy Evaluation', () => {
    it('should return compliant when no policies apply', async () => {
      vi.mocked(mockPolicyRepository.findActiveByHealthSystem).mockResolvedValue([]);

      const result = await useCase.execute(testInput);

      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.policiesEvaluated).toBe(0);
    });

    it('should return compliant when policies apply but no violations', async () => {
      const monitoringPolicy = PolicyRule.create({
        healthSystemId: 'hs-123',
        policyName: 'Monitor All AI',
        policyType: 'monitored',
        scope: 'all_ai',
        conditions: {
          maxRiskScore: 4, // Allows high risk
        },
        enforcementActions: { sendAlert: true },
        createdBy: 'admin-1',
      });
      monitoringPolicy._setId('policy-1');

      vi.mocked(mockPolicyRepository.findActiveByHealthSystem).mockResolvedValue([monitoringPolicy]);

      const result = await useCase.execute(testInput);

      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.policiesEvaluated).toBe(1);
    });

    it('should detect prohibited policy violation', async () => {
      const prohibitedPolicy = PolicyRule.create({
        healthSystemId: 'hs-123',
        policyName: 'Block All Diagnostic AI',
        policyType: 'prohibited',
        scope: 'category',
        scopeFilter: {
          categories: ['diagnostic_imaging'],
        },
        enforcementActions: { blockDeployment: true },
        approvalWorkflow: undefined,
        createdBy: 'admin-1',
      });
      prohibitedPolicy._setId('policy-2');

      vi.mocked(mockPolicyRepository.findActiveByHealthSystem).mockResolvedValue([prohibitedPolicy]);

      const result = await useCase.execute(testInput);

      expect(result.compliant).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toEqual({
        policyRuleId: 'policy-2',
        policyName: 'Block All Diagnostic AI',
        violationType: 'prohibited_ai_system',
        severity: 'critical',
        actionRequired: 'deployment_blocked',
      });
    });

    it('should detect approval required violation', async () => {
      const approvalPolicy = PolicyRule.create({
        healthSystemId: 'hs-123',
        policyName: 'High Risk Requires Approval',
        policyType: 'approval_required',
        scope: 'all_ai',
        scopeFilter: {
          riskLevels: ['high', 'critical'],
        },
        enforcementActions: { requireApproval: true },
        approvalWorkflow: {
          approvers: ['user-1'],
        },
        createdBy: 'admin-1',
      });
      approvalPolicy._setId('policy-3');

      vi.mocked(mockPolicyRepository.findActiveByHealthSystem).mockResolvedValue([approvalPolicy]);

      const result = await useCase.execute(testInput);

      expect(result.compliant).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].violationType).toBe('approval_required');
      expect(result.violations[0].severity).toBe('high');
    });

    it('should detect risk level too high violation', async () => {
      const riskPolicy = PolicyRule.create({
        healthSystemId: 'hs-123',
        policyName: 'Max Medium Risk',
        policyType: 'restricted',
        scope: 'all_ai',
        conditions: {
          maxRiskScore: 2, // Max medium
        },
        enforcementActions: { restrictAccess: true },
        approvalWorkflow: undefined,
        createdBy: 'admin-1',
      });
      riskPolicy._setId('policy-4');

      vi.mocked(mockPolicyRepository.findActiveByHealthSystem).mockResolvedValue([riskPolicy]);

      const result = await useCase.execute(testInput); // high risk = 3 > 2

      expect(result.compliant).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].violationType).toBe('risk_level_too_high');
      expect(result.violations[0].actionRequired).toBe('access_restricted');
    });

    it('should detect certification required violation', async () => {
      const certPolicy = PolicyRule.create({
        healthSystemId: 'hs-123',
        policyName: 'Require Certification',
        policyType: 'restricted',
        scope: 'all_ai',
        conditions: {
          requiresCertification: true,
        },
        enforcementActions: { sendAlert: true },
        approvalWorkflow: undefined,
        createdBy: 'admin-1',
      });
      certPolicy._setId('policy-5');

      vi.mocked(mockPolicyRepository.findActiveByHealthSystem).mockResolvedValue([certPolicy]);

      const uncertifiedInput: EvaluatePolicyComplianceInput = {
        ...testInput,
        vendorId: null, // No vendor = not certified
      };

      const result = await useCase.execute(uncertifiedInput);

      expect(result.compliant).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].violationType).toBe('certification_required');
    });

    it('should evaluate multiple policies and detect multiple violations', async () => {
      const policy1 = PolicyRule.create({
        healthSystemId: 'hs-123',
        policyName: 'Approval Required',
        policyType: 'approval_required',
        scope: 'all_ai',
        enforcementActions: { requireApproval: true },
        approvalWorkflow: { approvers: ['user-1'] },
        createdBy: 'admin-1',
      });
      policy1._setId('policy-1');

      const policy2 = PolicyRule.create({
        healthSystemId: 'hs-123',
        policyName: 'Max Medium Risk',
        policyType: 'restricted',
        scope: 'all_ai',
        conditions: { maxRiskScore: 2 },
        enforcementActions: { restrictAccess: true },
        approvalWorkflow: undefined,
        createdBy: 'admin-1',
      });
      policy2._setId('policy-2');

      vi.mocked(mockPolicyRepository.findActiveByHealthSystem).mockResolvedValue([policy1, policy2]);

      const result = await useCase.execute(testInput);

      expect(result.compliant).toBe(false);
      expect(result.violations).toHaveLength(2);
      expect(result.policiesEvaluated).toBe(2);
    });
  });

  describe('Scope Filtering', () => {
    it('should skip policies that do not apply to AI system', async () => {
      const departmentPolicy = PolicyRule.create({
        healthSystemId: 'hs-123',
        policyName: 'Cardiology Only',
        policyType: 'approval_required',
        scope: 'department',
        scopeFilter: {
          departments: ['Cardiology'], // testInput is Radiology
        },
        enforcementActions: { requireApproval: true },
        approvalWorkflow: { approvers: ['user-1'] },
        createdBy: 'admin-1',
      });
      departmentPolicy._setId('policy-6');

      vi.mocked(mockPolicyRepository.findActiveByHealthSystem).mockResolvedValue([departmentPolicy]);

      const result = await useCase.execute(testInput);

      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.policiesEvaluated).toBe(1);
    });

    it('should skip policies for different health systems', async () => {
      const otherHSPolicy = PolicyRule.create({
        healthSystemId: 'different-hs',
        policyName: 'Other HS Policy',
        policyType: 'prohibited',
        scope: 'all_ai',
        enforcementActions: { blockDeployment: true },
        approvalWorkflow: undefined,
        createdBy: 'admin-1',
      });
      otherHSPolicy._setId('policy-7');

      vi.mocked(mockPolicyRepository.findActiveByHealthSystem).mockResolvedValue([otherHSPolicy]);

      const result = await useCase.execute(testInput);

      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('Violation Logging', () => {
    it('should persist violations when logViolations=true', async () => {
      const policy = PolicyRule.create({
        healthSystemId: 'hs-123',
        policyName: 'Test Policy',
        policyType: 'prohibited',
        scope: 'all_ai',
        enforcementActions: { blockDeployment: true },
        approvalWorkflow: undefined,
        createdBy: 'admin-1',
      });
      policy._setId('policy-1');

      vi.mocked(mockPolicyRepository.findActiveByHealthSystem).mockResolvedValue([policy]);
      vi.mocked(mockViolationRepository.create).mockResolvedValue({
        id: 'violation-1',
        healthSystemId: 'hs-123',
        policyRuleId: 'policy-1',
        aiSystemId: 'ai-456',
        violationType: 'prohibited_ai_system',
        severity: 'critical',
        actionRequired: 'deployment_blocked',
        createdAt: new Date(),
      });

      const result = await useCase.execute({
        ...testInput,
        logViolations: true,
      });

      expect(result.compliant).toBe(false);
      expect(mockViolationRepository.create).toHaveBeenCalledWith({
        healthSystemId: 'hs-123',
        policyRuleId: 'policy-1',
        aiSystemId: 'ai-456',
        violationType: 'prohibited_ai_system',
        severity: 'critical',
        actionRequired: 'deployment_blocked',
      });
    });

    it('should not persist violations when logViolations=false', async () => {
      const policy = PolicyRule.create({
        healthSystemId: 'hs-123',
        policyName: 'Test Policy',
        policyType: 'prohibited',
        scope: 'all_ai',
        enforcementActions: { blockDeployment: true },
        approvalWorkflow: undefined,
        createdBy: 'admin-1',
      });
      policy._setId('policy-1');

      vi.mocked(mockPolicyRepository.findActiveByHealthSystem).mockResolvedValue([policy]);

      const result = await useCase.execute({
        ...testInput,
        logViolations: false,
      });

      expect(result.compliant).toBe(false);
      expect(mockViolationRepository.create).not.toHaveBeenCalled();
    });
  });
});
