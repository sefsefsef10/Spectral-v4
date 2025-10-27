/**
 * ROSETTA STONE - Metric Translation & Gap Analysis
 * 
 * Maps vendor observability platform metrics to Spectral compliance controls.
 * Reduces vendor friction by showing what they already have vs. what gaps exist.
 * 
 * Supports: LangSmith, Arize, LangFuse, Weights & Biases
 */

import { logger } from '../logger';

export type Platform = 'langsmith' | 'arize' | 'langfuse' | 'wandb';
export type EventType = 
  | 'phi_exposure' | 'unauthorized_data_access'
  | 'prompt_injection_attempt' | 'authentication_failure' | 'rate_limit_exceeded' 
  | 'input_validation_failure' | 'model_version_mismatch'
  | 'model_drift' | 'performance_degradation' | 'high_latency'
  | 'clinical_accuracy_failure' | 'false_negative_alert' | 'false_positive_alert' | 'harmful_output'
  | 'bias_detected' | 'disparate_impact' | 'fairness_threshold_violation'
  | 'data_quality_degradation' | 'explainability_failure';

export interface PlatformMetric {
  platform: Platform;
  metricName: string;
  description: string;
  mapsToEventTypes: EventType[];
  setupGuide: string;
}

export interface ControlCoverage {
  framework: string;
  controlId: string;
  controlName: string;
  covered: boolean;
  coveringMetrics: string[];
}

export interface GapAnalysis {
  detectedMetrics: PlatformMetric[];
  missingEventTypes: EventType[];
  controlCoverage: ControlCoverage[];
  complianceScore: number;
  recommendations: string[];
}

// Platform-specific metric mappings
const PLATFORM_METRICS: PlatformMetric[] = [
  // LangSmith Metrics
  {
    platform: 'langsmith',
    metricName: 'hallucination_detection',
    description: 'Detects when model generates factually incorrect information',
    mapsToEventTypes: ['clinical_accuracy_failure', 'harmful_output'],
    setupGuide: 'Configure hallucination evaluator in LangSmith with healthcare fact-checking dataset'
  },
  {
    platform: 'langsmith',
    metricName: 'prompt_injection_attempts',
    description: 'Tracks attempts to manipulate model behavior via prompt injection',
    mapsToEventTypes: ['prompt_injection_attempt'],
    setupGuide: 'Enable prompt injection detector in LangSmith security monitoring'
  },
  {
    platform: 'langsmith',
    metricName: 'latency_metrics',
    description: 'Measures request processing time and API response latency',
    mapsToEventTypes: ['high_latency', 'performance_degradation'],
    setupGuide: 'LangSmith automatically tracks latency - set threshold alerts in dashboard'
  },
  
  // Arize Metrics
  {
    platform: 'arize',
    metricName: 'model_drift',
    description: 'Detects statistical drift in model predictions over time',
    mapsToEventTypes: ['model_drift', 'performance_degradation'],
    setupGuide: 'Configure drift monitors in Arize with reference baseline dataset'
  },
  {
    platform: 'arize',
    metricName: 'fairness_bias',
    description: 'Monitors for bias across demographic groups',
    mapsToEventTypes: ['bias_detected', 'disparate_impact', 'fairness_threshold_violation'],
    setupGuide: 'Set up fairness monitors in Arize with protected attributes (race, gender, age)'
  },
  {
    platform: 'arize',
    metricName: 'data_quality',
    description: 'Tracks data quality issues like missing features, outliers, schema violations',
    mapsToEventTypes: ['data_quality_degradation'],
    setupGuide: 'Configure data quality monitors in Arize for all input features'
  },
  
  // LangFuse Metrics
  {
    platform: 'langfuse',
    metricName: 'pii_detection',
    description: 'Detects personally identifiable information in prompts/completions',
    mapsToEventTypes: ['phi_exposure', 'unauthorized_data_access'],
    setupGuide: 'Enable PII/PHI detection in LangFuse with healthcare-specific patterns'
  },
  {
    platform: 'langfuse',
    metricName: 'cost_tracking',
    description: 'Monitors token usage and API costs',
    mapsToEventTypes: ['rate_limit_exceeded'],
    setupGuide: 'LangFuse tracks costs automatically - set budget alerts in dashboard'
  },
  {
    platform: 'langfuse',
    metricName: 'trace_debugging',
    description: 'Full request tracing for debugging and explainability',
    mapsToEventTypes: ['explainability_failure'],
    setupGuide: 'Tracing enabled by default - ensure all LLM calls are instrumented'
  },
  
  // Weights & Biases Metrics
  {
    platform: 'wandb',
    metricName: 'model_performance',
    description: 'Tracks accuracy, precision, recall, F1 score across deployments',
    mapsToEventTypes: ['clinical_accuracy_failure', 'false_negative_alert', 'false_positive_alert'],
    setupGuide: 'Log validation metrics to W&B during model training and inference'
  },
  {
    platform: 'wandb',
    metricName: 'model_versioning',
    description: 'Tracks model versions and deployment history',
    mapsToEventTypes: ['model_version_mismatch'],
    setupGuide: 'Use W&B Model Registry to version all production models'
  },
  {
    platform: 'wandb',
    metricName: 'input_validation',
    description: 'Validates input data against expected schema and constraints',
    mapsToEventTypes: ['input_validation_failure'],
    setupGuide: 'Log input validation errors to W&B with wandb.log({"validation_error": ...})'
  },
];

// Event type to compliance control mappings (simplified - full mapping in Translation Engine)
const EVENT_TO_CONTROLS: Record<EventType, { framework: string; controlId: string; controlName: string }[]> = {
  'phi_exposure': [
    { framework: 'HIPAA', controlId: '164.308(a)(1)', controlName: 'Security Management Process' },
    { framework: 'HIPAA', controlId: '164.312(a)(1)', controlName: 'Access Control' },
    { framework: 'HIPAA', controlId: '164.312(d)', controlName: 'Transmission Security' },
  ],
  'unauthorized_data_access': [
    { framework: 'HIPAA', controlId: '164.312(a)(1)', controlName: 'Access Control' },
    { framework: 'HIPAA', controlId: '164.308(a)(4)', controlName: 'Information Access Management' },
  ],
  'prompt_injection_attempt': [
    { framework: 'NIST_AI_RMF', controlId: 'GOVERN-1.2', controlName: 'Security Controls' },
    { framework: 'HIPAA', controlId: '164.308(a)(1)', controlName: 'Security Management Process' },
  ],
  'authentication_failure': [
    { framework: 'HIPAA', controlId: '164.312(c)(1)', controlName: 'Person or Entity Authentication' },
  ],
  'rate_limit_exceeded': [
    { framework: 'NIST_AI_RMF', controlId: 'MANAGE-2.1', controlName: 'Resource Management' },
  ],
  'input_validation_failure': [
    { framework: 'NIST_AI_RMF', controlId: 'MAP-5.1', controlName: 'Data Quality' },
    { framework: 'HIPAA', controlId: '164.312(b)', controlName: 'Integrity Controls' },
  ],
  'model_version_mismatch': [
    { framework: 'FDA_SaMD', controlId: 'VERSION-1', controlName: 'Version Control' },
  ],
  'model_drift': [
    { framework: 'NIST_AI_RMF', controlId: 'MEASURE-2.3', controlName: 'Performance Monitoring' },
    { framework: 'FDA_SaMD', controlId: 'PERFORMANCE-1', controlName: 'Performance Degradation Detection' },
  ],
  'performance_degradation': [
    { framework: 'NIST_AI_RMF', controlId: 'MEASURE-2.3', controlName: 'Performance Monitoring' },
    { framework: 'FDA_SaMD', controlId: 'PERFORMANCE-1', controlName: 'Performance Degradation Detection' },
  ],
  'high_latency': [
    { framework: 'NIST_AI_RMF', controlId: 'MANAGE-2.2', controlName: 'System Performance' },
  ],
  'clinical_accuracy_failure': [
    { framework: 'FDA_SaMD', controlId: 'CLINICAL-1', controlName: 'Clinical Accuracy' },
    { framework: 'NIST_AI_RMF', controlId: 'MEASURE-2.2', controlName: 'Accuracy Metrics' },
  ],
  'false_negative_alert': [
    { framework: 'FDA_SaMD', controlId: 'CLINICAL-2', controlName: 'False Negative Rate' },
  ],
  'false_positive_alert': [
    { framework: 'FDA_SaMD', controlId: 'CLINICAL-3', controlName: 'False Positive Rate' },
  ],
  'harmful_output': [
    { framework: 'NIST_AI_RMF', controlId: 'GOVERN-1.1', controlName: 'Safety Controls' },
    { framework: 'FDA_SaMD', controlId: 'SAFETY-1', controlName: 'Harm Prevention' },
  ],
  'bias_detected': [
    { framework: 'NIST_AI_RMF', controlId: 'MEASURE-2.10', controlName: 'Bias Monitoring' },
    { framework: 'ISO_42001', controlId: 'FAIRNESS-1', controlName: 'Fairness Assessment' },
  ],
  'disparate_impact': [
    { framework: 'NIST_AI_RMF', controlId: 'MEASURE-2.10', controlName: 'Bias Monitoring' },
    { framework: 'NYC_LL144', controlId: 'BIAS-1', controlName: 'Bias Audit' },
  ],
  'fairness_threshold_violation': [
    { framework: 'NIST_AI_RMF', controlId: 'MEASURE-2.10', controlName: 'Bias Monitoring' },
  ],
  'data_quality_degradation': [
    { framework: 'NIST_AI_RMF', controlId: 'MAP-5.1', controlName: 'Data Quality' },
    { framework: 'HIPAA', controlId: '164.312(b)', controlName: 'Integrity Controls' },
  ],
  'explainability_failure': [
    { framework: 'NIST_AI_RMF', controlId: 'MEASURE-3.2', controlName: 'Explainability' },
  ],
};

export class RosettaStoneMapper {
  /**
   * Analyze vendor's existing metrics and identify gaps
   */
  analyzeMetrics(detectedPlatforms: Platform[]): GapAnalysis {
    const detectedMetrics = PLATFORM_METRICS.filter(m => 
      detectedPlatforms.includes(m.platform)
    );

    // All possible event types
    const allEventTypes: EventType[] = Object.keys(EVENT_TO_CONTROLS) as EventType[];
    
    // Event types covered by detected metrics
    const coveredEventTypes = new Set<EventType>();
    detectedMetrics.forEach(metric => {
      metric.mapsToEventTypes.forEach(et => coveredEventTypes.add(et));
    });

    // Missing event types
    const missingEventTypes = allEventTypes.filter(et => !coveredEventTypes.has(et));

    // Calculate control coverage
    const controlCoverage = this.calculateControlCoverage(Array.from(coveredEventTypes));

    // Calculate compliance score (% of controls covered)
    const totalControls = controlCoverage.length;
    const coveredControls = controlCoverage.filter(c => c.covered).length;
    const complianceScore = totalControls > 0 
      ? Math.round((coveredControls / totalControls) * 100) 
      : 0;

    // Generate recommendations
    const recommendations = this.generateRecommendations(missingEventTypes, detectedPlatforms);

    return {
      detectedMetrics,
      missingEventTypes,
      controlCoverage,
      complianceScore,
      recommendations,
    };
  }

  /**
   * Calculate which compliance controls are covered by current metrics
   */
  private calculateControlCoverage(coveredEventTypes: EventType[]): ControlCoverage[] {
    const controlMap = new Map<string, ControlCoverage>();

    // Get all controls from all event types
    Object.entries(EVENT_TO_CONTROLS).forEach(([eventType, controls]) => {
      controls.forEach(control => {
        const key = `${control.framework}:${control.controlId}`;
        
        if (!controlMap.has(key)) {
          controlMap.set(key, {
            framework: control.framework,
            controlId: control.controlId,
            controlName: control.controlName,
            covered: false,
            coveringMetrics: [],
          });
        }

        // If this event type is covered, mark control as covered
        if (coveredEventTypes.includes(eventType as EventType)) {
          const coverage = controlMap.get(key)!;
          coverage.covered = true;
          coverage.coveringMetrics.push(eventType);
        }
      });
    });

    return Array.from(controlMap.values());
  }

  /**
   * Generate actionable recommendations for filling gaps
   */
  private generateRecommendations(missingEventTypes: EventType[], platforms: Platform[]): string[] {
    const recommendations: string[] = [];

    // Find metrics that would cover missing event types
    const missingMetrics = PLATFORM_METRICS.filter(metric => 
      metric.mapsToEventTypes.some(et => missingEventTypes.includes(et))
    );

    // Group by platform
    const platformGroups = new Map<Platform, PlatformMetric[]>();
    missingMetrics.forEach(metric => {
      if (!platformGroups.has(metric.platform)) {
        platformGroups.set(metric.platform, []);
      }
      platformGroups.get(metric.platform)!.push(metric);
    });

    // Generate recommendations per platform
    platformGroups.forEach((metrics, platform) => {
      if (platforms.includes(platform)) {
        metrics.forEach(metric => {
          recommendations.push(
            `${platform.toUpperCase()}: Configure "${metric.metricName}" - ${metric.setupGuide}`
          );
        });
      } else {
        recommendations.push(
          `Consider adding ${platform.toUpperCase()} integration to monitor: ${metrics.map(m => m.metricName).join(', ')}`
        );
      }
    });

    // Add high-priority gaps
    if (missingEventTypes.includes('phi_exposure')) {
      recommendations.unshift('HIGH PRIORITY: Enable PHI/PII detection to achieve HIPAA compliance');
    }
    if (missingEventTypes.includes('bias_detected')) {
      recommendations.push('RECOMMENDED: Set up fairness monitoring for NIST AI RMF compliance');
    }

    return recommendations;
  }

  /**
   * Get all available metrics for a platform
   */
  getMetricsForPlatform(platform: Platform): PlatformMetric[] {
    return PLATFORM_METRICS.filter(m => m.platform === platform);
  }

  /**
   * Get setup guide for a specific metric
   */
  getSetupGuide(platform: Platform, metricName: string): string | null {
    const metric = PLATFORM_METRICS.find(
      m => m.platform === platform && m.metricName === metricName
    );
    return metric?.setupGuide || null;
  }
}

export const rosettaStoneMapper = new RosettaStoneMapper();
