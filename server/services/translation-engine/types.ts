/**
 * 🔒 TRANSLATION ENGINE - Type Definitions
 * 
 * Core IP for mapping AI telemetry to healthcare compliance violations
 */

import type { AISystem, AITelemetryEvent, ComplianceControl } from "@shared/schema";

// Event types from AI monitoring platforms
export type EventType = 'drift' | 'phi_leakage' | 'bias' | 'latency' | 'error' | 'performance_degradation';

// Severity levels
export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

// Compliance frameworks
export type Framework = 'HIPAA' | 'NIST_AI_RMF' | 'FDA_SaMD' | 'ISO_42001' | 'CA_SB1047' | 'NYC_LL144';

// Parsed event from raw telemetry
export interface ParsedEvent {
  eventType: EventType;
  severity: Severity;
  metrics: {
    accuracyDrop?: number; // 0.0 to 1.0
    errorRate?: number; // 0.0 to 1.0
    latencyIncreasePct?: number; // percentage increase
    demographicVariance?: number; // 0.0 to 1.0
    phiExposureCount?: number;
    [key: string]: number | string | undefined;
  };
  metadata: {
    source: string; // 'langsmith', 'arize', 'manual'
    runId?: string;
    ruleId?: string;
    timestamp: Date;
    [key: string]: any;
  };
  aiSystemId: string;
  aiSystem?: AISystem; // Will be populated by engine
}

// Compliance violation detected
export interface ComplianceViolation {
  framework: Framework;
  controlId: string;
  controlName: string;
  violationType: 'breach' | 'deviation' | 'threshold_exceeded';
  severity: Severity;
  requiresReporting: boolean; // To regulators
  reportingDeadline?: Date;
  description: string;
  affectedSystem: {
    id: string;
    name: string;
    department: string;
  };
  detectedAt: Date;
}

// Required action based on violation
export interface RequiredAction {
  actionType: 'rollback' | 'notify' | 'document' | 'escalate' | 'restrict';
  priority: 'immediate' | 'urgent' | 'high' | 'medium' | 'low';
  description: string;
  assignee: 'ciso' | 'compliance_officer' | 'clinical_owner' | 'it_owner' | 'privacy_officer';
  deadline: Date;
  automated: boolean; // Can we execute this automatically?
  actionDetails?: Record<string, any>;
}

// Full translation output
export interface TranslatedEvent {
  originalEvent: ParsedEvent;
  violations: ComplianceViolation[];
  actions: RequiredAction[];
  actionsByViolation: Map<ComplianceViolation, RequiredAction[]>; // Grouped for correct persistence
  riskScore: {
    score: number; // 0-100
    level: 'Low' | 'Medium' | 'High' | 'Critical';
    factors: string[];
  };
  escalationRequired: boolean;
  escalationPath?: string[];
  processedAt: Date;
}

// Compliance rule for mapping
export interface ComplianceRule {
  framework: Framework;
  controlId: string;
  triggerConditions: {
    eventTypes: EventType[];
    severityMin?: Severity;
    metricThresholds?: Record<string, number>;
  };
  violationType: 'breach' | 'deviation' | 'threshold_exceeded';
  requiresReporting: boolean;
  reportingDeadlineDays?: number;
}
