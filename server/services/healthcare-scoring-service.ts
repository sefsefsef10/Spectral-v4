/**
 * 🏥 HEALTHCARE-SPECIFIC SCORING SERVICE
 * 
 * Provides acquisition-ready scoring aligned with healthcare AI governance:
 * - PHI Protection (35% weight) - 10x weighting for PHI events
 * - Clinical Safety (25% weight) - Patient safety + accuracy
 * - Regulatory Compliance (25% weight) - Framework-specific breakdown
 * - Operational Health (15% weight) - Response time, uptime
 * 
 * Integrates with translation engine for framework-specific violations
 */

import { storage } from "../storage";
import { logger } from "../logger";
import type { ComplianceViolation } from "./translation-engine/types";

export interface HealthcarePortfolioScore {
  overall: number; // 0-100
  breakdown: {
    phiProtection: number;        // 35% weight - Maps to HIPAA PHI controls
    clinicalSafety: number;        // 25% weight - Patient safety + accuracy
    regulatoryCompliance: number;  // 25% weight - Framework coverage
    operationalHealth: number;     // 15% weight - Response time, uptime
  };
  frameworkBreakdown: {
    hipaa: FrameworkScore;
    nist: FrameworkScore;
    fda: FrameworkScore;
    stateLaws: FrameworkScore;
  };
  criticalIssues: CriticalIssues;
  boardMetrics: BoardMetrics;
  grade: "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" | "D+" | "D" | "D-" | "F";
  trend: "improving" | "stable" | "declining";
  lastUpdated: Date;
}

export interface FrameworkScore {
  score: number; // 0-100
  totalControls: number;
  compliantControls: number;
  violations: ViolationSummary[];
  coveragePercentage: number; // (compliantControls / totalControls) * 100
}

export interface ViolationSummary {
  controlId: string;
  controlName: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  count: number;
  lastDetected: Date;
  requiresReporting: boolean;
}

export interface CriticalIssues {
  phiViolations: number;          // Count of PHI breaches (164.402)
  patientSafetyIncidents: number; // Clinical accuracy failures
  complianceViolations: number;   // Reporting-required violations
  unresolvedAlerts: number;       // Unresolved high/critical alerts
}

export interface BoardMetrics {
  totalAISystems: number;
  auditReady: boolean;             // All systems have compliance mappings
  averageResponseTimeMin: number | null;
  beaconTiers: {
    verified: number;   // Silver tier count
    certified: number;  // Gold tier count
    trusted: number;    // Platinum tier count
  };
}

/**
 * Calculate comprehensive healthcare portfolio score
 * Integrates with translation engine for framework-specific violations
 */
export async function calculateHealthcarePortfolioScore(
  healthSystemId: string
): Promise<HealthcarePortfolioScore> {
  logger.info({ healthSystemId }, "Calculating healthcare portfolio score");

  const systems = await storage.getAISystems(healthSystemId);
  
  if (systems.length === 0) {
    return getEmptyScore();
  }

  // 1. Get all compliance violations from translation engine
  const allViolations = await getViolationsForHealthSystem(healthSystemId);
  
  // 2. Calculate component scores
  const phiScore = await calculatePHIProtectionScore(healthSystemId, allViolations);
  const clinicalScore = await calculateClinicalSafetyScore(healthSystemId, allViolations);
  const regulatoryScore = await calculateRegulatoryComplianceScore(healthSystemId, allViolations);
  const operationalScore = await calculateOperationalHealthScore(healthSystemId);
  
  // 3. Calculate weighted overall score
  // PHI (35%), Clinical (25%), Regulatory (25%), Operational (15%)
  const overall = Math.round(
    phiScore * 0.35 +
    clinicalScore * 0.25 +
    regulatoryScore * 0.25 +
    operationalScore * 0.15
  );
  
  // 4. Framework-specific breakdown
  const frameworkBreakdown = await calculateFrameworkBreakdown(allViolations, healthSystemId);
  
  // 5. Critical issues count
  const criticalIssues = await calculateCriticalIssues(allViolations, healthSystemId);
  
  // 6. Board metrics
  const boardMetrics = await calculateBoardMetrics(healthSystemId);
  
  // 7. Assign granular grade (A+, A, A-, B+, etc.)
  const grade = assignGrade(overall);
  
  // 8. Calculate trend (compare to 30 days ago)
  const trend = await calculateTrend(healthSystemId, overall);
  
  return {
    overall,
    breakdown: {
      phiProtection: phiScore,
      clinicalSafety: clinicalScore,
      regulatoryCompliance: regulatoryScore,
      operationalHealth: operationalScore,
    },
    frameworkBreakdown,
    criticalIssues,
    boardMetrics,
    grade,
    trend,
    lastUpdated: new Date(),
  };
}

/**
 * Get all compliance violations for a health system
 * Queries the complianceViolations table populated by translation engine
 */
async function getViolationsForHealthSystem(
  healthSystemId: string
): Promise<ComplianceViolation[]> {
  try {
    // Query compliance violations from database
    // The translation engine populates this table when processing telemetry events
    const dbViolations = await storage.getComplianceViolations(healthSystemId);
    
    // Transform database schema to ComplianceViolation type
    const violations: ComplianceViolation[] = dbViolations.map(v => {
      // Get AI system info for affectedSystem field
      return {
        framework: v.framework as any,
        controlId: v.controlId,
        controlName: v.controlName,
        violationType: v.violationType as any,
        severity: v.severity as any,
        requiresReporting: v.requiresReporting,
        reportingDeadline: v.reportingDeadline || undefined,
        description: v.description,
        affectedSystem: {
          id: v.aiSystemId,
          name: "AI System", // TODO: Join with aiSystems table
          department: "Unknown", // TODO: Join with aiSystems table
        },
        detectedAt: v.createdAt,
      };
    });
    
    logger.info({
      healthSystemId,
      violationCount: violations.length
    }, "Retrieved compliance violations");
    
    return violations;
  } catch (error) {
    logger.error({ healthSystemId, error }, "Failed to retrieve compliance violations");
    return [];
  }
}

/**
 * Calculate PHI Protection Score (35% weight)
 * 10x weighting for PHI exposure events
 * Maps to HIPAA controls: 164.312(a), 164.312(b), 164.402
 */
async function calculatePHIProtectionScore(
  healthSystemId: string,
  violations: ComplianceViolation[]
): Promise<number> {
  // Filter PHI-related violations (HIPAA controls)
  const phiViolations = violations.filter(v => 
    v.framework === 'HIPAA' && 
    (v.controlId.includes('164.312') || v.controlId === '164.402')
  );
  
  // 10x weight for critical PHI breaches (164.402)
  const breachViolations = phiViolations.filter(v => v.controlId === '164.402');
  const otherViolations = phiViolations.filter(v => v.controlId !== '164.402');
  
  // Calculate weighted violation count
  const weightedViolations = (breachViolations.length * 10) + otherViolations.length;
  
  // Score: Start at 100, deduct for violations
  // Each weighted violation = -5 points
  const score = Math.max(0, 100 - (weightedViolations * 5));
  
  logger.info({
    healthSystemId,
    phiViolations: phiViolations.length,
    breaches: breachViolations.length,
    score
  }, "PHI protection score calculated");
  
  return score;
}

/**
 * Calculate Clinical Safety Score (25% weight)
 * Combines accuracy + bias + hallucinations + patient safety
 */
async function calculateClinicalSafetyScore(
  healthSystemId: string,
  violations: ComplianceViolation[]
): Promise<number> {
  // Clinical safety violations:
  // - clinical_accuracy_failure
  // - false_negative_alert / false_positive_alert
  // - harmful_output
  // - bias_detected
  
  const clinicalViolations = violations.filter(v => 
    v.controlId.includes('FDA') || 
    v.violationType === 'deviation' ||
    v.description.toLowerCase().includes('clinical') ||
    v.description.toLowerCase().includes('bias') ||
    v.description.toLowerCase().includes('accuracy')
  );
  
  // Weight by severity
  const severityWeights = {
    critical: 10,
    high: 5,
    medium: 2,
    low: 1,
    info: 0
  };
  
  const weightedViolations = clinicalViolations.reduce((sum, v) => {
    return sum + (severityWeights[v.severity as keyof typeof severityWeights] || 0);
  }, 0);
  
  // Score: Start at 100, deduct for weighted violations
  const score = Math.max(0, 100 - weightedViolations);
  
  logger.info({
    healthSystemId,
    clinicalViolations: clinicalViolations.length,
    weightedViolations,
    score
  }, "Clinical safety score calculated");
  
  return score;
}

/**
 * Calculate Regulatory Compliance Score (25% weight)
 * Framework-specific compliance percentage
 */
async function calculateRegulatoryComplianceScore(
  healthSystemId: string,
  violations: ComplianceViolation[]
): Promise<number> {
  // Total controls across frameworks:
  // HIPAA: 43 controls (as per re-grading report)
  // NIST AI RMF: 18 controls
  // FDA SaMD: 10 controls
  // State laws: varies
  
  const totalControls = 43 + 18 + 10; // 71 total
  
  // Unique violated controls
  const violatedControls = new Set(violations.map(v => `${v.framework}:${v.controlId}`));
  const compliantControls = totalControls - Math.min(violatedControls.size, totalControls);
  
  const score = Math.round((compliantControls / totalControls) * 100);
  
  logger.info({
    healthSystemId,
    totalControls,
    violatedControls: violatedControls.size,
    compliantControls,
    score
  }, "Regulatory compliance score calculated");
  
  return score;
}

/**
 * Calculate Operational Health Score (15% weight)
 * Response time, alert management, system uptime
 */
async function calculateOperationalHealthScore(
  healthSystemId: string
): Promise<number> {
  // 1. Alert response time
  const alerts = await storage.getAlerts(healthSystemId);
  const resolvedAlerts = alerts.filter(a => a.resolved === true);
  
  let responseTimeScore = 100;
  if (resolvedAlerts.length > 0) {
    const avgResponseTimeMs = resolvedAlerts.reduce((sum, a) => {
      const responseTime = a.resolvedAt && a.createdAt 
        ? new Date(a.resolvedAt).getTime() - new Date(a.createdAt).getTime()
        : 0;
      return sum + responseTime;
    }, 0) / resolvedAlerts.length;
    
    const avgResponseTimeMin = avgResponseTimeMs / (1000 * 60);
    
    // Target: < 2 minutes (as mentioned in acquisition goals)
    if (avgResponseTimeMin > 10) responseTimeScore = 60;
    else if (avgResponseTimeMin > 5) responseTimeScore = 80;
    else if (avgResponseTimeMin > 2) responseTimeScore = 90;
  }
  
  // 2. Unresolved alert penalty
  const unresolvedAlerts = alerts.filter(a => a.resolved !== true);
  const alertScore = Math.max(0, 100 - (unresolvedAlerts.length * 5));
  
  // Combined operational score
  const score = Math.round((responseTimeScore * 0.6) + (alertScore * 0.4));
  
  logger.info({
    healthSystemId,
    responseTimeScore,
    alertScore,
    score
  }, "Operational health score calculated");
  
  return score;
}

/**
 * Calculate framework-specific breakdown
 * Shows "HIPAA: 41/43 controls" style metrics
 */
async function calculateFrameworkBreakdown(
  violations: ComplianceViolation[],
  healthSystemId: string
): Promise<HealthcarePortfolioScore['frameworkBreakdown']> {
  const frameworks = {
    HIPAA: { total: 43, framework: 'HIPAA' },
    NIST_AI_RMF: { total: 18, framework: 'NIST_AI_RMF' },
    FDA_SaMD: { total: 10, framework: 'FDA_SaMD' },
    STATE: { total: 5, framework: 'CA_SB1047' } // Placeholder for state laws
  };
  
  const breakdown: HealthcarePortfolioScore['frameworkBreakdown'] = {
    hipaa: calculateFrameworkScore(violations, 'HIPAA', 43),
    nist: calculateFrameworkScore(violations, 'NIST_AI_RMF', 18),
    fda: calculateFrameworkScore(violations, 'FDA_SaMD', 10),
    stateLaws: calculateFrameworkScore(violations, 'CA_SB1047', 5),
  };
  
  return breakdown;
}

function calculateFrameworkScore(
  violations: ComplianceViolation[],
  framework: string,
  totalControls: number
): FrameworkScore {
  const frameworkViolations = violations.filter(v => v.framework === framework);
  
  // Group violations by control ID
  const violationsByControl = new Map<string, ComplianceViolation[]>();
  frameworkViolations.forEach(v => {
    const existing = violationsByControl.get(v.controlId) || [];
    existing.push(v);
    violationsByControl.set(v.controlId, existing);
  });
  
  const violatedControlCount = violationsByControl.size;
  const compliantControls = totalControls - Math.min(violatedControlCount, totalControls);
  const coveragePercentage = (compliantControls / totalControls) * 100;
  const score = Math.round(coveragePercentage);
  
  // Create violation summaries
  const violationSummaries: ViolationSummary[] = Array.from(violationsByControl.entries()).map(([controlId, viols]) => {
    const latestViolation = viols.sort((a, b) => 
      new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
    )[0];
    
    return {
      controlId,
      controlName: latestViolation.controlName,
      severity: latestViolation.severity as any,
      count: viols.length,
      lastDetected: new Date(latestViolation.detectedAt),
      requiresReporting: latestViolation.requiresReporting,
    };
  });
  
  return {
    score,
    totalControls,
    compliantControls,
    violations: violationSummaries,
    coveragePercentage,
  };
}

/**
 * Calculate critical issues for board dashboard
 */
async function calculateCriticalIssues(
  violations: ComplianceViolation[],
  healthSystemId: string
): Promise<CriticalIssues> {
  const phiViolations = violations.filter(v => 
    v.controlId === '164.402' && v.severity === 'critical'
  ).length;
  
  const patientSafetyIncidents = violations.filter(v =>
    v.description.toLowerCase().includes('clinical') ||
    v.description.toLowerCase().includes('patient')
  ).length;
  
  const complianceViolations = violations.filter(v => v.requiresReporting).length;
  
  const alerts = await storage.getAlerts(healthSystemId);
  const unresolvedAlerts = alerts.filter(a => 
    a.resolved !== true && 
    (a.severity === 'high' || a.severity === 'critical')
  ).length;
  
  return {
    phiViolations,
    patientSafetyIncidents,
    complianceViolations,
    unresolvedAlerts,
  };
}

/**
 * Calculate board-level metrics
 */
async function calculateBoardMetrics(
  healthSystemId: string
): Promise<BoardMetrics> {
  const systems = await storage.getAISystems(healthSystemId);
  
  // Audit readiness: All systems have compliance mappings
  const mappingsPromises = systems.map(s => storage.getComplianceMappingsBySystem(s.id));
  const allMappings = await Promise.all(mappingsPromises);
  const auditReady = allMappings.every(m => m.length > 0);
  
  // Average response time
  const alerts = await storage.getAlerts(healthSystemId);
  const resolvedAlerts = alerts.filter(a => a.resolved === true && a.resolvedAt);
  
  let averageResponseTimeMin: number | null = null;
  if (resolvedAlerts.length > 0) {
    const totalResponseTimeMs = resolvedAlerts.reduce((sum, a) => {
      const responseTime = a.resolvedAt && a.createdAt
        ? new Date(a.resolvedAt).getTime() - new Date(a.createdAt).getTime()
        : 0;
      return sum + responseTime;
    }, 0);
    averageResponseTimeMin = totalResponseTimeMs / (resolvedAlerts.length * 1000 * 60);
  }
  
  // Beacon tier distribution (using certification applications)
  // Note: Using certificationApplications which has tierRequested field
  // TODO: Update when tier system is fully implemented in complianceCertifications
  const beaconTiers = {
    verified: 0,   // Silver tier - TODO: query certificationApplications
    certified: 0,  // Gold tier - TODO: query certificationApplications
    trusted: 0,    // Platinum tier - TODO: query certificationApplications
  };
  
  return {
    totalAISystems: systems.length,
    auditReady,
    averageResponseTimeMin,
    beaconTiers,
  };
}

/**
 * Assign granular letter grade
 */
function assignGrade(score: number): HealthcarePortfolioScore['grade'] {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
}

/**
 * Calculate trend by comparing to historical data
 */
async function calculateTrend(
  healthSystemId: string,
  currentScore: number
): Promise<"improving" | "stable" | "declining"> {
  // TODO: Query historical portfolio scores from last 30 days
  // For now, return stable
  return "stable";
}

/**
 * Return empty score for health systems with no AI systems
 */
function getEmptyScore(): HealthcarePortfolioScore {
  return {
    overall: 0,
    breakdown: {
      phiProtection: 0,
      clinicalSafety: 0,
      regulatoryCompliance: 0,
      operationalHealth: 0,
    },
    frameworkBreakdown: {
      hipaa: { score: 0, totalControls: 43, compliantControls: 0, violations: [], coveragePercentage: 0 },
      nist: { score: 0, totalControls: 18, compliantControls: 0, violations: [], coveragePercentage: 0 },
      fda: { score: 0, totalControls: 10, compliantControls: 0, violations: [], coveragePercentage: 0 },
      stateLaws: { score: 0, totalControls: 5, compliantControls: 0, violations: [], coveragePercentage: 0 },
    },
    criticalIssues: {
      phiViolations: 0,
      patientSafetyIncidents: 0,
      complianceViolations: 0,
      unresolvedAlerts: 0,
    },
    boardMetrics: {
      totalAISystems: 0,
      auditReady: false,
      averageResponseTimeMin: null,
      beaconTiers: { verified: 0, certified: 0, trusted: 0 },
    },
    grade: "F",
    trend: "stable",
    lastUpdated: new Date(),
  };
}
