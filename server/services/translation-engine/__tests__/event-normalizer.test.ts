import { describe, it, expect } from 'vitest';
import { EventNormalizer } from '../event-normalizer';
import type { AITelemetryEvent } from '@shared/schema';

describe('EventNormalizer', () => {
  const normalizer = new EventNormalizer();

  describe('Privacy Events', () => {
    it('should detect PHI exposure from eventType', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'phi_exposure',
        metric: 'privacy_violation',
        source: 'langsmith',
      };

      const result = normalizer.normalize(event as AITelemetryEvent, {});
      
      expect(result.eventType).toBe('phi_exposure');
      expect(result.severity).toBe('critical');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect PHI exposure from metric field', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'trace_captured',
        metric: 'phi_detected',
        source: 'arize',
      };

      const result = normalizer.normalize(event as AITelemetryEvent, {});
      
      expect(result.eventType).toBe('phi_exposure');
      expect(result.severity).toBe('critical');
    });

    it('should detect unauthorized data access', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'unauthorized_access',
        metric: 'access_denied',
        source: 'langfuse',
      };

      const result = normalizer.normalize(event as AITelemetryEvent, {});
      
      expect(result.eventType).toBe('unauthorized_data_access');
      expect(result.severity).toBe('high');
    });
  });

  describe('Security Events', () => {
    it('should detect authentication failures', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'auth_failed',
        metric: 'authentication_error',
        source: 'langsmith',
      };

      const result = normalizer.normalize(event as AITelemetryEvent, {});
      
      expect(result.eventType).toBe('authentication_failure');
      expect(result.severity).toBe('high');
    });

    it('should detect prompt injection attempts', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'security_alert',
        metric: 'prompt_injection',
        source: 'arize',
      };

      const result = normalizer.normalize(event as AITelemetryEvent, {});
      
      expect(result.eventType).toBe('prompt_injection');
      expect(result.severity).toBe('high');
    });

    it('should detect encryption failures', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'encryption_error',
        metric: 'crypto_failure',
        source: 'wandb',
      };

      const result = normalizer.normalize(event as AITelemetryEvent, {});
      
      expect(result.eventType).toBe('encryption_failure');
      expect(result.severity).toBe('high');
    });
  });

  describe('Performance Events', () => {
    it('should detect model drift', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'drift_detected',
        metric: 'model_performance_degradation',
        source: 'arize',
      };

      const result = normalizer.normalize(event as AITelemetryEvent, {});
      
      expect(result.eventType).toBe('model_drift');
      expect(result.severity).toBe('medium');
    });

    it('should detect high latency', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'performance_alert',
        metric: 'high_latency',
        source: 'langsmith',
      };

      const result = normalizer.normalize(event as AITelemetryEvent, {
        latency_ms: 5000,
      });
      
      expect(result.eventType).toBe('high_latency');
      expect(result.severity).toBe('medium');
      expect(result.metrics).toHaveProperty('latency_ms', 5000);
    });

    it('should detect inference errors', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'inference_failed',
        metric: 'error_rate',
        source: 'wandb',
      };

      const result = normalizer.normalize(event as AITelemetryEvent, {
        error_rate: 0.15,
      });
      
      expect(result.eventType).toBe('inference_error');
      expect(result.severity).toBe('high');
    });
  });

  describe('Safety Events', () => {
    it('should detect hallucinations', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'hallucination_detected',
        metric: 'factuality_check_failed',
        source: 'langfuse',
      };

      const result = normalizer.normalize(event as AITelemetryEvent, {});
      
      expect(result.eventType).toBe('hallucination');
      expect(result.severity).toBe('high');
    });

    it('should detect unsafe outputs', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'safety_violation',
        metric: 'harmful_content',
        source: 'arize',
      };

      const result = normalizer.normalize(event as AITelemetryEvent, {});
      
      expect(result.eventType).toBe('unsafe_output');
      expect(result.severity).toBe('critical');
    });

    it('should detect clinical inaccuracies', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'clinical_error',
        metric: 'diagnosis_mismatch',
        source: 'custom',
      };

      const result = normalizer.normalize(event as AITelemetryEvent, {});
      
      expect(result.eventType).toBe('clinical_inaccuracy');
      expect(result.severity).toBe('critical');
    });
  });

  describe('Fairness Events', () => {
    it('should detect bias', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'bias_detected',
        metric: 'demographic_parity_violation',
        source: 'arize',
      };

      const result = normalizer.normalize(event as AITelemetryEvent, {
        disparity_ratio: 1.8,
      });
      
      expect(result.eventType).toBe('bias_detected');
      expect(result.severity).toBe('high');
    });

    it('should detect disparate impact', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'fairness_alert',
        metric: 'disparate_impact',
        source: 'wandb',
      };

      const result = normalizer.normalize(event as AITelemetryEvent, {});
      
      expect(result.eventType).toBe('disparate_impact');
      expect(result.severity).toBe('high');
    });
  });

  describe('Quality Events', () => {
    it('should detect data quality issues', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'data_quality_alert',
        metric: 'missing_values',
        source: 'arize',
      };

      const result = normalizer.normalize(event as AITelemetryEvent, {
        missing_rate: 0.25,
      });
      
      expect(result.eventType).toBe('data_quality_issue');
      expect(result.severity).toBe('medium');
    });

    it('should detect training data leakage', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'data_leakage',
        metric: 'train_test_overlap',
        source: 'wandb',
      };

      const result = normalizer.normalize(event as AITelemetryEvent, {});
      
      expect(result.eventType).toBe('training_data_leakage');
      expect(result.severity).toBe('high');
    });
  });

  describe('Source-Specific Normalization', () => {
    it('should handle LangSmith-specific events', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'langsmith_trace',
        metric: 'phi_in_trace',
        source: 'langsmith',
      };

      const result = normalizer.normalize(event as AITelemetryEvent, {});
      
      expect(result.eventType).toBe('phi_exposure');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should handle Arize-specific events', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'arize_monitor',
        metric: 'prediction_drift',
        source: 'arize',
      };

      const result = normalizer.normalize(event as AITelemetryEvent, {});
      
      expect(result.eventType).toBe('model_drift');
    });
  });

  describe('Fallback Behavior', () => {
    it('should provide default classification for unknown events', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'unknown_event_type',
        metric: 'unknown_metric',
        source: 'custom',
      };

      const result = normalizer.normalize(event as AITelemetryEvent, {});
      
      expect(result).toBeDefined();
      expect(result.eventType).toBeDefined();
      expect(result.severity).toBeDefined();
      expect(result.confidence).toBeLessThan(0.5); // Low confidence for unknowns
    });
  });

  describe('Metrics Extraction', () => {
    it('should preserve payload metrics', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'performance_alert',
        metric: 'latency',
        source: 'langsmith',
      };

      const payload = {
        latency_ms: 3500,
        throughput: 100,
        error_count: 5,
      };

      const result = normalizer.normalize(event as AITelemetryEvent, payload);
      
      expect(result.metrics).toEqual(payload);
    });

    it('should handle empty payloads', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'auth_failed',
        metric: 'login_error',
        source: 'custom',
      };

      const result = normalizer.normalize(event as AITelemetryEvent, {});
      
      expect(result.metrics).toEqual({});
    });
  });

  describe('Confidence Scoring', () => {
    it('should assign high confidence for exact matches', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'phi_exposure',
        metric: 'phi_detected',
        source: 'langsmith',
      };

      const result = normalizer.normalize(event as AITelemetryEvent, {});
      
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should assign medium confidence for keyword matches', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'security_event',
        metric: 'phi_related',
        source: 'custom',
      };

      const result = normalizer.normalize(event as AITelemetryEvent, {});
      
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.confidence).toBeLessThan(0.9);
    });

    it('should assign low confidence for ambiguous events', () => {
      const event: Partial<AITelemetryEvent> = {
        eventType: 'generic_alert',
        metric: 'something_happened',
        source: 'unknown',
      };

      const result = normalizer.normalize(event as AITelemetryEvent, {});
      
      expect(result.confidence).toBeLessThan(0.5);
    });
  });
});
