/**
 * CHARACTERIZATION TESTS - Policy Enforcement
 * 
 * These tests lock down the EXISTING behavior of the PolicyEnforcementEngine
 * before refactoring to Clean Architecture. They ensure we don't break
 * any functionality during the migration.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../server/db';
import { 
  healthSystems, 
  users, 
  aiSystems, 
  policyRules, 
  policyEnforcementLogs,
  InsertHealthSystem,
  InsertUser,
  InsertAISystem
} from '../../shared/schema';
import { PolicyEnforcementEngine } from '../../server/services/policy-enforcement-engine';
import { hashPassword } from '../../server/auth';

describe('PolicyEnforcementEngine - Characterization Tests', () => {
  let testHealthSystemId: string;
  let testUserId: string;
  let testAISystemId: string;
  const engine = new PolicyEnforcementEngine();

  beforeEach(async () => {
    console.log('🧪 Test environment initialized');
    
    // Create test health system
    const healthSystem: InsertHealthSystem = {
      name: 'Test Hospital',
      subscriptionTier: 'enterprise', // Enterprise for full permissions
    };
    const [createdHS] = await db.insert(healthSystems).values(healthSystem).returning();
    testHealthSystemId = createdHS.id;

    // Create test user
    const user: InsertUser = {
      username: 'test-policy-user',
      password: await hashPassword('password123'),
      email: 'policy@test.com',
      role: 'health_system',
      healthSystemId: testHealthSystemId,
      emailVerified: true,
    };
    const [createdUser] = await db.insert(users).values(user).returning();
    testUserId = createdUser.id;

    // Create test AI system
    const aiSystem: InsertAISystem = {
      name: 'Test AI System',
      healthSystemId: testHealthSystemId,
      riskLevel: 'high',
      status: 'testing',
      category: 'clinical_decision_support',
      department: 'Cardiology',
      usesPhi: true,
    };
    const [createdAI] = await db.insert(aiSystems).values(aiSystem).returning();
    testAISystemId = createdAI.id;
  });

  afterEach(async () => {
    // Clean up in reverse order of foreign keys
    try {
      await db.delete(policyEnforcementLogs);
    } catch (e) {
      // Ignore if table doesn't exist
    }
    await db.delete(policyRules);
    await db.delete(aiSystems);
    await db.delete(users);
    await db.delete(healthSystems);
    console.log('✅ Test environment cleaned up');
  });

  describe('Create Policy Rule', () => {
    it('should create a basic policy rule with required fields', async () => {
      const config = {
        healthSystemId: testHealthSystemId,
        policyName: 'High Risk Requires Approval',
        policyType: 'approval_required' as const,
        scope: 'all_ai' as const,
        enforcementActions: {
          requireApproval: true,
          sendAlert: true,
        },
        createdBy: testUserId,
      };

      const policy = await engine.createPolicy(config);

      expect(policy).toBeDefined();
      expect(policy.id).toBeDefined();
      expect(policy.healthSystemId).toBe(testHealthSystemId);
      expect(policy.policyName).toBe('High Risk Requires Approval');
      expect(policy.policyType).toBe('approval_required');
      expect(policy.scope).toBe('all_ai');
      expect(policy.active).toBe(true);
      expect(policy.createdBy).toBe(testUserId);
    });

    it('should create a policy with department scope filter', async () => {
      const config = {
        healthSystemId: testHealthSystemId,
        policyName: 'Cardiology Monitoring',
        policyType: 'monitored' as const,
        scope: 'department' as const,
        scopeFilter: {
          departments: ['Cardiology', 'Radiology'],
        },
        enforcementActions: {
          sendAlert: true,
        },
        createdBy: testUserId,
      };

      const policy = await engine.createPolicy(config);

      expect(policy.scope).toBe('department');
      expect(policy.scopeFilter).toBeDefined();
      expect(policy.scopeFilter.departments).toEqual(['Cardiology', 'Radiology']);
    });

    it('should create a policy with risk level conditions', async () => {
      const config = {
        healthSystemId: testHealthSystemId,
        policyName: 'Block High Risk AI',
        policyType: 'prohibited' as const,
        scope: 'all_ai' as const,
        conditions: {
          minRiskScore: 80,
          requiresCertification: true,
        },
        enforcementActions: {
          blockDeployment: true,
          escalateToAdmin: true,
        },
        createdBy: testUserId,
      };

      const policy = await engine.createPolicy(config);

      expect(policy.conditions).toBeDefined();
      expect(policy.conditions.minRiskScore).toBe(80);
      expect(policy.conditions.requiresCertification).toBe(true);
      expect(policy.enforcementActions.blockDeployment).toBe(true);
    });

    it('should create a policy with approval workflow', async () => {
      const config = {
        healthSystemId: testHealthSystemId,
        policyName: 'Critical AI Approval',
        policyType: 'approval_required' as const,
        scope: 'all_ai' as const,
        enforcementActions: {
          requireApproval: true,
        },
        approvalWorkflow: {
          approvers: [testUserId],
          requireAllApprovals: true,
          escalationTimeout: 48,
        },
        createdBy: testUserId,
      };

      const policy = await engine.createPolicy(config);

      expect(policy.approvalWorkflow).toBeDefined();
      expect(policy.approvalWorkflow.approvers).toEqual([testUserId]);
      expect(policy.approvalWorkflow.requireAllApprovals).toBe(true);
      expect(policy.approvalWorkflow.escalationTimeout).toBe(48);
    });
  });

  describe('Evaluate AI System Against Policies', () => {
    it('should pass evaluation when no policies exist', async () => {
      const result = await engine.evaluateAISystem(testAISystemId, 'deployment');

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.requiresApproval).toBe(false);
    });

    it('should detect violation for prohibited high-risk AI', async () => {
      // Create a prohibitive policy
      await engine.createPolicy({
        healthSystemId: testHealthSystemId,
        policyName: 'No High Risk AI',
        policyType: 'prohibited',
        scope: 'all_ai',
        scopeFilter: {
          riskLevels: ['high', 'critical'],
        },
        enforcementActions: {
          blockDeployment: true,
        },
        createdBy: testUserId,
      });

      const result = await engine.evaluateAISystem(testAISystemId, 'deployment');

      expect(result.allowed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].violationType).toBe('prohibited');
      expect(result.violations[0].severity).toBe('critical');
    });

    it('should require approval for high-risk AI systems', async () => {
      // Create approval-required policy
      const policy = await engine.createPolicy({
        healthSystemId: testHealthSystemId,
        policyName: 'High Risk Approval Required',
        policyType: 'approval_required',
        scope: 'all_ai',
        scopeFilter: {
          riskLevels: ['high', 'critical'],
        },
        enforcementActions: {
          requireApproval: true,
        },
        approvalWorkflow: {
          approvers: [testUserId],
          requireAllApprovals: false,
        },
        createdBy: testUserId,
      });

      const result = await engine.evaluateAISystem(testAISystemId, 'deployment');

      expect(result.allowed).toBe(false); // Blocked until approved
      expect(result.requiresApproval).toBe(true);
      expect(result.approvers).toEqual([testUserId]);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].violationType).toBe('approval_required');
    });

    it('should evaluate department-scoped policies correctly', async () => {
      // Create department-specific policy
      await engine.createPolicy({
        healthSystemId: testHealthSystemId,
        policyName: 'Cardiology Monitoring',
        policyType: 'monitored',
        scope: 'department',
        scopeFilter: {
          departments: ['Cardiology'],
        },
        enforcementActions: {
          sendAlert: true,
        },
        createdBy: testUserId,
      });

      const result = await engine.evaluateAISystem(testAISystemId, 'deployment');

      // Should match since AI system is in Cardiology department
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].policyName).toBe('Cardiology Monitoring');
    });

    it('should skip inactive policies during evaluation', async () => {
      // Create policy
      const policy = await engine.createPolicy({
        healthSystemId: testHealthSystemId,
        policyName: 'Test Policy',
        policyType: 'prohibited',
        scope: 'all_ai',
        enforcementActions: {
          blockDeployment: true,
        },
        createdBy: testUserId,
      });

      // Deactivate it
      await engine.updatePolicy(policy.id, { active: false });

      const result = await engine.evaluateAISystem(testAISystemId, 'deployment');

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should evaluate category-scoped policies', async () => {
      await engine.createPolicy({
        healthSystemId: testHealthSystemId,
        policyName: 'CDS Monitoring',
        policyType: 'monitored',
        scope: 'category',
        scopeFilter: {
          categories: ['clinical_decision_support'],
        },
        enforcementActions: {
          sendAlert: true,
        },
        createdBy: testUserId,
      });

      const result = await engine.evaluateAISystem(testAISystemId, 'deployment');

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].policyName).toBe('CDS Monitoring');
    });
  });

  describe('Policy Violation Logging', () => {
    it('should automatically log violations during policy evaluation', async () => {
      // Create a prohibitive policy that will trigger violations
      await engine.createPolicy({
        healthSystemId: testHealthSystemId,
        policyName: 'No High Risk',
        policyType: 'prohibited',
        scope: 'all_ai',
        scopeFilter: {
          riskLevels: ['high'],
        },
        enforcementActions: {
          blockDeployment: true,
        },
        createdBy: testUserId,
      });

      // Trigger evaluation (which logs violations automatically)
      await engine.evaluateAISystem(testAISystemId, 'deployment');

      // Check that violation was logged
      const violations = await engine.getViolations(testHealthSystemId);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].aiSystemId).toBe(testAISystemId);
      expect(violations[0].violationType).toBe('prohibited_ai_system');
      expect(violations[0].actionTaken).toBe('deployment_blocked');
    });

    it('should retrieve violations for a health system', async () => {
      const policy = await engine.createPolicy({
        healthSystemId: testHealthSystemId,
        policyName: 'Test Policy',
        policyType: 'prohibited',
        scope: 'all_ai',
        scopeFilter: {
          riskLevels: ['high'],
        },
        enforcementActions: {
          sendAlert: true,
        },
        createdBy: testUserId,
      });

      // Trigger multiple evaluations (which log violations automatically)
      await engine.evaluateAISystem(testAISystemId, 'deployment');
      await engine.evaluateAISystem(testAISystemId, 'modification');

      const violations = await engine.getViolations(testHealthSystemId);

      expect(violations.length).toBeGreaterThanOrEqual(2);
      expect(violations[0].policyId).toBe(policy.id);
    });

    it('should resolve violations', async () => {
      const policy = await engine.createPolicy({
        healthSystemId: testHealthSystemId,
        policyName: 'Test Policy',
        policyType: 'prohibited',
        scope: 'all_ai',
        scopeFilter: {
          riskLevels: ['high'],
        },
        enforcementActions: {
          sendAlert: true,
        },
        createdBy: testUserId,
      });

      // Create violation
      await engine.evaluateAISystem(testAISystemId, 'deployment');
      
      const violations = await engine.getViolations(testHealthSystemId);
      expect(violations.length).toBeGreaterThan(0);
      
      const violationId = violations[0].id;

      // Resolve it
      await engine.resolveViolation(violationId, testUserId);

      // Fetch again and check it's resolved
      const allViolations = await engine.getViolations(testHealthSystemId);
      const resolvedViolation = allViolations.find(v => v.id === violationId);
      
      expect(resolvedViolation).toBeDefined();
      expect(resolvedViolation!.resolvedBy).toBe(testUserId);
      expect(resolvedViolation!.resolvedAt).toBeDefined();
    });
  });

  describe('Policy Management', () => {
    it('should list all policies for a health system', async () => {
      await engine.createPolicy({
        healthSystemId: testHealthSystemId,
        policyName: 'Policy 1',
        policyType: 'monitored',
        scope: 'all_ai',
        enforcementActions: { sendAlert: true },
        createdBy: testUserId,
      });

      await engine.createPolicy({
        healthSystemId: testHealthSystemId,
        policyName: 'Policy 2',
        policyType: 'approval_required',
        scope: 'department',
        enforcementActions: { requireApproval: true },
        createdBy: testUserId,
      });

      const policies = await engine.getPolicies(testHealthSystemId);

      expect(policies).toHaveLength(2);
      expect(policies.map(p => p.policyName)).toContain('Policy 1');
      expect(policies.map(p => p.policyName)).toContain('Policy 2');
    });

    it('should update policy configuration', async () => {
      const policy = await engine.createPolicy({
        healthSystemId: testHealthSystemId,
        policyName: 'Original Name',
        policyType: 'monitored',
        scope: 'all_ai',
        enforcementActions: { sendAlert: true },
        createdBy: testUserId,
      });

      // Update enforcement actions
      await engine.updatePolicy(policy.id, {
        enforcementActions: {
          sendAlert: true,
          escalateToAdmin: true,
        },
      });

      // Fetch to verify
      const policies = await engine.getPolicies(testHealthSystemId);
      const updated = policies.find(p => p.id === policy.id);

      expect(updated).toBeDefined();
      expect(updated!.enforcementActions.escalateToAdmin).toBe(true);
    });

    it('should deactivate a policy', async () => {
      const policy = await engine.createPolicy({
        healthSystemId: testHealthSystemId,
        policyName: 'Test Policy',
        policyType: 'monitored',
        scope: 'all_ai',
        enforcementActions: { sendAlert: true },
        createdBy: testUserId,
      });

      expect(policy.active).toBe(true);

      // Deactivate
      await engine.updatePolicy(policy.id, { active: false });

      // Fetch to verify
      const policies = await engine.getPolicies(testHealthSystemId);
      const deactivated = policies.find(p => p.id === policy.id);

      expect(deactivated).toBeDefined();
      expect(deactivated!.active).toBe(false);
    });

    it('should delete a policy', async () => {
      const policy = await engine.createPolicy({
        healthSystemId: testHealthSystemId,
        policyName: 'Test Policy',
        policyType: 'monitored',
        scope: 'all_ai',
        enforcementActions: { sendAlert: true },
        createdBy: testUserId,
      });

      await engine.deletePolicy(policy.id);

      const policies = await engine.getPolicies(testHealthSystemId);
      expect(policies).toHaveLength(0);
    });
  });
});
