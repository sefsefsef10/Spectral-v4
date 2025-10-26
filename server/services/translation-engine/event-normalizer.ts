/**
 * 🔒 EVENT NORMALIZER - Phase 1 Moat Expansion
 * 
 * Normalizes 20 event types from 11 different monitoring platforms
 * Maps vendor-specific telemetry → Standardized compliance events
 * 
 * Part of Translation Engine Core IP
 */

import type { EventType, ParsedEvent, Severity } from "./types";
import type { AITelemetryEvent } from "@shared/schema";

interface NormalizationResult {
  eventType: EventType;
  severity: Severity;
  metrics: ParsedEvent['metrics'];
  confidence: number; // 0-1 confidence in classification
}

/**
 * Event Normalizer - Maps raw telemetry to 20 standardized event types
 */
export class EventNormalizer {
  
  /**
   * Main normalization function
   */
  normalize(event: AITelemetryEvent, payload: any): NormalizationResult {
    const lowercaseType = event.eventType.toLowerCase();
    const lowercaseMetric = event.metric?.toLowerCase() || '';
    const source = event.source.toLowerCase();
    
    // Try category-specific normalizers in order of specificity
    
    // 1. PRIVACY EVENTS (2 types)
    const privacyResult = this.normalizePrivacyEvents(lowercaseType, lowercaseMetric, payload, source);
    if (privacyResult) return privacyResult;
    
    // 2. SECURITY EVENTS (5 types)
    const securityResult = this.normalizeSecurityEvents(lowercaseType, lowercaseMetric, payload, source);
    if (securityResult) return securityResult;
    
    // 3. PERFORMANCE EVENTS (3 types)
    const performanceResult = this.normalizePerformanceEvents(lowercaseType, lowercaseMetric, payload, source);
    if (performanceResult) return performanceResult;
    
    // 4. SAFETY EVENTS (4 types)
    const safetyResult = this.normalizeSafetyEvents(lowercaseType, lowercaseMetric, payload, source);
    if (safetyResult) return safetyResult;
    
    // 5. FAIRNESS EVENTS (3 types)
    const fairnessResult = this.normalizeFairnessEvents(lowercaseType, lowercaseMetric, payload, source);
    if (fairnessResult) return fairnessResult;
    
    // 6. QUALITY EVENTS (3 types)
    const qualityResult = this.normalizeQualityEvents(lowercaseType, lowercaseMetric, payload, source);
    if (qualityResult) return qualityResult;
    
    // Default fallback
    return this.createDefaultResult(event, payload);
  }
  
  // ============================================================
  // PRIVACY EVENTS (2 types)
  // ============================================================
  
  private normalizePrivacyEvents(
    eventType: string,
    metric: string,
    payload: any,
    source: string
  ): NormalizationResult | null {
    
    // PHI Exposure
    if (this.matchesPatterns(eventType, metric, [
      'phi', 'pii', 'patient', 'hipaa', 'privacy', 'leakage', 'exposure',
      'personally_identifiable', 'protected_health', 'ssn', 'mrn'
    ])) {
      return {
        eventType: 'phi_exposure',
        severity: 'critical',
        confidence: 0.95,
        metrics: {
          phiExposureCount: this.extractNumber(payload, ['phi_count', 'exposure_count', 'leak_count']) || 1,
          metricValue: this.extractNumber(payload, ['severity_score', 'risk_score']),
        }
      };
    }
    
    // Unauthorized Data Access
    if (this.matchesPatterns(eventType, metric, [
      'unauthorized', 'access_denied', 'permission', 'forbidden', 
      'unauthenticated', 'data_access', 'breach_attempt'
    ])) {
      return {
        eventType: 'unauthorized_data_access',
        severity: 'high',
        confidence: 0.9,
        metrics: {
          metricValue: this.extractNumber(payload, ['attempt_count', 'access_count']),
        }
      };
    }
    
    return null;
  }
  
  // ============================================================
  // SECURITY EVENTS (5 types)
  // ============================================================
  
  private normalizeSecurityEvents(
    eventType: string,
    metric: string,
    payload: any,
    source: string
  ): NormalizationResult | null {
    
    // Prompt Injection Attempt
    if (this.matchesPatterns(eventType, metric, [
      'injection', 'prompt_injection', 'jailbreak', 'adversarial',
      'malicious_prompt', 'system_prompt', 'escape'
    ])) {
      return {
        eventType: 'prompt_injection_attempt',
        severity: 'high',
        confidence: 0.92,
        metrics: {
          metricValue: this.extractNumber(payload, ['severity', 'confidence', 'threat_score']),
        }
      };
    }
    
    // Authentication Failure
    if (this.matchesPatterns(eventType, metric, [
      'auth', 'authentication', 'login', 'credential', 'token',
      'auth_failed', 'invalid_credentials'
    ])) {
      return {
        eventType: 'authentication_failure',
        severity: 'medium',
        confidence: 0.88,
        metrics: {
          metricValue: this.extractNumber(payload, ['attempt_count', 'failure_count']),
        }
      };
    }
    
    // Rate Limit Exceeded
    if (this.matchesPatterns(eventType, metric, [
      'rate_limit', 'throttle', 'quota', 'limit_exceeded',
      'too_many_requests', 'api_limit'
    ])) {
      return {
        eventType: 'rate_limit_exceeded',
        severity: 'medium',
        confidence: 0.95,
        metrics: {
          metricValue: this.extractNumber(payload, ['request_count', 'rate', 'requests_per_second']),
        }
      };
    }
    
    // Input Validation Failure
    if (this.matchesPatterns(eventType, metric, [
      'validation', 'invalid_input', 'malformed', 'schema',
      'input_error', 'parse_error'
    ])) {
      return {
        eventType: 'input_validation_failure',
        severity: 'low',
        confidence: 0.85,
        metrics: {
          metricValue: this.extractNumber(payload, ['error_count', 'validation_failures']),
        }
      };
    }
    
    // Model Version Mismatch
    if (this.matchesPatterns(eventType, metric, [
      'version', 'mismatch', 'model_version', 'deployment',
      'rollback', 'version_conflict'
    ])) {
      return {
        eventType: 'model_version_mismatch',
        severity: 'medium',
        confidence: 0.87,
        metrics: {
          metricValue: this.extractNumber(payload, ['version_number']),
        }
      };
    }
    
    return null;
  }
  
  // ============================================================
  // PERFORMANCE EVENTS (3 types)
  // ============================================================
  
  private normalizePerformanceEvents(
    eventType: string,
    metric: string,
    payload: any,
    source: string
  ): NormalizationResult | null {
    
    // Model Drift
    if (this.matchesPatterns(eventType, metric, [
      'drift', 'distribution_shift', 'concept_drift', 'data_drift',
      'model_degradation', 'performance_decay'
    ])) {
      const driftScore = this.extractNumber(payload, [
        'drift_score', 'psi', 'kl_divergence', 'wasserstein_distance'
      ]);
      
      return {
        eventType: 'model_drift',
        severity: this.calculateDriftSeverity(driftScore),
        confidence: 0.93,
        metrics: {
          accuracyDrop: this.extractNumber(payload, ['accuracy_drop', 'performance_drop']),
          metricValue: driftScore,
        }
      };
    }
    
    // Performance Degradation
    if (this.matchesPatterns(eventType, metric, [
      'degradation', 'accuracy', 'precision', 'recall', 'f1',
      'performance_drop', 'quality_drop'
    ])) {
      const accuracyDrop = this.extractNumber(payload, ['accuracy_drop', 'performance_drop']);
      
      return {
        eventType: 'performance_degradation',
        severity: this.calculatePerformanceSeverity(accuracyDrop),
        confidence: 0.91,
        metrics: {
          accuracyDrop,
          errorRate: this.extractNumber(payload, ['error_rate', 'failure_rate']),
          metricValue: this.extractNumber(payload, ['current_accuracy', 'current_performance']),
        }
      };
    }
    
    // High Latency
    if (this.matchesPatterns(eventType, metric, [
      'latency', 'response_time', 'duration', 'timeout',
      'slow', 'delay', 'processing_time'
    ])) {
      const latency = this.extractNumber(payload, ['latency', 'response_time', 'duration']);
      
      return {
        eventType: 'high_latency',
        severity: this.calculateLatencySeverity(latency),
        confidence: 0.94,
        metrics: {
          latencyIncreasePct: this.extractNumber(payload, ['latency_increase', 'increase_pct']),
          metricValue: latency,
        }
      };
    }
    
    return null;
  }
  
  // ============================================================
  // SAFETY EVENTS (4 types)
  // ============================================================
  
  private normalizeSafetyEvents(
    eventType: string,
    metric: string,
    payload: any,
    source: string
  ): NormalizationResult | null {
    
    // Clinical Accuracy Failure
    if (this.matchesPatterns(eventType, metric, [
      'clinical', 'medical', 'diagnosis', 'treatment', 'clinical_accuracy',
      'medical_error', 'misdiagnosis'
    ])) {
      return {
        eventType: 'clinical_accuracy_failure',
        severity: 'critical',
        confidence: 0.96,
        metrics: {
          accuracyDrop: this.extractNumber(payload, ['accuracy', 'clinical_accuracy']),
          metricValue: this.extractNumber(payload, ['error_count', 'failure_count']),
        }
      };
    }
    
    // False Negative Alert
    if (this.matchesPatterns(eventType, metric, [
      'false_negative', 'fn', 'missed_detection', 'type_ii_error',
      'missed_case', 'undetected'
    ])) {
      return {
        eventType: 'false_negative_alert',
        severity: 'high',
        confidence: 0.89,
        metrics: {
          metricValue: this.extractNumber(payload, ['fn_rate', 'false_negative_rate', 'count']),
        }
      };
    }
    
    // False Positive Alert
    if (this.matchesPatterns(eventType, metric, [
      'false_positive', 'fp', 'false_alarm', 'type_i_error',
      'overdetection'
    ])) {
      return {
        eventType: 'false_positive_alert',
        severity: 'medium',
        confidence: 0.88,
        metrics: {
          metricValue: this.extractNumber(payload, ['fp_rate', 'false_positive_rate', 'count']),
        }
      };
    }
    
    // Harmful Output
    if (this.matchesPatterns(eventType, metric, [
      'harmful', 'toxic', 'dangerous', 'inappropriate', 'unsafe',
      'content_safety', 'harmful_content'
    ])) {
      return {
        eventType: 'harmful_output',
        severity: 'critical',
        confidence: 0.92,
        metrics: {
          metricValue: this.extractNumber(payload, ['toxicity_score', 'harm_score', 'severity']),
        }
      };
    }
    
    return null;
  }
  
  // ============================================================
  // FAIRNESS EVENTS (3 types)
  // ============================================================
  
  private normalizeFairnessEvents(
    eventType: string,
    metric: string,
    payload: any,
    source: string
  ): NormalizationResult | null {
    
    // Bias Detected
    if (this.matchesPatterns(eventType, metric, [
      'bias', 'biased', 'demographic', 'fairness', 'discrimination',
      'algorithmic_bias', 'group_fairness'
    ])) {
      return {
        eventType: 'bias_detected',
        severity: 'high',
        confidence: 0.91,
        metrics: {
          demographicVariance: this.extractNumber(payload, [
            'demographic_variance', 'bias_score', 'fairness_metric'
          ]),
          metricValue: this.extractNumber(payload, ['severity', 'impact_score']),
        }
      };
    }
    
    // Disparate Impact
    if (this.matchesPatterns(eventType, metric, [
      'disparate', 'impact', 'adverse_impact', 'protected_class',
      'discrimination_ratio', 'four_fifths'
    ])) {
      return {
        eventType: 'disparate_impact',
        severity: 'critical',
        confidence: 0.94,
        metrics: {
          demographicVariance: this.extractNumber(payload, ['impact_ratio', 'disparity']),
          metricValue: this.extractNumber(payload, ['affected_count', 'severity']),
        }
      };
    }
    
    // Fairness Threshold Violation
    if (this.matchesPatterns(eventType, metric, [
      'threshold', 'violation', 'fairness_violation', 'equity',
      'parity', 'equal_opportunity'
    ])) {
      return {
        eventType: 'fairness_threshold_violation',
        severity: 'high',
        confidence: 0.87,
        metrics: {
          demographicVariance: this.extractNumber(payload, ['variance', 'threshold_delta']),
          metricValue: this.extractNumber(payload, ['current_value', 'threshold_value']),
        }
      };
    }
    
    return null;
  }
  
  // ============================================================
  // QUALITY EVENTS (3 types)
  // ============================================================
  
  private normalizeQualityEvents(
    eventType: string,
    metric: string,
    payload: any,
    source: string
  ): NormalizationResult | null {
    
    // Data Quality Degradation
    if (this.matchesPatterns(eventType, metric, [
      'data_quality', 'quality', 'completeness', 'accuracy_data',
      'missing_values', 'outliers', 'data_integrity'
    ])) {
      return {
        eventType: 'data_quality_degradation',
        severity: 'medium',
        confidence: 0.86,
        metrics: {
          metricValue: this.extractNumber(payload, ['quality_score', 'completeness', 'accuracy']),
        }
      };
    }
    
    // Explainability Failure
    if (this.matchesPatterns(eventType, metric, [
      'explainability', 'interpretability', 'explanation', 'lime', 'shap',
      'feature_importance', 'transparency'
    ])) {
      return {
        eventType: 'explainability_failure',
        severity: 'low',
        confidence: 0.83,
        metrics: {
          metricValue: this.extractNumber(payload, ['explainability_score', 'confidence']),
        }
      };
    }
    
    return null;
  }
  
  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================
  
  private matchesPatterns(eventType: string, metric: string, patterns: string[]): boolean {
    const combined = `${eventType} ${metric}`.toLowerCase();
    return patterns.some(pattern => combined.includes(pattern));
  }
  
  private extractNumber(payload: any, keys: string[]): number | undefined {
    for (const key of keys) {
      if (payload[key] !== undefined && payload[key] !== null) {
        const value = parseFloat(payload[key]);
        if (!isNaN(value)) return value;
      }
    }
    return undefined;
  }
  
  private calculateDriftSeverity(driftScore?: number): Severity {
    if (!driftScore) return 'medium';
    if (driftScore > 0.7) return 'critical';
    if (driftScore > 0.5) return 'high';
    if (driftScore > 0.3) return 'medium';
    return 'low';
  }
  
  private calculatePerformanceSeverity(accuracyDrop?: number): Severity {
    if (!accuracyDrop) return 'medium';
    if (accuracyDrop > 0.2) return 'critical';
    if (accuracyDrop > 0.1) return 'high';
    if (accuracyDrop > 0.05) return 'medium';
    return 'low';
  }
  
  private calculateLatencySeverity(latency?: number): Severity {
    if (!latency) return 'medium';
    if (latency > 5000) return 'critical'; // >5 seconds
    if (latency > 2000) return 'high';     // >2 seconds
    if (latency > 1000) return 'medium';   // >1 second
    return 'low';
  }
  
  private createDefaultResult(event: AITelemetryEvent, payload: any): NormalizationResult {
    // Fallback for unrecognized events
    return {
      eventType: 'model_drift', // Safe default
      severity: (event.severity as Severity) || 'medium',
      confidence: 0.5, // Low confidence
      metrics: {
        metricValue: event.metricValue ? parseFloat(event.metricValue) : undefined,
      }
    };
  }
}

// Export singleton
export const eventNormalizer = new EventNormalizer();
