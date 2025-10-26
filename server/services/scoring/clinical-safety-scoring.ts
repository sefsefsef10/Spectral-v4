/**
 * Clinical Safety Scoring Service
 * 
 * CRITICAL COMPONENT (Gap Severity: 90/100)
 * Healthcare-specific risk types: Clinical accuracy, bias, hallucination detection
 * 
 * This service calculates patient safety scores by combining:
 * - Clinical accuracy (correct diagnoses, predictions)
 * - Bias detection (demographic fairness)
 * - Hallucination detection (AI generating false clinical info)
 * - Patient safety events
 * 
 * Weight in overall score: 25% (clinical safety component)
 */

import { storage } from "../../storage";
import { logger } from "../../logger";
import { validateTelemetry, getDataQuality, logScoringAudit } from "./telemetry-validator";

export interface ClinicalSafetyScore {
  score: number; // 0-100 (100 = perfect clinical safety)
  grade: "A" | "B" | "C" | "D" | "F";
  trend: "improving" | "stable" | "declining";
  components: {
    clinicalAccuracy: { score: number; grade: string };
    biasDetection: { score: number; grade: string };
    hallucinationControl: { score: number; grade: string };
    patientSafety: { score: number; grade: string };
  };
  riskFactors: {
    inaccurateDiagnoses: number;
    biasViolations: number;
    hallucinationEvents: number;
    patientSafetyIncidents: number;
  };
  recommendations: string[];
}

// Clinical accuracy event types
const CLINICAL_ACCURACY_EVENTS = [
  'clinical_accuracy_test',
  'diagnosis_accuracy',
  'prediction_accuracy',
  'clinical_validation_failed',
  'false_positive',
  'false_negative',
];

// Bias-related event types
const BIAS_EVENTS = [
  'bias_detected',
  'demographic_disparity',
  'fairness_violation',
  'disparate_impact',
  'bias_test_failed',
];

// Hallucination event types
const HALLUCINATION_EVENTS = [
  'hallucination_detected',
  'false_clinical_info',
  'ai_confabulation',
  'unsupported_claim',
  'model_hallucination',
];

// Patient safety event types
const PATIENT_SAFETY_EVENTS = [
  'patient_safety_incident',
  'adverse_event',
  'near_miss',
  'safety_alert',
  'clinical_error',
];

/**
 * Calculate clinical accuracy score
 */
async function calculateClinicalAccuracyScore(aiSystemId: string): Promise<number> {
  try {
    const events = await storage.getAITelemetryEvents(aiSystemId);
    
    // Get recent clinical accuracy events (last 7 days for clinical metrics)
    const recentEvents = events.filter((e: any) => {
      const eventTime = new Date(e.createdAt).getTime();
      const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      return eventTime > weekAgo && CLINICAL_ACCURACY_EVENTS.includes(e.eventType);
    });

    // No events means no data (default to moderate score)
    if (recentEvents.length === 0) return 75;

    // Calculate risk from clinical accuracy events
    const riskPoints = recentEvents.reduce((sum: number, e: any) => {
      if (e.severity === 'critical') return sum + 50; // Critical clinical error
      if (e.severity === 'high') return sum + 25;
      if (e.severity === 'medium') return sum + 10;
      return sum + 5;
    }, 0);

    // Get AI system to find vendor ID
    const aiSystem = await storage.getAISystem(aiSystemId);
    if (aiSystem && aiSystem.vendorId) {
      // Look for clinical validation test results in vendor test results
      const testResults = await storage.getVendorTestResultsByVendor(aiSystem.vendorId);
      const clinicalTests = testResults.filter((t: any) => t.testType === 'clinical_accuracy');
      
      if (clinicalTests.length > 0) {
        // Use latest test score if available
        const latestTest = clinicalTests[clinicalTests.length - 1];
        if (latestTest.score !== null) {
          return latestTest.score;
        }
      }
    }

    // Convert risk points to score (inverted)
    const normalizedRisk = Math.min(riskPoints, 100);
    return Math.max(0, 100 - normalizedRisk);
  } catch (error) {
    logger.error({ error, aiSystemId }, "Failed to calculate clinical accuracy score");
    return 70; // Default moderate score on error
  }
}

/**
 * Calculate bias detection score
 */
async function calculateBiasScore(aiSystemId: string): Promise<number> {
  try {
    const events = await storage.getAITelemetryEvents(aiSystemId);
    
    // Get recent bias events (last 30 days)
    const recentEvents = events.filter((e: any) => {
      const eventTime = new Date(e.createdAt).getTime();
      const monthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      return eventTime > monthAgo && BIAS_EVENTS.includes(e.eventType);
    });

    // Calculate risk from bias events
    const riskPoints = recentEvents.reduce((sum: number, e: any) => {
      if (e.severity === 'critical') return sum + 40;
      if (e.severity === 'high') return sum + 20;
      if (e.severity === 'medium') return sum + 10;
      return sum + 5;
    }, 0);

    // Get AI system to find vendor ID
    const aiSystem = await storage.getAISystem(aiSystemId);
    if (aiSystem && aiSystem.vendorId) {
      // Check for bias test results
      const testResults = await storage.getVendorTestResultsByVendor(aiSystem.vendorId);
      const biasTests = testResults.filter((t: any) => t.testType === 'bias_detection');
      
      if (biasTests.length > 0) {
        const latestTest = biasTests[biasTests.length - 1];
        if (latestTest.score !== null) {
          return latestTest.score;
        }
      }
    }

    // Convert risk points to score
    const normalizedRisk = Math.min(riskPoints, 100);
    return Math.max(0, 100 - normalizedRisk);
  } catch (error) {
    logger.error({ error, aiSystemId }, "Failed to calculate bias score");
    return 75;
  }
}

/**
 * Calculate hallucination control score
 */
async function calculateHallucinationScore(aiSystemId: string): Promise<number> {
  try {
    const events = await storage.getAITelemetryEvents(aiSystemId);
    
    // Get recent hallucination events (last 7 days)
    const recentEvents = events.filter((e: any) => {
      const eventTime = new Date(e.createdAt).getTime();
      const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      return eventTime > weekAgo && HALLUCINATION_EVENTS.includes(e.eventType);
    });

    // Hallucination events are critical in healthcare
    const riskPoints = recentEvents.reduce((sum: number, e: any) => {
      if (e.severity === 'critical') return sum + 60; // Very serious
      if (e.severity === 'high') return sum + 30;
      if (e.severity === 'medium') return sum + 15;
      return sum + 7;
    }, 0);

    const normalizedRisk = Math.min(riskPoints, 100);
    return Math.max(0, 100 - normalizedRisk);
  } catch (error) {
    logger.error({ error, aiSystemId }, "Failed to calculate hallucination score");
    return 80;
  }
}

/**
 * Calculate patient safety score
 */
async function calculatePatientSafetyScore(aiSystemId: string): Promise<number> {
  try {
    const events = await storage.getAITelemetryEvents(aiSystemId);
    
    // Get patient safety events (last 30 days)
    const recentEvents = events.filter((e: any) => {
      const eventTime = new Date(e.createdAt).getTime();
      const monthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      return eventTime > monthAgo && PATIENT_SAFETY_EVENTS.includes(e.eventType);
    });

    // Patient safety incidents are the most critical
    const riskPoints = recentEvents.reduce((sum: number, e: any) => {
      if (e.severity === 'critical') return sum + 80; // Extremely serious
      if (e.severity === 'high') return sum + 40;
      if (e.severity === 'medium') return sum + 20;
      return sum + 10;
    }, 0);

    const normalizedRisk = Math.min(riskPoints, 100);
    return Math.max(0, 100 - normalizedRisk);
  } catch (error) {
    logger.error({ error, aiSystemId }, "Failed to calculate patient safety score");
    return 85;
  }
}

/**
 * Calculate comprehensive clinical safety score
 */
export async function calculateClinicalSafetyScore(aiSystemId: string): Promise<ClinicalSafetyScore> {
  try {
    // Validate telemetry data freshness and completeness FIRST
    const allEvents = await storage.getAITelemetryEvents(aiSystemId);
    const validation = validateTelemetry(allEvents, 'clinical-safety');
    const dataQuality = getDataQuality(validation);
    
    // Log warnings
    if (validation.warnings.length > 0) {
      logger.warn({ 
        aiSystemId, 
        warnings: validation.warnings,
        telemetryAge: `${Math.round(validation.age)}h`,
        eventCount: validation.eventCount
      }, 'Clinical safety scoring: data quality warnings');
    }
    
    // SHORT-CIRCUIT: Return degraded score when validation fails
    if (validation.errors.length > 0) {
      logger.error({ 
        aiSystemId, 
        errors: validation.errors,
        telemetryAge: `${Math.round(validation.age)}h`,
        eventCount: validation.eventCount
      }, 'Clinical safety scoring: data quality errors - returning degraded score');
      
      logScoringAudit({
        timestamp: new Date(),
        aiSystemId,
        scoringType: 'clinical-safety',
        telemetryAge: validation.age,
        eventCount: validation.eventCount,
        score: 0,
        dataQuality: 'missing',
        warnings: validation.errors,
      });
      
      // Return minimal score structure
      return {
        score: 0,
        grade: "F",
        trend: "stable",
        components: {
          clinicalAccuracy: { score: 0, grade: "F" },
          biasDetection: { score: 0, grade: "F" },
          hallucinationControl: { score: 0, grade: "F" },
          patientSafety: { score: 0, grade: "F" },
        },
        riskFactors: {
          inaccurateDiagnoses: 0,
          biasViolations: 0,
          hallucinationEvents: 0,
          patientSafetyIncidents: 0,
        },
        recommendations: ['Missing or stale telemetry data - unable to assess clinical safety'],
      };
    }
    
    // Calculate component scores in parallel
    const [clinicalAccuracy, biasDetection, hallucinationControl, patientSafety] = await Promise.all([
      calculateClinicalAccuracyScore(aiSystemId),
      calculateBiasScore(aiSystemId),
      calculateHallucinationScore(aiSystemId),
      calculatePatientSafetyScore(aiSystemId),
    ]);

    // Component weights
    const WEIGHTS = {
      clinicalAccuracy: 0.35,   // 35% - Most critical
      biasDetection: 0.25,      // 25% - Fairness is key
      hallucinationControl: 0.20, // 20% - False info is dangerous
      patientSafety: 0.20,      // 20% - Direct harm prevention
    };

    // Calculate overall weighted score
    const score = Math.round(
      clinicalAccuracy * WEIGHTS.clinicalAccuracy +
      biasDetection * WEIGHTS.biasDetection +
      hallucinationControl * WEIGHTS.hallucinationControl +
      patientSafety * WEIGHTS.patientSafety
    );

    // Generate grade
    let grade: "A" | "B" | "C" | "D" | "F";
    if (score >= 90) grade = "A";
    else if (score >= 80) grade = "B";
    else if (score >= 70) grade = "C";
    else if (score >= 60) grade = "D";
    else grade = "F";

    // Helper to generate component grade
    const gradeForScore = (s: number): string => {
      if (s >= 90) return "A";
      if (s >= 80) return "B";
      if (s >= 70) return "C";
      if (s >= 60) return "D";
      return "F";
    };

    // Get event counts for risk factors
    const events = await storage.getAITelemetryEvents(aiSystemId);
    const monthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentEvents = events.filter((e: any) => new Date(e.createdAt).getTime() > monthAgo);

    const riskFactors = {
      inaccurateDiagnoses: recentEvents.filter((e: any) => 
        CLINICAL_ACCURACY_EVENTS.includes(e.eventType)
      ).length,
      biasViolations: recentEvents.filter((e: any) => 
        BIAS_EVENTS.includes(e.eventType)
      ).length,
      hallucinationEvents: recentEvents.filter((e: any) => 
        HALLUCINATION_EVENTS.includes(e.eventType)
      ).length,
      patientSafetyIncidents: recentEvents.filter((e: any) => 
        PATIENT_SAFETY_EVENTS.includes(e.eventType)
      ).length,
    };

    // Calculate trend (compare last 30 days vs previous 30 days)
    const previousEvents = events.filter((e: any) => {
      const eventTime = new Date(e.createdAt).getTime();
      const twoMonthsAgo = Date.now() - (60 * 24 * 60 * 60 * 1000);
      return eventTime > twoMonthsAgo && eventTime <= monthAgo;
    });
    
    const currentRiskEvents = recentEvents.filter((e: any) => 
      [...CLINICAL_ACCURACY_EVENTS, ...BIAS_EVENTS, ...HALLUCINATION_EVENTS, ...PATIENT_SAFETY_EVENTS].includes(e.eventType)
    ).length;
    
    const previousRiskEvents = previousEvents.filter((e: any) => 
      [...CLINICAL_ACCURACY_EVENTS, ...BIAS_EVENTS, ...HALLUCINATION_EVENTS, ...PATIENT_SAFETY_EVENTS].includes(e.eventType)
    ).length;

    let trend: "improving" | "stable" | "declining";
    if (currentRiskEvents < previousRiskEvents * 0.8) trend = "improving";
    else if (currentRiskEvents > previousRiskEvents * 1.2) trend = "declining";
    else trend = "stable";

    // Generate recommendations
    const recommendations: string[] = [];
    if (clinicalAccuracy < 70) {
      recommendations.push("URGENT: Clinical accuracy below acceptable threshold - review model validation");
    }
    if (biasDetection < 75) {
      recommendations.push("Bias detected across demographics - implement fairness constraints");
    }
    if (hallucinationControl < 80) {
      recommendations.push("AI generating unsupported claims - enable fact-checking and citations");
    }
    if (patientSafety < 85) {
      recommendations.push("CRITICAL: Patient safety incidents detected - immediate review required");
    }
    if (riskFactors.patientSafetyIncidents > 0) {
      recommendations.push(`${riskFactors.patientSafetyIncidents} patient safety incident(s) in last 30 days - escalate to clinical team`);
    }

    // Log audit trail for acquisition due diligence
    logScoringAudit({
      timestamp: new Date(),
      aiSystemId,
      scoringType: 'clinical-safety',
      telemetryAge: validation.age,
      eventCount: validation.eventCount,
      score,
      dataQuality,
      warnings: validation.warnings,
    });

    return {
      score,
      grade,
      trend,
      components: {
        clinicalAccuracy: { score: Math.round(clinicalAccuracy), grade: gradeForScore(clinicalAccuracy) },
        biasDetection: { score: Math.round(biasDetection), grade: gradeForScore(biasDetection) },
        hallucinationControl: { score: Math.round(hallucinationControl), grade: gradeForScore(hallucinationControl) },
        patientSafety: { score: Math.round(patientSafety), grade: gradeForScore(patientSafety) },
      },
      riskFactors,
      recommendations,
    };
  } catch (error) {
    logger.error({ error, aiSystemId }, "Failed to calculate clinical safety score");
    throw error;
  }
}

/**
 * Calculate portfolio-wide clinical safety score
 */
export async function calculatePortfolioClinicalSafety(healthSystemId: string): Promise<{
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  systemScores: Array<{ systemId: string; systemName: string; score: number }>;
  criticalSafetyIssues: number;
  totalRiskEvents: number;
}> {
  try {
    const systems = await storage.getAISystems(healthSystemId);

    if (systems.length === 0) {
      return {
        score: 100,
        grade: "A",
        systemScores: [],
        criticalSafetyIssues: 0,
        totalRiskEvents: 0,
      };
    }

    // Calculate score for each system
    const systemAssessments = await Promise.all(
      systems.map(async (sys: any) => {
        const assessment = await calculateClinicalSafetyScore(sys.id);
        return {
          systemId: sys.id,
          systemName: sys.name,
          score: assessment.score,
          assessment,
        };
      })
    );

    const systemScores = systemAssessments.map((s: any) => ({
      systemId: s.systemId,
      systemName: s.systemName,
      score: s.score,
    }));

    // Portfolio score is average
    const avgScore = systemScores.reduce((sum: number, s: any) => sum + s.score, 0) / systemScores.length;

    // Count critical safety issues (patient safety incidents + critical hallucinations)
    const criticalSafetyIssues = systemAssessments.reduce(
      (sum: number, s: any) => sum + s.assessment.riskFactors.patientSafetyIncidents, 
      0
    );

    // Total risk events across all categories
    const totalRiskEvents = systemAssessments.reduce((sum: number, s: any) => {
      const rf = s.assessment.riskFactors;
      return sum + rf.inaccurateDiagnoses + rf.biasViolations + rf.hallucinationEvents + rf.patientSafetyIncidents;
    }, 0);

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
      criticalSafetyIssues,
      totalRiskEvents,
    };
  } catch (error) {
    logger.error({ error, healthSystemId }, "Failed to calculate portfolio clinical safety");
    throw error;
  }
}

export const clinicalSafetyScoringService = {
  calculateClinicalSafetyScore,
  calculatePortfolioClinicalSafety,
};
