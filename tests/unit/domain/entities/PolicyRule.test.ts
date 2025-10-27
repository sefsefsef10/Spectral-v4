/**
 * UNIT TESTS - PolicyRule Domain Entity
 * 
 * Tests pure business logic with zero infrastructure dependencies.
 */

import { describe, it, expect } from 'vitest';
import { PolicyRule, type PolicyRuleProps, type AISystemForEvaluation } from '../../../../server/domain/entities/PolicyRule';

describe('PolicyRule Domain Entity', () => {
  const validProps: Omit<PolicyRuleProps, 'id' | 'createdAt' | 'updatedAt'> = {
    healthSystemId: 'hs-123',
    policyName: 'High Risk Approval Required',
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

  const testAISystem: AISystemForEvaluation = {
    id: 'ai-123',
    healthSystemId: 'hs-123',
    name: 'Test AI System',
    department: 'Cardiology',
    category: 'clinical_decision_support',
    vendorId: 'vendor-1',
    riskLevel: 'high',
  };

  describe('Policy Creation and Validation', () => {
    it('should create a valid policy rule', () => {
      const policy = PolicyRule.create(validProps);

      expect(policy.policyName).toBe('High Risk Approval Required');
      expect(policy.policyType).toBe('approval_required');
      expect(policy.scope).toBe('all_ai');
      expect(policy.active).toBe(true);
      expect(policy.healthSystemId).toBe('hs-123');
      expect(policy.createdBy).toBe('admin-1');
    });

    it('should reject empty policy name', () => {
      expect(() =>
        PolicyRule.create({
          ...validProps,
          policyName: '',
        })
      ).toThrow('Policy name cannot be empty');
    });

    it('should reject missing health system ID', () => {
      expect(() =>
        PolicyRule.create({
          ...validProps,
          healthSystemId: '',
        })
      ).toThrow('Health system ID is required');
    });

    it('should reject missing created by', () => {
      expect(() =>
        PolicyRule.create({
          ...validProps,
          createdBy: '',
        })
      ).toThrow('Created by user ID is required');
    });

    it('should require departments filter for department scope', () => {
      expect(() =>
        PolicyRule.create({
          ...validProps,
          scope: 'department',
          scopeFilter: {},
        })
      ).toThrow('Department scope requires departments filter');
    });

    it('should require categories filter for category scope', () => {
      expect(() =>
        PolicyRule.create({
          ...validProps,
          scope: 'category',
          scopeFilter: {},
        })
      ).toThrow('Category scope requires categories filter');
    });

    it('should require vendor IDs filter for vendor scope', () => {
      expect(() =>
        PolicyRule.create({
          ...validProps,
          scope: 'vendor',
          scopeFilter: {},
        })
      ).toThrow('Vendor scope requires vendor IDs filter');
    });

    it('should require approvers when approval is required', () => {
      expect(() =>
        PolicyRule.create({
          ...validProps,
          enforcementActions: { requireApproval: true },
          approvalWorkflow: undefined,
        })
      ).toThrow('Approval workflow requires at least one approver');
    });

    it('should validate risk score ranges', () => {
      expect(() =>
        PolicyRule.create({
          ...validProps,
          conditions: { minRiskScore: -1 },
        })
      ).toThrow('minRiskScore must be between 0 and 4');

      expect(() =>
        PolicyRule.create({
          ...validProps,
          conditions: { maxRiskScore: 5 },
        })
      ).toThrow('maxRiskScore must be between 0 and 4');
    });

    it('should reject invalid risk score range', () => {
      expect(() =>
        PolicyRule.create({
          ...validProps,
          conditions: {
            minRiskScore: 3,
            maxRiskScore: 2,
          },
        })
      ).toThrow('minRiskScore cannot be greater than maxRiskScore');
    });
  });

  describe('Policy Applicability', () => {
    it('should apply to all AI when scope is all_ai', () => {
      const policy = PolicyRule.create({
        ...validProps,
        scope: 'all_ai',
      });

      expect(policy.isApplicableTo(testAISystem)).toBe(true);
    });

    it('should not apply to different health system', () => {
      const policy = PolicyRule.create(validProps);
      
      const differentHSSystem: AISystemForEvaluation = {
        ...testAISystem,
        healthSystemId: 'different-hs',
      };

      expect(policy.isApplicableTo(differentHSSystem)).toBe(false);
    });

    it('should not apply when policy is inactive', () => {
      const policy = PolicyRule.create({
        ...validProps,
        active: false,
      });

      expect(policy.isApplicableTo(testAISystem)).toBe(false);
    });

    it('should apply to matching department', () => {
      const policy = PolicyRule.create({
        ...validProps,
        scope: 'department',
        scopeFilter: {
          departments: ['Cardiology', 'Radiology'],
        },
      });

      expect(policy.isApplicableTo(testAISystem)).toBe(true);
    });

    it('should not apply to non-matching department', () => {
      const policy = PolicyRule.create({
        ...validProps,
        scope: 'department',
        scopeFilter: {
          departments: ['Neurology', 'Oncology'],
        },
      });

      expect(policy.isApplicableTo(testAISystem)).toBe(false);
    });

    it('should apply to matching category', () => {
      const policy = PolicyRule.create({
        ...validProps,
        scope: 'category',
        scopeFilter: {
          categories: ['clinical_decision_support', 'diagnostic_imaging'],
        },
      });

      expect(policy.isApplicableTo(testAISystem)).toBe(true);
    });

    it('should not apply to non-matching category', () => {
      const policy = PolicyRule.create({
        ...validProps,
        scope: 'category',
        scopeFilter: {
          categories: ['patient_monitoring'],
        },
      });

      expect(policy.isApplicableTo(testAISystem)).toBe(false);
    });

    it('should apply to matching vendor', () => {
      const policy = PolicyRule.create({
        ...validProps,
        scope: 'vendor',
        scopeFilter: {
          vendorIds: ['vendor-1', 'vendor-2'],
        },
      });

      expect(policy.isApplicableTo(testAISystem)).toBe(true);
    });

    it('should apply to matching risk level filter', () => {
      const policy = PolicyRule.create({
        ...validProps,
        scope: 'all_ai',
        scopeFilter: {
          riskLevels: ['high', 'critical'],
        },
      });

      expect(policy.isApplicableTo(testAISystem)).toBe(true);
    });

    it('should not apply to non-matching risk level filter', () => {
      const policy = PolicyRule.create({
        ...validProps,
        policyType: 'prohibited', // No approval requirement needed
        approvalWorkflow: undefined,
        enforcementActions: { blockDeployment: true },
        scope: 'all_ai',
        scopeFilter: {
          riskLevels: ['low', 'medium'],
        },
      });

      expect(policy.isApplicableTo(testAISystem)).toBe(false);
    });
  });

  describe('Condition Evaluation', () => {
    it('should always violate for prohibited policy type', () => {
      const policy = PolicyRule.create({
        ...validProps,
        policyType: 'prohibited',
        enforcementActions: { blockDeployment: true },
      });

      const result = policy.evaluateConditions(testAISystem);

      expect(result).toBeDefined();
      expect(result?.violationType).toBe('prohibited_ai_system');
      expect(result?.severity).toBe('critical');
      expect(result?.actionRequired).toBe('deployment_blocked');
    });

    it('should trigger approval for approval_required policy type', () => {
      const policy = PolicyRule.create(validProps);

      const result = policy.evaluateConditions(testAISystem);

      expect(result).toBeDefined();
      expect(result?.violationType).toBe('approval_required');
      expect(result?.severity).toBe('high');
      expect(result?.actionRequired).toBe('approval_required');
    });

    it('should detect risk level too low', () => {
      const policy = PolicyRule.create({
        ...validProps,
        policyType: 'monitored',
        conditions: { minRiskScore: 4 }, // Requires critical
        enforcementActions: { sendAlert: true },
      });

      const lowRiskSystem: AISystemForEvaluation = {
        ...testAISystem,
        riskLevel: 'high', // 3 < 4
      };

      const result = policy.evaluateConditions(lowRiskSystem);

      expect(result).toBeDefined();
      expect(result?.violationType).toBe('risk_level_too_low');
    });

    it('should detect risk level too high', () => {
      const policy = PolicyRule.create({
        ...validProps,
        policyType: 'restricted',
        conditions: { maxRiskScore: 2 }, // Max medium
        enforcementActions: { restrictAccess: true },
      });

      const result = policy.evaluateConditions(testAISystem); // high = 3 > 2

      expect(result).toBeDefined();
      expect(result?.violationType).toBe('risk_level_too_high');
      expect(result?.actionRequired).toBe('access_restricted');
    });

    it('should detect missing certification', () => {
      const policy = PolicyRule.create({
        ...validProps,
        policyType: 'restricted',
        conditions: { requiresCertification: true },
        enforcementActions: { sendAlert: true },
      });

      const uncertifiedSystem: AISystemForEvaluation = {
        ...testAISystem,
        vendorId: null,
      };

      const result = policy.evaluateConditions(uncertifiedSystem);

      expect(result).toBeDefined();
      expect(result?.violationType).toBe('certification_required');
    });

    it('should return null when all conditions pass', () => {
      const policy = PolicyRule.create({
        ...validProps,
        policyType: 'monitored',
        conditions: {
          minRiskScore: 2,
          maxRiskScore: 4,
        },
        enforcementActions: { sendAlert: true },
      });

      const result = policy.evaluateConditions(testAISystem); // high = 3, within range

      expect(result).toBeNull();
    });
  });

  describe('Severity Calculation', () => {
    it('should assign critical severity to prohibited policies', () => {
      const policy = PolicyRule.create({
        ...validProps,
        policyType: 'prohibited',
        enforcementActions: { blockDeployment: true },
      });

      const result = policy.evaluateConditions(testAISystem);
      expect(result?.severity).toBe('critical');
    });

    it('should assign high severity to approval_required policies', () => {
      const policy = PolicyRule.create({
        ...validProps,
        policyType: 'approval_required',
      });

      const result = policy.evaluateConditions(testAISystem);
      expect(result?.severity).toBe('high');
    });

    it('should assign medium severity to restricted policies', () => {
      const policy = PolicyRule.create({
        ...validProps,
        policyType: 'restricted',
        conditions: { maxRiskScore: 0 },
        enforcementActions: { restrictAccess: true },
      });

      const result = policy.evaluateConditions(testAISystem);
      expect(result?.severity).toBe('medium');
    });

    it('should assign low severity to monitored policies', () => {
      const policy = PolicyRule.create({
        ...validProps,
        policyType: 'monitored',
        conditions: { minRiskScore: 4 }, // Valid range: 0-4
        enforcementActions: { sendAlert: true },
      });

      const result = policy.evaluateConditions(testAISystem);
      expect(result?.severity).toBe('low');
    });
  });

  describe('Approval Logic', () => {
    it('should require approval when enforement action set', () => {
      const policy = PolicyRule.create({
        ...validProps,
        policyType: 'restricted',
        enforcementActions: { requireApproval: true },
      });

      expect(policy.requiresApproval()).toBe(true);
    });

    it('should require approval when policy type is approval_required', () => {
      const policy = PolicyRule.create(validProps); // policyType: 'approval_required'

      expect(policy.requiresApproval()).toBe(true);
    });

    it('should return approvers list', () => {
      const policy = PolicyRule.create(validProps);

      const approvers = policy.getApprovers();

      expect(approvers).toEqual(['user-1', 'user-2']);
    });

    it('should return empty array when no approvers', () => {
      const policy = PolicyRule.create({
        ...validProps,
        policyType: 'prohibited',
        approvalWorkflow: undefined,
        enforcementActions: { blockDeployment: true },
      });

      expect(policy.getApprovers()).toEqual([]);
    });
  });

  describe('Policy State Management', () => {
    it('should deactivate policy', () => {
      const policy = PolicyRule.create(validProps);

      expect(policy.active).toBe(true);

      policy.deactivate();

      expect(policy.active).toBe(false);
    });

    it('should activate policy', () => {
      const policy = PolicyRule.create({
        ...validProps,
        active: false,
      });

      expect(policy.active).toBe(false);

      policy.activate();

      expect(policy.active).toBe(true);
    });

    it('should update enforcement actions', () => {
      const policy = PolicyRule.create(validProps);

      policy.updateEnforcementActions({
        sendAlert: true,
        escalateToAdmin: true,
      });

      expect(policy.enforcementActions.sendAlert).toBe(true);
      expect(policy.enforcementActions.escalateToAdmin).toBe(true);
    });

    it('should reject approval requirement without approvers', () => {
      const policy = PolicyRule.create({
        ...validProps,
        policyType: 'prohibited',
        approvalWorkflow: undefined,
        enforcementActions: { blockDeployment: true },
      });

      expect(() =>
        policy.updateEnforcementActions({
          requireApproval: true,
        })
      ).toThrow('Cannot require approval without approvers in workflow');
    });
  });

  describe('Snapshot Serialization', () => {
    it('should create deep copy snapshot', () => {
      const policy = PolicyRule.create(validProps);

      const snapshot = policy.toSnapshot();

      expect(snapshot.policyName).toBe(validProps.policyName);
      expect(snapshot.healthSystemId).toBe(validProps.healthSystemId);
      expect(snapshot.enforcementActions).toEqual(validProps.enforcementActions);
      
      // Ensure deep copy (mutations don't affect original)
      snapshot.enforcementActions!.blockDeployment = true;
      expect(policy.enforcementActions.blockDeployment).toBeUndefined();
    });
  });

  describe('ID Management', () => {
    it('should allow setting ID once for persistence', () => {
      const policy = PolicyRule.create(validProps);

      expect(policy.id).toBeUndefined();

      policy._setId('policy-123');

      expect(policy.id).toBe('policy-123');
    });

    it('should reject setting ID twice', () => {
      const policy = PolicyRule.create(validProps);

      policy._setId('policy-123');

      expect(() => policy._setId('policy-456')).toThrow('Cannot set ID on entity that already has one');
    });

    it('should reconstitute with existing ID', () => {
      const policy = PolicyRule.from({
        ...validProps,
        id: 'existing-id',
      });

      expect(policy.id).toBe('existing-id');
    });

    it('should reject reconstitution without ID', () => {
      expect(() =>
        PolicyRule.from(validProps)
      ).toThrow('PolicyRule.from() requires an id');
    });
  });
});
