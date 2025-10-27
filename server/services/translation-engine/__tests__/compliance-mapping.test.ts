import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComplianceMapping } from '../compliance-mapping';
import type { ParsedEvent, AISystem } from '../types';

// Mock the dependencies
vi.mock('../../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../storage', () => ({
  storage: {
    getCustomThresholds: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('../policy-loader', () => ({
  policyLoader: {
    getPolicy: vi.fn(() => Promise.resolve(null)), // Default to static fallback
  },
}));

describe('ComplianceMapping', () => {
  let mapping: ComplianceMapping;

  beforeEach(() => {
    mapping = new ComplianceMapping();
  });

  const mockAISystem: Partial<AISystem> = {
    id: 'test-system-1',
    name: 'Test AI System',
    healthSystemId: 'test-health-system',
  };

  describe('PHI Exposure Mapping', () => {
    it('should map PHI exposure to HIPAA Privacy Rule violations', async () => {
      const event: ParsedEvent = {
        eventType: 'phi_exposure',
        severity: 'critical',
        timestamp: new Date(),
        source: 'langsmith',
        metrics: {},
        rawPayload: {},
      };

      const violations = await mapping.mapToCompliance(event, mockAISystem as AISystem);
      
      const hipaaViolations = violations.filter(v => v.framework === 'HIPAA');
      expect(hipaaViolations.length).toBeGreaterThan(0);
      expect(hipaaViolations[0].controlId).toContain('164.502');
      expect(hipaaViolations[0].severity).toBe('critical');
      expect(hipaaViolations[0].requiresReporting).toBe(true);
    });

    it('should map PHI exposure to NIST AI RMF Govern controls', async () => {
      const event: ParsedEvent = {
        eventType: 'phi_exposure',
        severity: 'critical',
        timestamp: new Date(),
        source: 'arize',
        metrics: {},
        rawPayload: {},
      };

      const violations = await mapping.mapToCompliance(event, mockAISystem as AISystem);
      
      const nistViolations = violations.filter(v => v.framework === 'NIST_AI_RMF');
      expect(nistViolations.length).toBeGreaterThan(0);
      expect(nistViolations[0].controlId).toContain('GOVERN');
    });

    it('should set reporting deadline for PHI breaches', async () => {
      const event: ParsedEvent = {
        eventType: 'phi_exposure',
        severity: 'critical',
        timestamp: new Date(),
        source: 'langsmith',
        metrics: {},
        rawPayload: {},
      };

      const violations = await mapping.mapToCompliance(event, mockAISystem as AISystem);
      
      const reportableViolation = violations.find(v => v.requiresReporting);
      expect(reportableViolation).toBeDefined();
      expect(reportableViolation!.reportingDeadline).toBeDefined();
      
      // HIPAA breach notification: 60 days
      const daysDiff = Math.ceil(
        (reportableViolation!.reportingDeadline!.getTime() - new Date().getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBeLessThanOrEqual(60);
    });
  });

  describe('Bias Detection Mapping', () => {
    it('should map bias to multiple frameworks', async () => {
      const event: ParsedEvent = {
        eventType: 'bias_detected',
        severity: 'high',
        timestamp: new Date(),
        source: 'arize',
        metrics: { disparity_ratio: 1.8 },
        rawPayload: {},
      };

      const violations = await mapping.mapToCompliance(event, mockAISystem as AISystem);
      
      // Should map to both NIST AI RMF and potentially state laws
      expect(violations.length).toBeGreaterThan(0);
      
      const frameworks = new Set(violations.map(v => v.framework));
      expect(frameworks.has('NIST_AI_RMF')).toBe(true);
    });

    it('should include disparity metrics in violation', async () => {
      const event: ParsedEvent = {
        eventType: 'bias_detected',
        severity: 'high',
        timestamp: new Date(),
        source: 'arize',
        metrics: { disparity_ratio: 1.8, protected_group: 'race' },
        rawPayload: {},
      };

      const violations = await mapping.mapToCompliance(event, mockAISystem as AISystem);
      
      const biasViolation = violations[0];
      expect(biasViolation.description).toContain('bias');
    });
  });

  describe('Model Drift Mapping', () => {
    it('should map drift to FDA SaMD monitoring requirements', async () => {
      const event: ParsedEvent = {
        eventType: 'model_drift',
        severity: 'medium',
        timestamp: new Date(),
        source: 'arize',
        metrics: { drift_score: 0.35 },
        rawPayload: {},
      };

      const violations = await mapping.mapToCompliance(event, mockAISystem as AISystem);
      
      const fdaViolations = violations.filter(v => v.framework === 'FDA_SAMD');
      expect(fdaViolations.length).toBeGreaterThan(0);
    });

    it('should map drift to NIST AI RMF Measure controls', async () => {
      const event: ParsedEvent = {
        eventType: 'model_drift',
        severity: 'medium',
        timestamp: new Date(),
        source: 'arize',
        metrics: {},
        rawPayload: {},
      };

      const violations = await mapping.mapToCompliance(event, mockAISystem as AISystem);
      
      const nistViolations = violations.filter(v => v.framework === 'NIST_AI_RMF');
      expect(nistViolations.length).toBeGreaterThan(0);
      expect(nistViolations[0].controlId).toContain('MEASURE');
    });
  });

  describe('Clinical Safety Mapping', () => {
    it('should map hallucinations to clinical safety controls', async () => {
      const event: ParsedEvent = {
        eventType: 'hallucination',
        severity: 'high',
        timestamp: new Date(),
        source: 'langfuse',
        metrics: {},
        rawPayload: {},
      };

      const violations = await mapping.mapToCompliance(event, mockAISystem as AISystem);
      
      expect(violations.length).toBeGreaterThan(0);
      const criticalViolations = violations.filter(v => v.severity === 'critical' || v.severity === 'high');
      expect(criticalViolations.length).toBeGreaterThan(0);
    });

    it('should map clinical inaccuracies to FDA requirements', async () => {
      const event: ParsedEvent = {
        eventType: 'clinical_inaccuracy',
        severity: 'critical',
        timestamp: new Date(),
        source: 'custom',
        metrics: {},
        rawPayload: {},
      };

      const violations = await mapping.mapToCompliance(event, mockAISystem as AISystem);
      
      const fdaViolations = violations.filter(v => v.framework === 'FDA_SAMD');
      expect(fdaViolations.length).toBeGreaterThan(0);
      expect(fdaViolations[0].severity).toBe('critical');
    });
  });

  describe('Security Event Mapping', () => {
    it('should map authentication failures to HIPAA Security Rule', async () => {
      const event: ParsedEvent = {
        eventType: 'authentication_failure',
        severity: 'high',
        timestamp: new Date(),
        source: 'langsmith',
        metrics: {},
        rawPayload: {},
      };

      const violations = await mapping.mapToCompliance(event, mockAISystem as AISystem);
      
      const hipaaViolations = violations.filter(v => v.framework === 'HIPAA');
      expect(hipaaViolations.length).toBeGreaterThan(0);
      expect(hipaaViolations[0].controlId).toContain('164.312');
    });

    it('should map prompt injection to multiple security frameworks', async () => {
      const event: ParsedEvent = {
        eventType: 'prompt_injection',
        severity: 'high',
        timestamp: new Date(),
        source: 'arize',
        metrics: {},
        rawPayload: {},
      };

      const violations = await mapping.mapToCompliance(event, mockAISystem as AISystem);
      
      expect(violations.length).toBeGreaterThan(0);
      // Should map to NIST AI RMF security controls
      const nistViolations = violations.filter(v => v.framework === 'NIST_AI_RMF');
      expect(nistViolations.length).toBeGreaterThan(0);
    });
  });

  describe('State Law Mapping', () => {
    it('should apply California AI transparency requirements', async () => {
      const event: ParsedEvent = {
        eventType: 'bias_detected',
        severity: 'high',
        timestamp: new Date(),
        source: 'arize',
        metrics: {},
        rawPayload: {},
      };

      const violations = await mapping.mapToCompliance(event, mockAISystem as AISystem, {
        state: 'CA',
      });
      
      const caViolations = violations.filter(v => v.framework === 'STATE_CA');
      expect(caViolations.length).toBeGreaterThan(0);
    });

    it('should apply New York AI bias audit law', async () => {
      const event: ParsedEvent = {
        eventType: 'bias_detected',
        severity: 'high',
        timestamp: new Date(),
        source: 'arize',
        metrics: {},
        rawPayload: {},
      };

      const violations = await mapping.mapToCompliance(event, mockAISystem as AISystem, {
        state: 'NY',
      });
      
      const nyViolations = violations.filter(v => v.framework === 'STATE_NY');
      expect(nyViolations.length).toBeGreaterThan(0);
    });
  });

  describe('Severity Escalation', () => {
    it('should escalate severity based on system criticality', async () => {
      const criticalSystem: Partial<AISystem> = {
        ...mockAISystem,
        riskLevel: 'critical' as any,
      };

      const event: ParsedEvent = {
        eventType: 'model_drift',
        severity: 'medium',
        timestamp: new Date(),
        source: 'arize',
        metrics: {},
        rawPayload: {},
      };

      const violations = await mapping.mapToCompliance(event, criticalSystem as AISystem);
      
      // Some violations should be escalated for critical systems
      const highSeverityViolations = violations.filter(
        v => v.severity === 'high' || v.severity === 'critical'
      );
      expect(highSeverityViolations.length).toBeGreaterThan(0);
    });
  });

  describe('Multiple Framework Coverage', () => {
    it('should map single event to multiple frameworks', async () => {
      const event: ParsedEvent = {
        eventType: 'phi_exposure',
        severity: 'critical',
        timestamp: new Date(),
        source: 'langsmith',
        metrics: {},
        rawPayload: {},
      };

      const violations = await mapping.mapToCompliance(event, mockAISystem as AISystem);
      
      const frameworks = new Set(violations.map(v => v.framework));
      
      // PHI exposure should violate HIPAA, NIST AI RMF, and potentially others
      expect(frameworks.size).toBeGreaterThanOrEqual(2);
      expect(frameworks.has('HIPAA')).toBe(true);
      expect(frameworks.has('NIST_AI_RMF')).toBe(true);
    });
  });

  describe('Violation Deduplication', () => {
    it('should not create duplicate violations for same control', async () => {
      const event: ParsedEvent = {
        eventType: 'phi_exposure',
        severity: 'critical',
        timestamp: new Date(),
        source: 'langsmith',
        metrics: {},
        rawPayload: {},
      };

      const violations = await mapping.mapToCompliance(event, mockAISystem as AISystem);
      
      const controlIds = violations.map(v => `${v.framework}:${v.controlId}`);
      const uniqueControlIds = new Set(controlIds);
      
      // Should not have duplicate framework:control combinations
      expect(controlIds.length).toBe(uniqueControlIds.size);
    });
  });
});
