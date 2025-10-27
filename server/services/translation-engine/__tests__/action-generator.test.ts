import { describe, it, expect } from 'vitest';
import { ActionGenerator } from '../action-generator';
import type { ComplianceViolation } from '../types';

describe('ActionGenerator', () => {
  const generator = new ActionGenerator();

  const mockViolation: ComplianceViolation = {
    framework: 'HIPAA',
    controlId: '164.502(a)',
    controlName: 'Uses and Disclosures of PHI',
    violationType: 'unauthorized_disclosure',
    severity: 'critical',
    requiresReporting: true,
    reportingDeadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    description: 'PHI exposure detected',
    affectedSystem: {} as any,
    detectedAt: new Date(),
  };

  describe('Critical Violations', () => {
    it('should generate immediate actions for critical PHI violations', () => {
      const actionMap = generator.generate([mockViolation]);
      const actions = actionMap.get(mockViolation);
      
      expect(actions).toBeDefined();
      expect(actions!.length).toBeGreaterThan(0);
      
      const immediateAction = actions!.find(a => a.priority === 'critical');
      expect(immediateAction).toBeDefined();
      expect(immediateAction!.deadline).toBeDefined();
      
      // Critical actions should have short deadlines
      const hoursUntilDeadline = (immediateAction!.deadline!.getTime() - Date.now()) / (1000 * 60 * 60);
      expect(hoursUntilDeadline).toBeLessThanOrEqual(24);
    });

    it('should include system suspension for critical violations', () => {
      const actionMap = generator.generate([mockViolation]);
      const actions = actionMap.get(mockViolation);
      
      const suspendAction = actions!.find(a => 
        a.action.toLowerCase().includes('suspend') || 
        a.action.toLowerCase().includes('disable')
      );
      
      expect(suspendAction).toBeDefined();
      expect(suspendAction!.automated).toBe(true);
    });

    it('should require notification for reportable violations', () => {
      const actionMap = generator.generate([mockViolation]);
      const actions = actionMap.get(mockViolation);
      
      const notifyAction = actions!.find(a => 
        a.action.toLowerCase().includes('notify') ||
        a.action.toLowerCase().includes('report')
      );
      
      expect(notifyAction).toBeDefined();
    });
  });

  describe('High Severity Violations', () => {
    it('should generate investigation actions for bias detection', () => {
      const biasViolation: ComplianceViolation = {
        framework: 'NIST_AI_RMF',
        controlId: 'MANAGE-2.1',
        controlName: 'Bias Testing',
        violationType: 'bias_violation',
        severity: 'high',
        requiresReporting: false,
        description: 'Bias detected in model predictions',
        affectedSystem: {} as any,
        detectedAt: new Date(),
      };

      const actionMap = generator.generate([biasViolation]);
      const actions = actionMap.get(biasViolation);
      
      expect(actions).toBeDefined();
      const investigateAction = actions!.find(a => 
        a.action.toLowerCase().includes('investigate') ||
        a.action.toLowerCase().includes('audit')
      );
      
      expect(investigateAction).toBeDefined();
      expect(investigateAction!.priority).toBe('high');
    });

    it('should generate remediation actions with reasonable deadlines', () => {
      const driftViolation: ComplianceViolation = {
        framework: 'FDA_SAMD',
        controlId: 'FDA-PM-001',
        controlName: 'Post-Market Surveillance',
        violationType: 'performance_degradation',
        severity: 'high',
        requiresReporting: true,
        reportingDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        description: 'Model drift detected',
        affectedSystem: {} as any,
        detectedAt: new Date(),
      };

      const actionMap = generator.generate([driftViolation]);
      const actions = actionMap.get(driftViolation);
      
      expect(actions).toBeDefined();
      actions!.forEach(action => {
        if (action.deadline) {
          const daysUntilDeadline = (action.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          expect(daysUntilDeadline).toBeGreaterThan(0);
          expect(daysUntilDeadline).toBeLessThanOrEqual(30);
        }
      });
    });
  });

  describe('Medium Severity Violations', () => {
    it('should generate monitoring actions for medium violations', () => {
      const mediumViolation: ComplianceViolation = {
        framework: 'NIST_AI_RMF',
        controlId: 'MEASURE-2.1',
        controlName: 'Performance Monitoring',
        violationType: 'performance_issue',
        severity: 'medium',
        requiresReporting: false,
        description: 'Performance degradation observed',
        affectedSystem: {} as any,
        detectedAt: new Date(),
      };

      const actionMap = generator.generate([mediumViolation]);
      const actions = actionMap.get(mediumViolation);
      
      expect(actions).toBeDefined();
      const monitorAction = actions!.find(a => 
        a.action.toLowerCase().includes('monitor') ||
        a.action.toLowerCase().includes('review')
      );
      
      expect(monitorAction).toBeDefined();
      expect(monitorAction!.priority).toBe('medium');
    });
  });

  describe('Action Prioritization', () => {
    it('should prioritize actions by severity', () => {
      const violations: ComplianceViolation[] = [
        {
          ...mockViolation,
          severity: 'critical',
        },
        {
          ...mockViolation,
          severity: 'high',
        },
        {
          ...mockViolation,
          severity: 'medium',
        },
      ];

      const actionMap = generator.generate(violations);
      
      violations.forEach(violation => {
        const actions = actionMap.get(violation);
        expect(actions).toBeDefined();
        
        const topPriority = actions![0];
        if (violation.severity === 'critical') {
          expect(topPriority.priority).toBe('critical');
        } else if (violation.severity === 'high') {
          expect(['critical', 'high']).toContain(topPriority.priority);
        }
      });
    });

    it('should generate automated actions when possible', () => {
      const actionMap = generator.generate([mockViolation]);
      const actions = actionMap.get(mockViolation);
      
      const automatedActions = actions!.filter(a => a.automated);
      expect(automatedActions.length).toBeGreaterThan(0);
      
      // Automated actions should be clearly marked
      automatedActions.forEach(action => {
        expect(action.automated).toBe(true);
      });
    });
  });

  describe('Action Assignment', () => {
    it('should assign critical actions to appropriate roles', () => {
      const actionMap = generator.generate([mockViolation]);
      const actions = actionMap.get(mockViolation);
      
      actions!.forEach(action => {
        expect(action.assignedTo).toBeDefined();
        expect(['security_team', 'compliance_officer', 'system_admin', 'ai_team', 'automated']).toContain(action.assignedTo);
      });
    });

    it('should assign compliance reporting to compliance officer', () => {
      const reportableViolation: ComplianceViolation = {
        ...mockViolation,
        requiresReporting: true,
      };

      const actionMap = generator.generate([reportableViolation]);
      const actions = actionMap.get(reportableViolation);
      
      const reportingAction = actions!.find(a => 
        a.action.toLowerCase().includes('report') ||
        a.action.toLowerCase().includes('notify')
      );
      
      expect(reportingAction).toBeDefined();
      expect(reportingAction!.assignedTo).toBe('compliance_officer');
    });
  });

  describe('Deadline Calculation', () => {
    it('should respect reporting deadlines from violations', () => {
      const deadline = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days
      const reportableViolation: ComplianceViolation = {
        ...mockViolation,
        requiresReporting: true,
        reportingDeadline: deadline,
      };

      const actionMap = generator.generate([reportableViolation]);
      const actions = actionMap.get(reportableViolation);
      
      const reportingAction = actions!.find(a => a.action.toLowerCase().includes('report'));
      
      expect(reportingAction).toBeDefined();
      expect(reportingAction!.deadline).toBeDefined();
      
      // Reporting deadline should be before or equal to violation deadline
      expect(reportingAction!.deadline!.getTime()).toBeLessThanOrEqual(deadline.getTime());
    });

    it('should set immediate deadlines for critical automated actions', () => {
      const actionMap = generator.generate([mockViolation]);
      const actions = actionMap.get(mockViolation);
      
      const criticalAutomated = actions!.find(a => a.priority === 'critical' && a.automated);
      
      if (criticalAutomated && criticalAutomated.deadline) {
        const hoursUntilDeadline = (criticalAutomated.deadline.getTime() - Date.now()) / (1000 * 60 * 60);
        expect(hoursUntilDeadline).toBeLessThanOrEqual(1); // Within 1 hour
      }
    });
  });

  describe('Multiple Violations', () => {
    it('should generate distinct actions for each violation', () => {
      const violations: ComplianceViolation[] = [
        mockViolation,
        {
          ...mockViolation,
          framework: 'NIST_AI_RMF',
          controlId: 'GOVERN-1.1',
        },
        {
          ...mockViolation,
          framework: 'FDA_SAMD',
          controlId: 'FDA-PS-001',
        },
      ];

      const actionMap = generator.generate(violations);
      
      expect(actionMap.size).toBe(violations.length);
      
      violations.forEach(violation => {
        const actions = actionMap.get(violation);
        expect(actions).toBeDefined();
        expect(actions!.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Framework-Specific Actions', () => {
    it('should generate HIPAA breach notification actions', () => {
      const hipaaViolation: ComplianceViolation = {
        framework: 'HIPAA',
        controlId: '164.404',
        controlName: 'Breach Notification',
        violationType: 'unauthorized_disclosure',
        severity: 'critical',
        requiresReporting: true,
        reportingDeadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        description: 'Breach of unsecured PHI',
        affectedSystem: {} as any,
        detectedAt: new Date(),
      };

      const actionMap = generator.generate([hipaaViolation]);
      const actions = actionMap.get(hipaaViolation);
      
      const notificationActions = actions!.filter(a => 
        a.action.toLowerCase().includes('notify') ||
        a.action.toLowerCase().includes('breach')
      );
      
      expect(notificationActions.length).toBeGreaterThan(0);
    });

    it('should generate FDA post-market surveillance actions', () => {
      const fdaViolation: ComplianceViolation = {
        framework: 'FDA_SAMD',
        controlId: 'FDA-PM-002',
        controlName: 'Adverse Event Reporting',
        violationType: 'safety_issue',
        severity: 'critical',
        requiresReporting: true,
        reportingDeadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        description: 'Safety issue detected',
        affectedSystem: {} as any,
        detectedAt: new Date(),
      };

      const actionMap = generator.generate([fdaViolation]);
      const actions = actionMap.get(fdaViolation);
      
      const fdaReporting = actions!.find(a => 
        a.action.toLowerCase().includes('fda') ||
        a.action.toLowerCase().includes('adverse')
      );
      
      expect(fdaReporting).toBeDefined();
    });
  });
});
