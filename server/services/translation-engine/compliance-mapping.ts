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
   * Main mapping function: Translate event → compliance violations
   */
  async mapToViolations(event: ParsedEvent): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];
    
    // Get AI system details for context
    const aiSystem = event.aiSystem || await storage.getAISystem(event.aiSystemId);
    if (!aiSystem) {
      throw new Error(`AI system ${event.aiSystemId} not found`);
    }
    
    // Map events to framework-specific violations
    switch (event.eventType) {
      case 'drift':
      case 'performance_degradation':
        violations.push(...await this.handleDrift(event, aiSystem));
        break;
      
      case 'phi_leakage':
        violations.push(...await this.handlePHILeakage(event, aiSystem));
        break;
      
      case 'bias':
        violations.push(...await this.handleBias(event, aiSystem));
        break;
      
      case 'latency':
        violations.push(...await this.handleLatency(event, aiSystem));
        break;
      
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
   */
  private async handleDrift(event: ParsedEvent, aiSystem: AISystem): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];
    const accuracyDrop = event.metrics.accuracyDrop || 0;
    
    // Get configurable thresholds for this health system
    const thresholds = await getThresholds(aiSystem.healthSystemId);
    
    // NIST AI RMF - Performance Monitoring
    if (accuracyDrop > thresholds.drift.accuracyDropMedium) {
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
   */
  private async handlePHILeakage(event: ParsedEvent, aiSystem: AISystem): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];
    
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
   * Helper: Calculate regulatory reporting deadline
   */
  private calculateDeadline(days: number): Date {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + days);
    return deadline;
  }
  
  /**
   * Load compliance mapping rules
   * In production, this would load from database/cache
   * Rules are updated quarterly as regulations evolve
   */
  private loadMappingRules() {
    // Mapping rules are encoded in the handler methods above
    // This structure allows for future expansion to rule-based engine
    logger.info("✅ Compliance mapping rules loaded");
  }
}
