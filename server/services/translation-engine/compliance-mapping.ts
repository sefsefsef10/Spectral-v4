/**
 * 🔒 TRANSLATION ENGINE - Compliance Mapping Service
 * 
 * CORE IP - THE DEFENSIBLE MOAT
 * 
 * Maps AI monitoring telemetry to specific compliance control violations
 * across HIPAA, NIST AI RMF, FDA SaMD, and state regulations.
 * 
 * This is where 3+ years of healthcare + AI compliance expertise is encoded.
 */

import { logger } from "../../logger";
import { storage } from "../../storage";
import { getThresholds } from "./threshold-config";
import { policyLoader } from "./policy-loader";
import type {
  ParsedEvent,
  ComplianceViolation,
  Framework,
  Severity,
  ComplianceRule,
} from "./types";
import type { AISystem } from "@shared/schema";

export class ComplianceMapping {
  private rules: Map<string, ComplianceRule[]> = new Map();
  
  constructor() {
    this.loadMappingRules();
  }
  
  /**
   * 🔒 IP MOAT - Load policy from encrypted database
   * 
   * Checks database-backed policies first, falls back to static rules if not found.
   * This hybrid approach activates the IP moat while maintaining reliability.
   */
  private async loadPolicyForEvent(eventType: string, framework: string): Promise<ComplianceViolation[] | null> {
    try {
      const policy = await policyLoader.getPolicy(eventType, framework);
      
      if (!policy) {
        return null; // No database policy found, fallback to static rules
      }
      
      // Found encrypted policy - convert to violations format
      return policy.frameworks.map(fw => ({
        framework: fw.framework as Framework,
        controlId: fw.controlId,
        controlName: fw.controlName,
        violationType: fw.violationType as any,
        severity: fw.severity as Severity,
        requiresReporting: fw.requiresReporting,
        reportingDeadline: fw.reportingDeadlineDays 
          ? this.calculateDeadline(fw.reportingDeadlineDays)
          : undefined,
        description: `${fw.controlName} - Event type: ${eventType}`,
        affectedSystem: {} as any, // Will be filled by caller
        detectedAt: new Date(),
      }));
    } catch (error) {
      logger.error({ error, eventType, framework }, 'Failed to load policy from database - using static fallback');
      return null; // Fallback to static rules on error
    }
  }
  
  /**
   * Main mapping function: Translate event → compliance violations
   */
  async mapToViolations(event: ParsedEvent): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];
    
    // Get AI system details for context
    const aiSystem = event.aiSystem || await storage.getAISystem(event.aiSystemId);
    if (!aiSystem) {
      throw new Error(`AI system ${event.aiSystemId} not found`);
    }
    
    // Map events to framework-specific violations (20 event types)
    switch (event.eventType) {
      // PRIVACY EVENTS (2)
      case 'phi_exposure':
      case 'phi_leakage': // Legacy
        violations.push(...await this.handlePHILeakage(event, aiSystem));
        break;
      
      case 'unauthorized_data_access':
        violations.push(...await this.handleUnauthorizedAccess(event, aiSystem));
        break;
      
      // SECURITY EVENTS (5)
      case 'prompt_injection_attempt':
        violations.push(...await this.handlePromptInjection(event, aiSystem));
        break;
      
      case 'authentication_failure':
        violations.push(...await this.handleAuthFailure(event, aiSystem));
        break;
      
      case 'rate_limit_exceeded':
        violations.push(...await this.handleRateLimitExceeded(event, aiSystem));
        break;
      
      case 'input_validation_failure':
        violations.push(...await this.handleInputValidationFailure(event, aiSystem));
        break;
      
      case 'model_version_mismatch':
        violations.push(...await this.handleVersionMismatch(event, aiSystem));
        break;
      
      // PERFORMANCE EVENTS (3)
      case 'model_drift':
      case 'drift': // Legacy
      case 'performance_degradation':
        violations.push(...await this.handleDrift(event, aiSystem));
        break;
      
      case 'high_latency':
      case 'latency': // Legacy
        violations.push(...await this.handleLatency(event, aiSystem));
        break;
      
      // SAFETY EVENTS (4)
      case 'clinical_accuracy_failure':
        violations.push(...await this.handleClinicalAccuracy(event, aiSystem));
        break;
      
      case 'false_negative_alert':
      case 'false_positive_alert':
        violations.push(...await this.handleFalseAlerts(event, aiSystem));
        break;
      
      case 'harmful_output':
        violations.push(...await this.handleHarmfulOutput(event, aiSystem));
        break;
      
      // FAIRNESS EVENTS (3)
      case 'bias_detected':
      case 'bias': // Legacy
      case 'disparate_impact':
      case 'fairness_threshold_violation':
        violations.push(...await this.handleBias(event, aiSystem));
        break;
      
      // QUALITY EVENTS (3)
      case 'data_quality_degradation':
        violations.push(...await this.handleDataQuality(event, aiSystem));
        break;
      
      case 'explainability_failure':
        violations.push(...await this.handleExplainabilityFailure(event, aiSystem));
        break;
      
      // LEGACY
      case 'error':
        violations.push(...await this.handleError(event, aiSystem));
        break;
    }
    
    return violations;
  }
  
  /**
   * DRIFT / PERFORMANCE DEGRADATION
   * 
   * Model drift affects multiple frameworks:
   * - NIST AI RMF: MANAGE-4.1 (performance monitoring)
   * - HIPAA: 164.312(b) (audit controls)
   * - FDA: PCCP-ML (predetermined change control)
   * 
   * 🔒 IP MOAT: Uses encrypted database policies when available
   */
  private async handleDrift(event: ParsedEvent, aiSystem: AISystem): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];
    const accuracyDrop = event.metrics.accuracyDrop || 0;
    
    // Get configurable thresholds for this health system
    const thresholds = await getThresholds(aiSystem.healthSystemId);
    
    // 🔒 STEP 1: Try loading from encrypted database policy (IP MOAT)
    const dbPolicy = await this.loadPolicyForEvent('model_drift', 'NIST_AI_RMF');
    
    if (dbPolicy && dbPolicy.length > 0 && accuracyDrop > thresholds.drift.accuracyDropMedium) {
      // Found encrypted policy - use it and enrich with event details
      for (const violation of dbPolicy) {
        violations.push({
          ...violation,
          severity: accuracyDrop > thresholds.drift.accuracyDropHigh ? 'high' : 'medium',
          description: `AI system accuracy dropped by ${(accuracyDrop * 100).toFixed(1)}%, exceeding acceptable performance threshold. Requires investigation and potential model retraining.`,
          affectedSystem: {
            id: aiSystem.id,
            name: aiSystem.name,
            department: aiSystem.department,
          },
          detectedAt: event.metadata.timestamp,
        });
      }
      logger.debug({ eventType: 'model_drift' }, '🔒 Using encrypted database policy (IP MOAT activated)');
    } else if (accuracyDrop > thresholds.drift.accuracyDropMedium) {
      // STEP 2: Fallback to static rules if no database policy
      logger.debug({ eventType: 'model_drift' }, 'Using static fallback rules');
      
      // NIST AI RMF - Performance Monitoring
      violations.push({
        framework: 'NIST_AI_RMF',
        controlId: 'MANAGE-4.1',
        controlName: 'AI system performance is monitored',
        violationType: accuracyDrop > thresholds.drift.accuracyDropHigh ? 'deviation' : 'threshold_exceeded',
        severity: accuracyDrop > thresholds.drift.accuracyDropHigh ? 'high' : 'medium',
        requiresReporting: false,
        description: `AI system accuracy dropped by ${(accuracyDrop * 100).toFixed(1)}%, exceeding acceptable performance threshold. Requires investigation and potential model retraining.`,
        affectedSystem: {
          id: aiSystem.id,
          name: aiSystem.name,
          department: aiSystem.department,
        },
        detectedAt: event.metadata.timestamp,
      });
    }
    
    // HIPAA - Audit Controls (Service Availability)
    if (event.severity === 'high' || event.severity === 'critical') {
      violations.push({
        framework: 'HIPAA',
        controlId: '164.312(b)',
        controlName: 'Audit Controls - System Activity Review',
        violationType: 'threshold_exceeded',
        severity: event.severity,
        requiresReporting: false,
        description: `AI system ${aiSystem.name} performance degradation detected. Audit controls require review of system activity and performance metrics.`,
        affectedSystem: {
          id: aiSystem.id,
          name: aiSystem.name,
          department: aiSystem.department,
        },
        detectedAt: event.metadata.timestamp,
      });
    }
    
    // FDA SaMD - Predetermined Change Control Plan
    // Only applies if system is FDA-regulated medical device
    const isFDARegulated = aiSystem.department === 'Imaging' || 
                          aiSystem.department === 'Pathology' || 
                          aiSystem.name.toLowerCase().includes('diagnostic');
    
    if (isFDARegulated && accuracyDrop > thresholds.drift.accuracyDropFDA) {
      violations.push({
        framework: 'FDA_SaMD',
        controlId: 'FDA-PCCP-2',
        controlName: 'Post-Market Surveillance - Model Performance',
        violationType: 'deviation',
        severity: 'high',
        requiresReporting: true,
        reportingDeadline: this.calculateDeadline(30), // FDA requires 30-day notification
        description: `FDA-regulated AI medical device showing significant performance degradation (${(accuracyDrop * 100).toFixed(1)}% accuracy drop). Requires FDA notification and corrective action plan.`,
        affectedSystem: {
          id: aiSystem.id,
          name: aiSystem.name,
          department: aiSystem.department,
        },
        detectedAt: event.metadata.timestamp,
      });
    }
    
    return violations;
  }
  
  /**
   * PHI LEAKAGE
   * 
   * CRITICAL - Always triggers HIPAA breach notification
   * - HIPAA: 164.402 (breach notification)
   * - HIPAA: 164.308(a)(1)(ii)(D) (security management)
   * - State laws: California, etc.
   * 
   * 🔒 IP MOAT: Uses encrypted database policies when available
   */
  private async handlePHILeakage(event: ParsedEvent, aiSystem: AISystem): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];
    
    // 🔒 STEP 1: Try loading from encrypted database policy (IP MOAT)
    const dbPolicy = await this.loadPolicyForEvent('phi_exposure', 'HIPAA');
    
    if (dbPolicy && dbPolicy.length > 0) {
      // Found encrypted policy - use it and enrich with event details
      for (const violation of dbPolicy) {
        violations.push({
          ...violation,
          description: `CRITICAL: Potential PHI breach detected in AI system ${aiSystem.name}. ${event.metrics.phiExposureCount || 'Unknown number of'} patient records may have been exposed. Immediate investigation and breach notification process required.`,
          affectedSystem: {
            id: aiSystem.id,
            name: aiSystem.name,
            department: aiSystem.department,
          },
          detectedAt: event.metadata.timestamp,
        });
      }
      logger.debug({ eventType: 'phi_exposure' }, '🔒 Using encrypted database policy (IP MOAT activated)');
    } else {
      // STEP 2: Fallback to static rules if no database policy
      logger.debug({ eventType: 'phi_exposure' }, 'Using static fallback rules');
      
      // HIPAA Breach Notification Rule
      violations.push({
        framework: 'HIPAA',
        controlId: '164.402',
        controlName: 'Breach Notification - Unauthorized Disclosure',
        violationType: 'breach',
        severity: 'critical',
        requiresReporting: true,
        reportingDeadline: this.calculateDeadline(60), // 60 days to notify HHS
        description: `CRITICAL: Potential PHI breach detected in AI system ${aiSystem.name}. ${event.metrics.phiExposureCount || 'Unknown number of'} patient records may have been exposed. Immediate investigation and breach notification process required.`,
        affectedSystem: {
          id: aiSystem.id,
          name: aiSystem.name,
          department: aiSystem.department,
        },
        detectedAt: event.metadata.timestamp,
      });
      
      // HIPAA Security Rule - Information System Activity Review
      violations.push({
        framework: 'HIPAA',
        controlId: '164.308(a)(1)(ii)(D)',
        controlName: 'Security Management - Information System Activity Review',
        violationType: 'breach',
        severity: 'critical',
        requiresReporting: true,
        description: `Security management process requires immediate review of AI system activity logs to determine scope of PHI exposure and implement corrective measures.`,
        affectedSystem: {
          id: aiSystem.id,
          name: aiSystem.name,
          department: aiSystem.department,
        },
        detectedAt: event.metadata.timestamp,
      });
    }
    
    // State-specific laws (California example)
    // Check actual health system state for state-specific compliance requirements
    const healthSystem = await storage.getHealthSystem(aiSystem.healthSystemId);
    const isCaliforniaSubject = healthSystem?.state === 'CA';
    
    if (isCaliforniaSubject) {
      violations.push({
        framework: 'CA_SB1047',
        controlId: 'CA-BREACH',
        controlName: 'California Breach Notification',
        violationType: 'breach',
        severity: 'critical',
        requiresReporting: true,
        reportingDeadline: this.calculateDeadline(30), // California requires faster notification
        description: `California law requires notification of affected individuals and Attorney General within 30 days of PHI breach discovery.`,
        affectedSystem: {
          id: aiSystem.id,
          name: aiSystem.name,
          department: aiSystem.department,
        },
        detectedAt: event.metadata.timestamp,
      });
    }
    
    return violations;
  }
  
  /**
   * BIAS / FAIRNESS VIOLATIONS
   * 
   * - NIST AI RMF: MEASURE-2.1 (fairness monitoring)
   * - NYC Local Law 144 (employment AI)
   */
  private async handleBias(event: ParsedEvent, aiSystem: AISystem): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];
    const variance = event.metrics.demographicVariance || 0;
    
    // Get configurable thresholds for this health system
    const thresholds = await getThresholds(aiSystem.healthSystemId);
    
    // NIST AI RMF - Fairness Monitoring
    if (variance > thresholds.bias.varianceMedium) {
      violations.push({
        framework: 'NIST_AI_RMF',
        controlId: 'MEASURE-2.1',
        controlName: 'AI system performance is monitored for fairness',
        violationType: 'threshold_exceeded',
        severity: variance > thresholds.bias.varianceHigh ? 'high' : 'medium',
        requiresReporting: false,
        description: `AI system showing ${(variance * 100).toFixed(1)}% demographic variance in predictions, indicating potential bias. Fairness review and model retraining recommended.`,
        affectedSystem: {
          id: aiSystem.id,
          name: aiSystem.name,
          department: aiSystem.department,
        },
        detectedAt: event.metadata.timestamp,
      });
    }
    
    // NYC Local Law 144 (if applicable to employment/HR AI)
    const isEmploymentAI = aiSystem.department.toLowerCase().includes('hr') || 
                          aiSystem.department.toLowerCase().includes('employment') ||
                          aiSystem.name.toLowerCase().includes('hiring');
    
    if (isEmploymentAI && variance > thresholds.bias.varianceNYC) {
      violations.push({
        framework: 'NYC_LL144',
        controlId: 'NYC-BIAS',
        controlName: 'Bias Audit Required',
        violationType: 'threshold_exceeded',
        severity: 'high',
        requiresReporting: true,
        description: `Employment AI system requires annual bias audit under NYC Local Law 144. Current demographic variance (${(variance * 100).toFixed(1)}%) exceeds acceptable threshold.`,
        affectedSystem: {
          id: aiSystem.id,
          name: aiSystem.name,
          department: aiSystem.department,
        },
        detectedAt: event.metadata.timestamp,
      });
    }
    
    return violations;
  }
  
  /**
   * LATENCY / SERVICE AVAILABILITY
   * 
   * - HIPAA: 164.312(b) (service availability)
   */
  private async handleLatency(event: ParsedEvent, aiSystem: AISystem): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];
    const latencyIncrease = event.metrics.latencyIncreasePct || 0;
    
    // Get configurable thresholds for this health system
    const thresholds = await getThresholds(aiSystem.healthSystemId);
    
    // HIPAA - Service Availability
    if (latencyIncrease > thresholds.latency.increaseMedium) {
      violations.push({
        framework: 'HIPAA',
        controlId: '164.312(b)',
        controlName: 'Audit Controls - Service Availability',
        violationType: 'deviation',
        severity: latencyIncrease > thresholds.latency.increaseHigh ? 'high' : 'medium',
        requiresReporting: false,
        description: `AI system latency increased by ${(latencyIncrease * 100).toFixed(1)}%, potentially affecting clinical workflow and patient care delivery. Performance optimization required.`,
        affectedSystem: {
          id: aiSystem.id,
          name: aiSystem.name,
          department: aiSystem.department,
        },
        detectedAt: event.metadata.timestamp,
      });
    }
    
    return violations;
  }
  
  /**
   * ERROR RATE VIOLATIONS
   * 
   * - NIST AI RMF: MANAGE-1.1 (risk management)
   * - FDA: Performance monitoring (if medical device)
   */
  private async handleError(event: ParsedEvent, aiSystem: AISystem): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];
    const errorRate = event.metrics.errorRate || 0;
    
    // Get configurable thresholds for this health system
    const thresholds = await getThresholds(aiSystem.healthSystemId);
    
    // NIST AI RMF - Continuous Risk Management
    if (errorRate > thresholds.error.rateMedium) {
      violations.push({
        framework: 'NIST_AI_RMF',
        controlId: 'MANAGE-1.1',
        controlName: 'AI risks are managed continuously',
        violationType: 'threshold_exceeded',
        severity: errorRate > thresholds.error.rateHigh ? 'high' : 'medium',
        requiresReporting: false,
        description: `AI system error rate (${(errorRate * 100).toFixed(2)}%) exceeds acceptable threshold. Risk review and error mitigation required.`,
        affectedSystem: {
          id: aiSystem.id,
          name: aiSystem.name,
          department: aiSystem.department,
        },
        detectedAt: event.metadata.timestamp,
      });
    }
    
    // FDA monitoring (if medical device)
    const isFDARegulated = aiSystem.department === 'Imaging' || 
                          aiSystem.department === 'Pathology' ||
                          aiSystem.name.toLowerCase().includes('diagnostic');
    
    if (isFDARegulated && errorRate > thresholds.error.rateFDA) {
      violations.push({
        framework: 'FDA_SaMD',
        controlId: 'FDA-PCCP-2',
        controlName: 'Post-Market Surveillance',
        violationType: 'deviation',
        severity: 'high',
        requiresReporting: errorRate > thresholds.error.rateHigh,
        reportingDeadline: errorRate > thresholds.error.rateHigh ? this.calculateDeadline(30) : undefined,
        description: `FDA-regulated AI medical device showing elevated error rate (${(errorRate * 100).toFixed(2)}%). Post-market surveillance and corrective action required.`,
        affectedSystem: {
          id: aiSystem.id,
          name: aiSystem.name,
          department: aiSystem.department,
        },
        detectedAt: event.metadata.timestamp,
      });
    }
    
    return violations;
  }
  
  /**
   * UNAUTHORIZED DATA ACCESS
   * - HIPAA: 164.308(a)(4) Access Control
   * - ISO 27001: Access Control violations
   */
  private async handleUnauthorizedAccess(event: ParsedEvent, aiSystem: AISystem): Promise<ComplianceViolation[]> {
    return [{
      framework: 'HIPAA',
      controlId: '164.308(a)(4)',
      controlName: 'Access Control - Unauthorized Access Prevention',
      violationType: 'breach',
      severity: 'critical',
      requiresReporting: true,
      reportingDeadline: this.calculateDeadline(60),
      description: `Unauthorized access attempt detected on ${aiSystem.name}. HIPAA requires immediate investigation and potential breach notification.`,
      affectedSystem: {
        id: aiSystem.id,
        name: aiSystem.name,
        department: aiSystem.department,
      },
      detectedAt: event.metadata.timestamp,
    }];
  }

  /**
   * PROMPT INJECTION ATTEMPT
   * - NIST AI RMF: GOVERN-5.1 (AI system security)
   * - ISO 27001: Information Security Incident Management
   */
  private async handlePromptInjection(event: ParsedEvent, aiSystem: AISystem): Promise<ComplianceViolation[]> {
    return [{
      framework: 'NIST_AI_RMF',
      controlId: 'GOVERN-5.1',
      controlName: 'AI system security and resilience practices',
      violationType: 'breach',
      severity: 'high',
      requiresReporting: false,
      description: `Prompt injection attack detected on ${aiSystem.name}. Security incident response required.`,
      affectedSystem: {
        id: aiSystem.id,
        name: aiSystem.name,
        department: aiSystem.department,
      },
      detectedAt: event.metadata.timestamp,
    }];
  }

  /**
   * AUTHENTICATION FAILURE
   * - HIPAA: 164.312(d) Person/Entity Authentication
   */
  private async handleAuthFailure(event: ParsedEvent, aiSystem: AISystem): Promise<ComplianceViolation[]> {
    return [{
      framework: 'HIPAA',
      controlId: '164.312(d)',
      controlName: 'Person or Entity Authentication',
      violationType: 'deviation',
      severity: 'medium',
      requiresReporting: false,
      description: `Authentication failure on ${aiSystem.name}. Review access controls and authentication mechanisms.`,
      affectedSystem: {
        id: aiSystem.id,
        name: aiSystem.name,
        department: aiSystem.department,
      },
      detectedAt: event.metadata.timestamp,
    }];
  }

  /**
   * RATE LIMIT EXCEEDED
   * - HIPAA: 164.312(b) Service Availability
   */
  private async handleRateLimitExceeded(event: ParsedEvent, aiSystem: AISystem): Promise<ComplianceViolation[]> {
    return [{
      framework: 'HIPAA',
      controlId: '164.312(b)',
      controlName: 'Audit Controls - Service Availability',
      violationType: 'threshold_exceeded',
      severity: 'medium',
      requiresReporting: false,
      description: `Rate limit exceeded on ${aiSystem.name}. Potential denial of service or capacity planning issue.`,
      affectedSystem: {
        id: aiSystem.id,
        name: aiSystem.name,
        department: aiSystem.department,
      },
      detectedAt: event.metadata.timestamp,
    }];
  }

  /**
   * INPUT VALIDATION FAILURE
   * - NIST AI RMF: MANAGE-4.2 (Data quality monitoring)
   */
  private async handleInputValidationFailure(event: ParsedEvent, aiSystem: AISystem): Promise<ComplianceViolation[]> {
    return [{
      framework: 'NIST_AI_RMF',
      controlId: 'MANAGE-4.2',
      controlName: 'Mechanisms for tracking AI system inputs',
      violationType: 'deviation',
      severity: 'low',
      requiresReporting: false,
      description: `Input validation failure detected on ${aiSystem.name}. Review input quality controls.`,
      affectedSystem: {
        id: aiSystem.id,
        name: aiSystem.name,
        department: aiSystem.department,
      },
      detectedAt: event.metadata.timestamp,
    }];
  }

  /**
   * MODEL VERSION MISMATCH
   * - FDA: Predetermined Change Control Plan (PCCP)
   */
  private async handleVersionMismatch(event: ParsedEvent, aiSystem: AISystem): Promise<ComplianceViolation[]> {
    return [{
      framework: 'FDA_SaMD',
      controlId: 'FDA-PCCP-1',
      controlName: 'Predetermined Change Control Plan',
      violationType: 'deviation',
      severity: 'medium',
      requiresReporting: false,
      description: `Model version mismatch detected on ${aiSystem.name}. Verify change control procedures.`,
      affectedSystem: {
        id: aiSystem.id,
        name: aiSystem.name,
        department: aiSystem.department,
      },
      detectedAt: event.metadata.timestamp,
    }];
  }

  /**
   * CLINICAL ACCURACY FAILURE
   * - FDA: Clinical Validation Requirements
   * - NIST AI RMF: MANAGE-4.1 (Performance monitoring)
   */
  private async handleClinicalAccuracy(event: ParsedEvent, aiSystem: AISystem): Promise<ComplianceViolation[]> {
    return [{
      framework: 'FDA_SaMD',
      controlId: 'FDA-CV-1',
      controlName: 'Clinical Validation',
      violationType: 'breach',
      severity: 'critical',
      requiresReporting: true,
      reportingDeadline: this.calculateDeadline(30),
      description: `Clinical accuracy failure detected on ${aiSystem.name}. FDA requires immediate investigation and potential device recall.`,
      affectedSystem: {
        id: aiSystem.id,
        name: aiSystem.name,
        department: aiSystem.department,
      },
      detectedAt: event.metadata.timestamp,
    }];
  }

  /**
   * FALSE ALERTS (Positive/Negative)
   * - FDA: Analytical/Clinical Validation
   */
  private async handleFalseAlerts(event: ParsedEvent, aiSystem: AISystem): Promise<ComplianceViolation[]> {
    const isFalseNegative = event.eventType === 'false_negative_alert';
    
    return [{
      framework: 'FDA_SaMD',
      controlId: 'FDA-AV-1',
      controlName: 'Analytical Validation',
      violationType: 'deviation',
      severity: isFalseNegative ? 'high' : 'medium',
      requiresReporting: isFalseNegative,
      reportingDeadline: isFalseNegative ? this.calculateDeadline(30) : undefined,
      description: `${isFalseNegative ? 'False negative' : 'False positive'} alert rate exceeds threshold on ${aiSystem.name}. Analytical validation required.`,
      affectedSystem: {
        id: aiSystem.id,
        name: aiSystem.name,
        department: aiSystem.department,
      },
      detectedAt: event.metadata.timestamp,
    }];
  }

  /**
   * HARMFUL OUTPUT
   * - NIST AI RMF: MEASURE-2.7 (Safety testing)
   * - CA SB 1047: Safety requirements
   */
  private async handleHarmfulOutput(event: ParsedEvent, aiSystem: AISystem): Promise<ComplianceViolation[]> {
    return [{
      framework: 'CA_SB1047',
      controlId: 'CA-SB1047-2',
      controlName: 'Covered Model Safety Testing',
      violationType: 'breach',
      severity: 'critical',
      requiresReporting: true,
      reportingDeadline: this.calculateDeadline(10),
      description: `Harmful or unsafe output detected on ${aiSystem.name}. CA SB 1047 requires immediate safety incident reporting.`,
      affectedSystem: {
        id: aiSystem.id,
        name: aiSystem.name,
        department: aiSystem.department,
      },
      detectedAt: event.metadata.timestamp,
    }];
  }

  /**
   * DATA QUALITY DEGRADATION
   * - NIST AI RMF: MANAGE-4.2 (Data quality)
   */
  private async handleDataQuality(event: ParsedEvent, aiSystem: AISystem): Promise<ComplianceViolation[]> {
    return [{
      framework: 'NIST_AI_RMF',
      controlId: 'MANAGE-4.2',
      controlName: 'Mechanisms for tracking AI system inputs',
      violationType: 'threshold_exceeded',
      severity: 'medium',
      requiresReporting: false,
      description: `Data quality degradation detected on ${aiSystem.name}. Input data monitoring required.`,
      affectedSystem: {
        id: aiSystem.id,
        name: aiSystem.name,
        department: aiSystem.department,
      },
      detectedAt: event.metadata.timestamp,
    }];
  }

  /**
   * EXPLAINABILITY FAILURE
   * - NIST AI RMF: MEASURE-2.3 (Transparency)
   * - NYC Local Law 144: Explainability requirements
   */
  private async handleExplainabilityFailure(event: ParsedEvent, aiSystem: AISystem): Promise<ComplianceViolation[]> {
    const isEmploymentAI = aiSystem.department === 'HR' || aiSystem.name.toLowerCase().includes('hiring');
    
    return [{
      framework: isEmploymentAI ? 'NYC_LL144' : 'NIST_AI_RMF',
      controlId: isEmploymentAI ? 'NYC-LL144-1' : 'MEASURE-2.3',
      controlName: isEmploymentAI ? 'Bias Audit Requirement' : 'AI system transparency',
      violationType: 'deviation',
      severity: isEmploymentAI ? 'high' : 'low',
      requiresReporting: isEmploymentAI,
      reportingDeadline: isEmploymentAI ? this.calculateDeadline(90) : undefined,
      description: `Explainability failure on ${aiSystem.name}. ${isEmploymentAI ? 'NYC Local Law 144 requires bias audit documentation.' : 'Transparency controls required.'}`,
      affectedSystem: {
        id: aiSystem.id,
        name: aiSystem.name,
        department: aiSystem.department,
      },
      detectedAt: event.metadata.timestamp,
    }];
  }

  /**
   * Helper: Calculate regulatory reporting deadline
   */
  private calculateDeadline(days: number): Date {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + days);
    return deadline;
  }
  
  /**
   * Load compliance mapping rules
   * 
   * 🔒 IP MOAT: Warms policy cache with encrypted database policies
   * Rules are updated quarterly as regulations evolve
   */
  private async loadMappingRules() {
    // Mapping rules are encoded in the handler methods above
    // This structure allows for future expansion to rule-based engine
    
    // Warm the policy cache with common event types
    const criticalEventTypes = [
      'phi_exposure',
      'bias_detected',
      'model_drift',
      'unauthorized_data_access',
      'clinical_accuracy_failure'
    ];
    
    try {
      await policyLoader.warmCache(criticalEventTypes);
      logger.info("✅ Compliance mapping rules loaded - policy cache warmed (IP MOAT activated)");
    } catch (error) {
      // Non-blocking - static rules will work as fallback
      logger.warn({ error }, "⚠️ Failed to warm policy cache - using static fallback rules");
      logger.info("✅ Compliance mapping rules loaded (static mode)");
    }
  }
}
