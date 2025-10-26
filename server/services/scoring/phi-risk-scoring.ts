/**
 * PHI Risk Scoring Service
 * 
 * CRITICAL COMPONENT (Gap Severity: 95/100)
 * PHI leakage is Spectral's #1 value proposition.
 * 
 * This service calculates PHI protection scores by:
 * - Identifying PHI-specific telemetry events
 * - Weighting PHI events 10x higher than generic events
 * - Tracking PHI exposure risk across AI systems
 * - Mapping PHI violations to HIPAA controls
 * 
 * Score: 0-100 (higher = better PHI protection)
 * Weight in overall score: 35% (highest priority)
 */

import { storage } from "../../storage";
import { logger } from "../../logger";
import { 
  validateTelemetry, 
  logScoringAudit, 
  getDataQuality, 
  getConfidenceModifier 
} from "./telemetry-validator";

export interface PHIRiskScore {
  score: number; // 0-100 (100 = perfect PHI protection)
  grade: "A" | "B" | "C" | "D" | "F";
  trend: "improving" | "stable" | "declining";
  phiEvents: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  riskFactors: {
    phiLeakageEvents: number; // Actual PHI detected in outputs
    phiExposureRisk: number; // Systems with high PHI exposure risk
    phiAccessViolations: number; // Unauthorized PHI access attempts
    encryptionFailures: number; // Failed PHI encryption events
  };
  hipaaImpact: {
    violatedControls: string[]; // HIPAA controls violated by PHI events
    severity: "none" | "low" | "medium" | "high" | "critical";
  };
  recommendations: string[];
}

// PHI event types that trigger scoring (mapped from aiTelemetryEvents)
const PHI_EVENT_TYPES = [
  'phi_exposure',
  'phi_leak',
  'phi_leakage_detected',
  'phi_access_violation',
  'phi_encryption_failure',
  'unauthorized_phi_access',
  'phi_in_logs',
  'phi_in_model_output',
];

// PHI metric types from predictive alerts
const PHI_METRICS = [
  'phi_leak_count',
  'phi_exposure_score',
  'phi_risk_level',
];

// HIPAA controls related to PHI protection
const PHI_HIPAA_CONTROLS = {
  '164.312(a)(1)': 'Access Control - PHI Access Authorization',
  '164.312(b)': 'Audit Controls - PHI Access Logging',
  '164.312(c)(1)': 'Integrity Controls - PHI Data Integrity',
  '164.312(d)': 'Person or Entity Authentication',
  '164.312(e)(1)': 'Transmission Security - PHI Encryption',
  '164.308(a)(1)': 'Security Management Process',
  '164.308(a)(3)': 'Workforce Security - PHI Access',
  '164.530(c)': 'Safeguards - PHI Protection',
};

/**
 * Calculate PHI risk score for a single AI system
 */
export async function calculatePHIRiskScore(aiSystemId: string): Promise<number> {
  try {
    // Get ALL telemetry events (not just recent) for validation
    const allEvents = await storage.getAITelemetryEvents(aiSystemId);
    
    // Validate telemetry data freshness and completeness
    const validation = validateTelemetry(allEvents, 'phi-risk');
    const dataQuality = getDataQuality(validation);
    
    // Log warnings and errors
    if (validation.warnings.length > 0) {
      logger.warn({ 
        aiSystemId, 
        warnings: validation.warnings,
        telemetryAge: `${Math.round(validation.age)}h`,
        eventCount: validation.eventCount
      }, 'PHI risk scoring: data quality warnings');
    }
    
    if (validation.errors.length > 0) {
      logger.error({ 
        aiSystemId, 
        errors: validation.errors,
        telemetryAge: `${Math.round(validation.age)}h`,
        eventCount: validation.eventCount
      }, 'PHI risk scoring: data quality errors - returning degraded score');
      
      // SHORT-CIRCUIT: Return degraded score immediately when validation fails
      // This prevents stale/missing telemetry from inflating grades
      logScoringAudit({
        timestamp: new Date(),
        aiSystemId,
        scoringType: 'phi-risk',
        telemetryAge: validation.age,
        eventCount: validation.eventCount,
        score: 0,
        dataQuality: 'missing',
        warnings: validation.errors,
      });
      
      return 0;
    }
    
    // Filter for recent events (last 24 hours) for scoring
    const recentEvents = allEvents.filter((e: any) => {
      const eventTime = new Date(e.createdAt).getTime();
      const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
      return eventTime > dayAgo;
    });

    // Filter for PHI-specific events
    const phiEvents = recentEvents.filter((e: any) => 
      PHI_EVENT_TYPES.includes(e.eventType) || 
      (e.metric && PHI_METRICS.includes(e.metric))
    );

    // Weight PHI events heavily (10x multiplier vs generic events)
    const phiRiskPoints = phiEvents.reduce((sum: number, e: any) => {
      if (e.severity === 'critical') return sum + 100; // Critical PHI leak = 100 points
      if (e.severity === 'high') return sum + 50;      // High PHI risk = 50 points
      if (e.severity === 'medium') return sum + 20;    // Medium PHI risk = 20 points
      return sum + 10;                                  // Low PHI risk = 10 points
    }, 0);

    // Get predictive alerts for PHI exposure
    const predictiveAlerts = await storage.getPredictiveAlerts(aiSystemId);
    const phiPredictiveAlerts = predictiveAlerts.filter((a: any) => 
      a.predictionType === 'phi_exposure' && !a.dismissed
    );
    
    // Add predictive risk points (20 points per high-confidence PHI prediction)
    const predictiveRiskPoints = phiPredictiveAlerts.reduce((sum: number, alert: any) => {
      const confidence = alert.confidenceScore || 0;
      if (confidence > 80) return sum + 20;
      if (confidence > 60) return sum + 10;
      return sum + 5;
    }, 0);

    // Total risk points
    const totalRiskPoints = phiRiskPoints + predictiveRiskPoints;

    // Convert to 0-100 score (inverted: higher score = better protection)
    // Cap at 200 points max for normalization
    const normalizedRisk = Math.min(totalRiskPoints, 200);
    let score = Math.max(0, 100 - (normalizedRisk / 2));
    
    // Apply confidence modifier based on data quality
    // Stale data gets penalized, missing data gets heavily penalized
    const confidenceModifier = getConfidenceModifier(dataQuality);
    score = score * confidenceModifier;
    
    // Audit log for due diligence
    logScoringAudit({
      timestamp: new Date(),
      aiSystemId,
      scoringType: 'phi-risk',
      telemetryAge: validation.age,
      eventCount: validation.eventCount,
      score: Math.round(score),
      dataQuality,
      warnings: validation.warnings,
    });

    return Math.round(score);
  } catch (error) {
    logger.error({ error, aiSystemId }, "Failed to calculate PHI risk score");
    
    // Audit log the failure
    logScoringAudit({
      timestamp: new Date(),
      aiSystemId,
      scoringType: 'phi-risk',
      telemetryAge: Infinity,
      eventCount: 0,
      score: 0,
      dataQuality: 'missing',
      warnings: ['Scoring calculation failed - returning degraded score'],
    });
    
    // Return degraded score (0) instead of optimistic 50
    return 0;
  }
}

/**
 * Calculate comprehensive PHI risk assessment for an AI system
 */
export async function calculateComprehensivePHIRisk(aiSystemId: string): Promise<PHIRiskScore> {
  try {
    const score = await calculatePHIRiskScore(aiSystemId);
    
    // Get recent PHI events for breakdown
    const events = await storage.getAITelemetryEvents(aiSystemId);
    const recentEvents = events.filter((e: any) => {
      const eventTime = new Date(e.createdAt).getTime();
      const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
      return eventTime > dayAgo;
    });

    const phiEvents = recentEvents.filter((e: any) => 
      PHI_EVENT_TYPES.includes(e.eventType) || 
      (e.metric && PHI_METRICS.includes(e.metric))
    );

    // Categorize PHI events by severity
    const phiEventBreakdown = {
      critical: phiEvents.filter((e: any) => e.severity === 'critical').length,
      high: phiEvents.filter((e: any) => e.severity === 'high').length,
      medium: phiEvents.filter((e: any) => e.severity === 'medium').length,
      low: phiEvents.filter((e: any) => e.severity === 'low').length,
      total: phiEvents.length,
    };

    // Categorize by risk factor type
    const riskFactors = {
      phiLeakageEvents: phiEvents.filter((e: any) => 
        e.eventType.includes('leak') || e.eventType.includes('exposure')
      ).length,
      phiExposureRisk: phiEvents.filter((e: any) => 
        e.eventType.includes('exposure')
      ).length,
      phiAccessViolations: phiEvents.filter((e: any) => 
        e.eventType.includes('access') || e.eventType.includes('unauthorized')
      ).length,
      encryptionFailures: phiEvents.filter((e: any) => 
        e.eventType.includes('encryption')
      ).length,
    };

    // Determine violated HIPAA controls based on event types
    const violatedControls: string[] = [];
    if (riskFactors.phiLeakageEvents > 0) {
      violatedControls.push('164.530(c)'); // Safeguards - PHI Protection
      violatedControls.push('164.312(c)(1)'); // Integrity Controls
    }
    if (riskFactors.phiAccessViolations > 0) {
      violatedControls.push('164.312(a)(1)'); // Access Control
      violatedControls.push('164.312(d)'); // Authentication
    }
    if (riskFactors.encryptionFailures > 0) {
      violatedControls.push('164.312(e)(1)'); // Transmission Security
    }
    if (phiEventBreakdown.total > 0) {
      violatedControls.push('164.312(b)'); // Audit Controls (should have caught this)
    }

    // Determine HIPAA impact severity
    let hipaaImpactSeverity: "none" | "low" | "medium" | "high" | "critical" = "none";
    if (phiEventBreakdown.critical > 0) hipaaImpactSeverity = "critical";
    else if (phiEventBreakdown.high > 0) hipaaImpactSeverity = "high";
    else if (phiEventBreakdown.medium > 0) hipaaImpactSeverity = "medium";
    else if (phiEventBreakdown.low > 0) hipaaImpactSeverity = "low";

    // Generate grade
    let grade: "A" | "B" | "C" | "D" | "F";
    if (score >= 90) grade = "A";
    else if (score >= 80) grade = "B";
    else if (score >= 70) grade = "C";
    else if (score >= 60) grade = "D";
    else grade = "F";

    // Calculate trend (compare last 24h vs previous 24h)
    const previousEvents = events.filter((e: any) => {
      const eventTime = new Date(e.createdAt).getTime();
      const twoDaysAgo = Date.now() - (48 * 60 * 60 * 1000);
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      return eventTime > twoDaysAgo && eventTime <= oneDayAgo;
    });
    const previousPHIEvents = previousEvents.filter((e: any) => 
      PHI_EVENT_TYPES.includes(e.eventType)
    ).length;
    
    let trend: "improving" | "stable" | "declining";
    if (phiEvents.length < previousPHIEvents * 0.8) trend = "improving";
    else if (phiEvents.length > previousPHIEvents * 1.2) trend = "declining";
    else trend = "stable";

    // Generate recommendations
    const recommendations: string[] = [];
    if (phiEventBreakdown.critical > 0) {
      recommendations.push("URGENT: Critical PHI leakage detected. Immediate rollback recommended.");
      recommendations.push("Review access controls per HIPAA 164.312(a)(1)");
    }
    if (riskFactors.encryptionFailures > 0) {
      recommendations.push("Enable PHI encryption in transit per HIPAA 164.312(e)(1)");
    }
    if (riskFactors.phiAccessViolations > 0) {
      recommendations.push("Audit user permissions and implement least-privilege access");
    }
    if (score < 70) {
      recommendations.push("Consider pausing system deployment until PHI protection improves");
    }
    if (violatedControls.length > 0) {
      recommendations.push(`Address ${violatedControls.length} HIPAA control violations`);
    }

    return {
      score,
      grade,
      trend,
      phiEvents: phiEventBreakdown,
      riskFactors,
      hipaaImpact: {
        violatedControls,
        severity: hipaaImpactSeverity,
      },
      recommendations,
    };
  } catch (error) {
    logger.error({ error, aiSystemId }, "Failed to calculate comprehensive PHI risk");
    throw error;
  }
}

/**
 * Calculate portfolio-wide PHI protection score
 */
export async function calculatePortfolioPHIScore(healthSystemId: string): Promise<{
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  systemScores: Array<{ systemId: string; systemName: string; score: number }>;
  criticalPHIIssues: number;
  totalViolatedControls: string[];
}> {
  try {
    const systems = await storage.getAISystems(healthSystemId);
    
    if (systems.length === 0) {
      return {
        score: 100,
        grade: "A",
        systemScores: [],
        criticalPHIIssues: 0,
        totalViolatedControls: [],
      };
    }

    // Calculate score for each system
    const systemScores = await Promise.all(
      systems.map(async (sys: any) => ({
        systemId: sys.id,
        systemName: sys.name,
        score: await calculatePHIRiskScore(sys.id),
      }))
    );

    // Portfolio score is average of system scores
    const avgScore = systemScores.reduce((sum: number, s: any) => sum + s.score, 0) / systemScores.length;
    
    // Get comprehensive assessments to count critical issues
    const assessments = await Promise.all(
      systems.map((sys: any) => calculateComprehensivePHIRisk(sys.id))
    );

    const criticalPHIIssues = assessments.reduce(
      (sum: number, a: any) => sum + a.phiEvents.critical, 
      0
    );

    // Collect all unique violated controls
    const allViolatedControls = new Set<string>();
    assessments.forEach((a: any) => {
      a.hipaaImpact.violatedControls.forEach((c: string) => allViolatedControls.add(c));
    });

    // Generate grade
    let grade: "A" | "B" | "C" | "D" | "F";
    if (avgScore >= 90) grade = "A";
    else if (avgScore >= 80) grade = "B";
    else if (avgScore >= 70) grade = "C";
    else if (avgScore >= 60) grade = "D";
    else grade = "F";

    return {
      score: Math.round(avgScore),
      grade,
      systemScores,
      criticalPHIIssues,
      totalViolatedControls: Array.from(allViolatedControls),
    };
  } catch (error) {
    logger.error({ error, healthSystemId }, "Failed to calculate portfolio PHI score");
    throw error;
  }
}

export const phiRiskScoringService = {
  calculatePHIRiskScore,
  calculateComprehensivePHIRisk,
  calculatePortfolioPHIScore,
};
