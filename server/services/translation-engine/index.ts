/**
 * 🔒 TRANSLATION ENGINE - Main Orchestrator
 * 
 * CORE IP - THE DEFENSIBLE MOAT
 * 
 * Converts AI monitoring telemetry → Healthcare compliance controls
 * This is the core intellectual property that takes 3+ years to replicate
 */

import { ComplianceMapping } from "./compliance-mapping";
import { ActionGenerator } from "./action-generator";
import { eventNormalizer } from "./event-normalizer";
import { calculateRiskScore } from "../risk-scoring";
import type {
  ParsedEvent,
  TranslatedEvent,
  EventType,
  Severity,
  RequiredAction,
} from "./types";
import type { AITelemetryEvent } from "@shared/schema";
import { storage } from "../../storage";

export class TranslationEngine {
  private complianceMapper: ComplianceMapping;
  private actionGenerator: ActionGenerator;
  
  constructor() {
    this.complianceMapper = new ComplianceMapping();
    this.actionGenerator = new ActionGenerator();
  }
  
  /**
   * Main translation function
   * 
   * Input: Raw telemetry from LangSmith/Arize/Custom
   * Output: Healthcare compliance violations + required actions grouped by violation
   */
  async translate(telemetryEvent: AITelemetryEvent): Promise<TranslatedEvent> {
    // Step 1: Parse the raw telemetry event
    const parsed = await this.parseEvent(telemetryEvent);
    
    // Step 2: Map to compliance frameworks (🔒 Core IP)
    const violations = await this.complianceMapper.mapToViolations(parsed);
    
    // Step 3: Calculate risk score
    const riskScore = this.calculateRisk(parsed, violations);
    
    // Step 4: Generate required actions (grouped by violation)
    const actionsByViolation = this.actionGenerator.generate(violations);
    
    // Flatten actions for convenience, but preserve grouping in return value
    const allActions: RequiredAction[] = [];
    actionsByViolation.forEach(actions => allActions.push(...actions));
    
    // Step 5: Determine escalation requirements
    const { escalationRequired, escalationPath } = this.determineEscalation(violations, riskScore);
    
    return {
      originalEvent: parsed,
      violations,
      actions: allActions,
      actionsByViolation, // Add grouped actions for proper persistence
      riskScore,
      escalationRequired,
      escalationPath,
      processedAt: new Date(),
    };
  }
  
  /**
   * Parse telemetry event into standardized format using Event Normalizer
   */
  private async parseEvent(event: AITelemetryEvent): Promise<ParsedEvent> {
    // Get AI system for context
    const aiSystem = await storage.getAISystem(event.aiSystemId);
    
    // Extract metrics from payload
    const payload = event.payload ? JSON.parse(event.payload) : {};
    
    // Normalize event using Phase 1 Event Normalizer (20 event types)
    const normalization = eventNormalizer.normalize(event, payload);
    
    return {
      eventType: normalization.eventType,
      severity: normalization.severity,
      metrics: {
        ...normalization.metrics,
        // Add metricValue from event if not already set
        metricValue: normalization.metrics.metricValue ?? (event.metricValue ? parseFloat(event.metricValue) : undefined),
      },
      metadata: {
        source: event.source,
        runId: event.runId || undefined,
        ruleId: event.ruleId || undefined,
        timestamp: event.createdAt,
        originalPayload: payload,
        normalizationConfidence: normalization.confidence,
      },
      aiSystemId: event.aiSystemId,
      aiSystem: aiSystem || undefined,
    };
  }
  /**
   * Calculate overall risk score
   */
  private calculateRisk(event: ParsedEvent, violations: any[]): TranslatedEvent['riskScore'] {
    // Count violations by severity
    const severityCounts = {
      critical: violations.filter(v => v.severity === 'critical').length,
      high: violations.filter(v => v.severity === 'high').length,
      medium: violations.filter(v => v.severity === 'medium').length,
      low: violations.filter(v => v.severity === 'low').length,
    };
    
    // Weighted score (same as existing risk-scoring.ts)
    const score = (
      severityCounts.critical * 10 +
      severityCounts.high * 5 +
      severityCounts.medium * 2 +
      severityCounts.low * 1
    );
    
    // Determine level
    let level: 'Low' | 'Medium' | 'High' | 'Critical';
    if (score >= 10) level = 'Critical';
    else if (score >= 5) level = 'High';
    else if (score >= 2) level = 'Medium';
    else level = 'Low';
    
    // Build factor list
    const factors: string[] = [];
    if (severityCounts.critical > 0) {
      factors.push(`${severityCounts.critical} critical violation(s)`);
    }
    if (severityCounts.high > 0) {
      factors.push(`${severityCounts.high} high-severity violation(s)`);
    }
    if (event.eventType === 'phi_leakage') {
      factors.push('PHI breach detected');
    }
    if (violations.some(v => v.requiresReporting)) {
      factors.push('Regulatory reporting required');
    }
    
    return { score, level, factors };
  }
  
  /**
   * Determine if escalation is required and build escalation path
   */
  private determineEscalation(violations: any[], riskScore: any): { 
    escalationRequired: boolean; 
    escalationPath?: string[]; 
  } {
    // Escalate if:
    // 1. Any critical violations
    // 2. Multiple high violations
    // 3. Regulatory reporting required
    
    const hasCritical = violations.some(v => v.severity === 'critical');
    const highCount = violations.filter(v => v.severity === 'high').length;
    const requiresReporting = violations.some(v => v.requiresReporting);
    
    const escalationRequired = hasCritical || highCount >= 2 || requiresReporting;
    
    if (!escalationRequired) {
      return { escalationRequired: false };
    }
    
    // Build escalation path based on violation types
    const path: string[] = [];
    
    // PHI breach → Privacy Officer first
    if (violations.some(v => v.controlId === '164.402')) {
      path.push('Privacy Officer', 'CISO', 'Chief Compliance Officer', 'Board');
    }
    // FDA issues → Compliance Officer first
    else if (violations.some(v => v.framework === 'FDA_SaMD')) {
      path.push('Chief Compliance Officer', 'CISO', 'Clinical Owner', 'Board');
    }
    // Other critical issues → CISO first
    else {
      path.push('CISO', 'Chief Compliance Officer', 'Board');
    }
    
    return { escalationRequired, escalationPath: path };
  }
}

// Export singleton instance
export const translationEngine = new TranslationEngine();

// Export classes for testing/extension
export { ComplianceMapping, ActionGenerator };
export * from './types';
