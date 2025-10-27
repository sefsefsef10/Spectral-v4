/**
 * UNIT TESTS - CreatePolicyRuleUseCase
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreatePolicyRuleUseCase, type CreatePolicyRuleInput, type ISubscriptionTierLimitGateway } from '../../../../server/application/policy-enforcement/CreatePolicyRuleUseCase';
import { PolicyRule } from '../../../../server/domain/entities/PolicyRule';
import type { IPolicyRuleRepository } from '../../../../server/application/policy-enforcement/repositories/IPolicyRuleRepository';

describe('CreatePolicyRuleUseCase', () => {
  let mockRepository: IPolicyRuleRepository;
  let mockTierLimitGateway: ISubscriptionTierLimitGateway;
  let useCase: CreatePolicyRuleUseCase;

  beforeEach(() => {
    mockRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findActiveByHealthSystem: vi.fn(),
      findAllByHealthSystem: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockTierLimitGateway = {
      checkPolicyLimit: vi.fn(),
    };

    useCase = new CreatePolicyRuleUseCase(mockRepository, mockTierLimitGateway);
  });

  const validInput: CreatePolicyRuleInput = {
    healthSystemId: 'hs-123',
    policyName: 'High Risk Approval Policy',
    policyType: 'approval_required',
    scope: 'all_ai',
    enforcementActions: {
      requireApproval: true,
      sendAlert: true,
    },
    approvalWorkflow: {
      approvers: ['user-1', 'user-2'],
    },
    createdBy: 'admin-1',
  };

  describe('Successful Policy Creation', () => {
    it('should create policy when under tier limit', async () => {
      vi.mocked(mockTierLimitGateway.checkPolicyLimit).mockResolvedValue({
        allowed: true,
        limit: 10,
        current: 5,
      });

      const mockSavedPolicy = PolicyRule.create(validInput);
      mockSavedPolicy._setId('policy-123');
      vi.mocked(mockRepository.create).mockResolvedValue(mockSavedPolicy);

      const result = await useCase.execute(validInput);

      expect(result.success).toBe(true);
      expect(result.policyRule).toBeDefined();
      expect(result.policyRule?.id).toBe('policy-123');
      expect(result.policyRule?.policyName).toBe('High Risk Approval Policy');
      expect(result.error).toBeUndefined();

      expect(mockTierLimitGateway.checkPolicyLimit).toHaveBeenCalledWith('hs-123');
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should create policy with complex scope filters', async () => {
      vi.mocked(mockTierLimitGateway.checkPolicyLimit).mockResolvedValue({
        allowed: true,
        limit: 10,
        current: 2,
      });

      const complexInput: CreatePolicyRuleInput = {
        ...validInput,
        scope: 'department',
        scopeFilter: {
          departments: ['Cardiology', 'Radiology'],
          riskLevels: ['high', 'critical'],
        },
        conditions: {
          minRiskScore: 3,
          requiresCertification: true,
        },
      };

      const mockSavedPolicy = PolicyRule.create(complexInput);
      mockSavedPolicy._setId('policy-456');
      vi.mocked(mockRepository.create).mockResolvedValue(mockSavedPolicy);

      const result = await useCase.execute(complexInput);

      expect(result.success).toBe(true);
      expect(result.policyRule?.scopeFilter).toEqual({
        departments: ['Cardiology', 'Radiology'],
        riskLevels: ['high', 'critical'],
      });
      expect(result.policyRule?.conditions).toEqual({
        minRiskScore: 3,
        requiresCertification: true,
      });
    });
  });

  describe('Tier Limit Enforcement', () => {
    it('should reject creation when tier limit reached', async () => {
      vi.mocked(mockTierLimitGateway.checkPolicyLimit).mockResolvedValue({
        allowed: false,
        limit: 5,
        current: 5,
      });

      const result = await useCase.execute(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Policy limit reached');
      expect(result.error).toContain('5/5');
      expect(result.policyRule).toBeUndefined();

      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should include upgrade message in limit error', async () => {
      vi.mocked(mockTierLimitGateway.checkPolicyLimit).mockResolvedValue({
        allowed: false,
        limit: 3,
        current: 3,
      });

      const result = await useCase.execute(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Upgrade your plan');
    });
  });

  describe('Validation Errors', () => {
    it('should reject empty policy name', async () => {
      vi.mocked(mockTierLimitGateway.checkPolicyLimit).mockResolvedValue({
        allowed: true,
        limit: 10,
        current: 5,
      });

      const invalidInput: CreatePolicyRuleInput = {
        ...validInput,
        policyName: '',
      };

      const result = await useCase.execute(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Policy name cannot be empty');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should reject department scope without departments filter', async () => {
      vi.mocked(mockTierLimitGateway.checkPolicyLimit).mockResolvedValue({
        allowed: true,
        limit: 10,
        current: 5,
      });

      const invalidInput: CreatePolicyRuleInput = {
        ...validInput,
        scope: 'department',
        scopeFilter: {}, // Missing departments
      };

      const result = await useCase.execute(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Department scope requires departments filter');
    });

    it('should reject approval requirement without approvers', async () => {
      vi.mocked(mockTierLimitGateway.checkPolicyLimit).mockResolvedValue({
        allowed: true,
        limit: 10,
        current: 5,
      });

      const invalidInput: CreatePolicyRuleInput = {
        ...validInput,
        enforcementActions: { requireApproval: true },
        approvalWorkflow: undefined,
      };

      const result = await useCase.execute(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Approval workflow requires at least one approver');
    });

    it('should reject invalid risk score range', async () => {
      vi.mocked(mockTierLimitGateway.checkPolicyLimit).mockResolvedValue({
        allowed: true,
        limit: 10,
        current: 5,
      });

      const invalidInput: CreatePolicyRuleInput = {
        ...validInput,
        policyType: 'monitored',
        conditions: {
          minRiskScore: 3,
          maxRiskScore: 1, // Invalid: min > max
        },
        enforcementActions: { sendAlert: true },
      };

      const result = await useCase.execute(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('minRiskScore cannot be greater than maxRiskScore');
    });
  });

  describe('Repository Errors', () => {
    it('should handle repository failures gracefully', async () => {
      vi.mocked(mockTierLimitGateway.checkPolicyLimit).mockResolvedValue({
        allowed: true,
        limit: 10,
        current: 5,
      });

      vi.mocked(mockRepository.create).mockRejectedValue(new Error('Database connection failed'));

      const result = await useCase.execute(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });

    it('should handle unknown errors', async () => {
      vi.mocked(mockTierLimitGateway.checkPolicyLimit).mockResolvedValue({
        allowed: true,
        limit: 10,
        current: 5,
      });

      vi.mocked(mockRepository.create).mockRejectedValue('Unknown error object');

      const result = await useCase.execute(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error creating policy rule');
    });
  });
});
