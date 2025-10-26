import { db } from '../../db';
import { eventTypes } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

interface EventTypeDefinition {
  eventType: string;
  category: 'privacy' | 'performance' | 'safety' | 'security' | 'fairness' | 'quality';
  description: string;
  telemetryFields: string[];
  normalizer: string;
  defaultSeverity: 'low' | 'medium' | 'high' | 'critical';
}

const EVENT_TYPES_CATALOG: EventTypeDefinition[] = [
  {
    eventType: 'phi_exposure',
    category: 'privacy',
    description: 'Protected Health Information detected in AI model output',
    telemetryFields: ['output_text', 'phi_patterns', 'patient_identifiers', 'confidence_score'],
    normalizer: 'phiExposureNormalizer',
    defaultSeverity: 'critical',
  },
  {
    eventType: 'unauthorized_data_access',
    category: 'privacy',
    description: 'AI system accessed patient data without proper authorization',
    telemetryFields: ['user_id', 'patient_id', 'data_type', 'access_timestamp', 'authorization_level'],
    normalizer: 'dataAccessNormalizer',
    defaultSeverity: 'critical',
  },
  {
    eventType: 'data_breach_attempt',
    category: 'security',
    description: 'Attempted unauthorized data extraction or exfiltration',
    telemetryFields: ['source_ip', 'attempted_data', 'volume', 'timestamp', 'blocked'],
    normalizer: 'securityEventNormalizer',
    defaultSeverity: 'critical',
  },
  {
    eventType: 'model_drift',
    category: 'performance',
    description: 'AI model performance has degraded beyond acceptable thresholds',
    telemetryFields: ['accuracy_drop', 'baseline_accuracy', 'current_accuracy', 'sample_size', 'detection_date'],
    normalizer: 'modelDriftNormalizer',
    defaultSeverity: 'high',
  },
  {
    eventType: 'prediction_accuracy_drop',
    category: 'performance',
    description: 'Prediction accuracy has fallen below acceptable levels',
    telemetryFields: ['metric', 'threshold', 'current_value', 'baseline_value', 'degradation_percentage'],
    normalizer: 'performanceNormalizer',
    defaultSeverity: 'high',
  },
  {
    eventType: 'latency_threshold_exceeded',
    category: 'performance',
    description: 'AI system response time exceeded SLA thresholds',
    telemetryFields: ['latency_ms', 'threshold_ms', 'p95_latency', 'p99_latency', 'endpoint'],
    normalizer: 'latencyNormalizer',
    defaultSeverity: 'medium',
  },
  {
    eventType: 'clinical_accuracy_failure',
    category: 'safety',
    description: 'Clinical prediction failed to meet accuracy requirements',
    telemetryFields: ['prediction', 'ground_truth', 'confidence', 'clinical_context', 'impact_level'],
    normalizer: 'clinicalAccuracyNormalizer',
    defaultSeverity: 'critical',
  },
  {
    eventType: 'false_negative_alert',
    category: 'safety',
    description: 'AI failed to detect a critical condition (Type II error)',
    telemetryFields: ['missed_condition', 'severity', 'patient_context', 'clinical_impact', 'timestamp'],
    normalizer: 'falseNegativeNormalizer',
    defaultSeverity: 'critical',
  },
  {
    eventType: 'false_positive_alert',
    category: 'safety',
    description: 'AI incorrectly flagged a non-existent condition (Type I error)',
    telemetryFields: ['flagged_condition', 'actual_condition', 'confidence', 'clinical_impact', 'timestamp'],
    normalizer: 'falsePositiveNormalizer',
    defaultSeverity: 'high',
  },
  {
    eventType: 'harmful_output',
    category: 'safety',
    description: 'AI generated potentially harmful medical advice or recommendation',
    telemetryFields: ['output_text', 'harm_category', 'severity_score', 'clinical_context', 'detected_by'],
    normalizer: 'harmfulOutputNormalizer',
    defaultSeverity: 'critical',
  },
  {
    eventType: 'bias_detected',
    category: 'fairness',
    description: 'Statistical bias detected across demographic groups',
    telemetryFields: ['demographic_attribute', 'variance_percentage', 'affected_groups', 'sample_sizes', 'statistical_significance'],
    normalizer: 'biasDetectionNormalizer',
    defaultSeverity: 'critical',
  },
  {
    eventType: 'disparate_impact',
    category: 'fairness',
    description: 'Disproportionate negative impact on protected demographic groups',
    telemetryFields: ['protected_class', 'impact_ratio', 'baseline_rate', 'affected_rate', 'sample_size'],
    normalizer: 'disparateImpactNormalizer',
    defaultSeverity: 'critical',
  },
  {
    eventType: 'fairness_threshold_violation',
    category: 'fairness',
    description: 'Fairness metric exceeded acceptable variance thresholds',
    telemetryFields: ['metric_name', 'threshold', 'measured_value', 'demographic_groups', 'test_date'],
    normalizer: 'fairnessNormalizer',
    defaultSeverity: 'high',
  },
  {
    eventType: 'data_quality_degradation',
    category: 'quality',
    description: 'Training or input data quality has degraded',
    telemetryFields: ['quality_metric', 'threshold', 'current_value', 'affected_features', 'sample_period'],
    normalizer: 'dataQualityNormalizer',
    defaultSeverity: 'high',
  },
  {
    eventType: 'input_validation_failure',
    category: 'security',
    description: 'Invalid or malicious input detected in AI system',
    telemetryFields: ['input_data', 'validation_rule', 'attack_type', 'source', 'blocked'],
    normalizer: 'inputValidationNormalizer',
    defaultSeverity: 'high',
  },
  {
    eventType: 'prompt_injection_attempt',
    category: 'security',
    description: 'Attempted prompt injection or jailbreak attack detected',
    telemetryFields: ['prompt', 'injection_pattern', 'severity', 'source', 'blocked'],
    normalizer: 'promptInjectionNormalizer',
    defaultSeverity: 'critical',
  },
  {
    eventType: 'authentication_failure',
    category: 'security',
    description: 'Failed authentication attempt to AI system',
    telemetryFields: ['user_id', 'source_ip', 'failure_reason', 'timestamp', 'attempt_count'],
    normalizer: 'authenticationNormalizer',
    defaultSeverity: 'high',
  },
  {
    eventType: 'rate_limit_exceeded',
    category: 'security',
    description: 'API rate limit exceeded indicating potential abuse',
    telemetryFields: ['user_id', 'endpoint', 'request_count', 'time_window', 'limit'],
    normalizer: 'rateLimitNormalizer',
    defaultSeverity: 'medium',
  },
  {
    eventType: 'model_version_mismatch',
    category: 'quality',
    description: 'Production model version differs from expected version',
    telemetryFields: ['expected_version', 'actual_version', 'deployment_id', 'detected_timestamp'],
    normalizer: 'versionMismatchNormalizer',
    defaultSeverity: 'high',
  },
  {
    eventType: 'explainability_failure',
    category: 'quality',
    description: 'Unable to generate explanation for AI decision',
    telemetryFields: ['prediction', 'explainability_method', 'failure_reason', 'clinical_context'],
    normalizer: 'explainabilityNormalizer',
    defaultSeverity: 'medium',
  },
];

export class EventTypesTaxonomy {
  async initializeTaxonomy(): Promise<void> {
    console.log('Initializing event types taxonomy...');
    
    for (const eventTypeDef of EVENT_TYPES_CATALOG) {
      const existing = await db.query.eventTypes.findFirst({
        where: eq(eventTypes.eventType, eventTypeDef.eventType),
      });

      if (!existing) {
        await db.insert(eventTypes).values({
          eventType: eventTypeDef.eventType,
          category: eventTypeDef.category,
          description: eventTypeDef.description,
          telemetryFields: eventTypeDef.telemetryFields,
          normalizer: eventTypeDef.normalizer,
          defaultSeverity: eventTypeDef.defaultSeverity,
          active: true,
        });
        console.log(`✓ Added event type: ${eventTypeDef.eventType}`);
      }
    }

    console.log(`✓ Event types taxonomy initialized with ${EVENT_TYPES_CATALOG.length} types`);
  }

  async getEventTypesByCategory(category: string) {
    return EVENT_TYPES_CATALOG.filter(e => e.category === category);
  }

  async getEventTypeByName(eventType: string) {
    return EVENT_TYPES_CATALOG.find(e => e.eventType === eventType);
  }

  async getAllEventTypes() {
    return EVENT_TYPES_CATALOG;
  }

  getEventTypesCount(): { total: number; byCategory: Record<string, number> } {
    const byCategory: Record<string, number> = {};
    
    for (const eventType of EVENT_TYPES_CATALOG) {
      byCategory[eventType.category] = (byCategory[eventType.category] || 0) + 1;
    }

    return {
      total: EVENT_TYPES_CATALOG.length,
      byCategory,
    };
  }

  async getNormalizerFunction(eventType: string): Promise<string | null> {
    const event = EVENT_TYPES_CATALOG.find(e => e.eventType === eventType);
    return event?.normalizer || null;
  }
}

export const eventTypesTaxonomy = new EventTypesTaxonomy();
