/**
 * Framework-Specific Compliance Scoring Service
 * 
 * CRITICAL COMPONENT (Gap Severity: 85/100)
 * Translation Layer visibility - shows which specific HIPAA/NIST/FDA controls are violated
 * 
 * This service breaks down compliance scores by framework:
 * - HIPAA: 43 controls (company specification)
 * - NIST AI RMF: 18 controls (company specification)
 * - FDA SaMD Guidelines
 * - State Laws (CA SB1047, CO AI Act, NYC LL144)
 * 
 * Weight in overall score: 25% (regulatory compliance component)
 */

import { db } from "../../db";
import { complianceControls, complianceMappings } from "../../../shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { storage } from "../../storage";
import { logger } from "../../logger";
import { validateTelemetry, getDataQuality, logScoringAudit } from "./telemetry-validator";

export interface FrameworkComplianceScore {
  framework: 'HIPAA' | 'NIST_AI_RMF' | 'FDA' | 'ISO_42001' | 'STATE_LAWS';
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  totalControls: number;
  compliantControls: number;
  nonCompliantControls: number;
  violations: Array<{
    controlId: string;
    controlName: string;
    severity: "low" | "medium" | "high" | "critical";
    requiresAction: boolean;
  }>;
  auditReadiness: "ready" | "needs_review" | "not_ready";
}

export interface ComplianceBreakdown {
  overall: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  frameworks: {
    hipaa: FrameworkComplianceScore;
    nist: FrameworkComplianceScore;
    fda: FrameworkComplianceScore;
    iso42001: FrameworkComplianceScore;
    stateLaws: FrameworkComplianceScore;
  };
  criticalViolations: number;
  auditReadiness: {
    ready: boolean;
    missingEvidence: number;
    reviewRequired: number;
  };
  recommendations: string[];
}

// Framework weights for overall compliance score
const FRAMEWORK_WEIGHTS = {
  HIPAA: 0.35,        // 35% - Most critical for healthcare
  NIST_AI_RMF: 0.25,  // 25% - AI-specific governance
  FDA: 0.20,          // 20% - Medical device compliance
  ISO_42001: 0.15,    // 15% - AI management system
  STATE_LAWS: 0.05,   // 5% - State-specific requirements
};

/**
 * Calculate compliance score for a specific framework
 */
export async function calculateFrameworkCompliance(
  aiSystemId: string,
  framework: 'HIPAA' | 'NIST_AI_RMF' | 'FDA' | 'ISO_42001' | 'STATE_LAWS'
): Promise<FrameworkComplianceScore> {
  try {
    // Get all controls for this framework
    const controls = await db
      .select()
      .from(complianceControls)
      .where(eq(complianceControls.framework, framework));

    if (controls.length === 0) {
      logger.warn({ framework }, "No controls found for framework");
      return {
        framework,
        score: 0,
        grade: "F",
        totalControls: 0,
        compliantControls: 0,
        nonCompliantControls: 0,
        violations: [],
        auditReadiness: "not_ready",
      };
    }

    // Get compliance mappings for this system
    const mappings = await db
      .select()
      .from(complianceMappings)
      .where(eq(complianceMappings.aiSystemId, aiSystemId));

    // Filter mappings for this framework's controls
    const controlIds = controls.map(c => c.id);
    const frameworkMappings = mappings.filter(m => controlIds.includes(m.controlId));

    // Calculate compliance metrics
    const totalControls = controls.length;
    const compliantControls = frameworkMappings.filter(m => m.status === 'compliant').length;
    const nonCompliantControls = frameworkMappings.filter(m => m.status === 'non_compliant').length;

    // Calculate score (percentage of controls that are compliant)
    const score = totalControls > 0 ? Math.round((compliantControls / totalControls) * 100) : 0;

    // Get specific violations
    const violations = frameworkMappings
      .filter(m => m.status === 'non_compliant')
      .map(m => {
        const control = controls.find(c => c.id === m.controlId);
        
        // Determine severity based on control type
        let severity: "low" | "medium" | "high" | "critical" = "medium";
        if (control?.controlId.includes('312(e)')) severity = "critical"; // Encryption
        else if (control?.controlId.includes('164.308(a)')) severity = "high"; // Security Management
        else if (control?.controlId.includes('GOVERN')) severity = "high"; // NIST Governance
        else if (control?.controlId.includes('MAP')) severity = "medium"; // NIST Mapping
        
        return {
          controlId: control?.controlId || 'Unknown',
          controlName: control?.controlName || 'Unknown Control',
          severity,
          requiresAction: severity === "critical" || severity === "high",
        };
      });

    // Generate grade
    let grade: "A" | "B" | "C" | "D" | "F";
    if (score >= 90) grade = "A";
    else if (score >= 80) grade = "B";
    else if (score >= 70) grade = "C";
    else if (score >= 60) grade = "D";
    else grade = "F";

    // Determine audit readiness
    let auditReadiness: "ready" | "needs_review" | "not_ready";
    if (score >= 95 && nonCompliantControls === 0) auditReadiness = "ready";
    else if (score >= 80 && nonCompliantControls < 3) auditReadiness = "needs_review";
    else auditReadiness = "not_ready";

    return {
      framework,
      score,
      grade,
      totalControls,
      compliantControls,
      nonCompliantControls,
      violations,
      auditReadiness,
    };
  } catch (error) {
    logger.error({ error, aiSystemId, framework }, "Failed to calculate framework compliance");
    throw error;
  }
}

/**
 * Calculate comprehensive compliance breakdown across all frameworks
 */
export async function calculateComplianceBreakdown(aiSystemId: string): Promise<ComplianceBreakdown> {
  try {
    // Validate telemetry data freshness for compliance scoring
    const allEvents = await storage.getAITelemetryEvents(aiSystemId);
    const validation = validateTelemetry(allEvents, 'compliance');
    const dataQuality = getDataQuality(validation);
    
    // Log warnings
    if (validation.warnings.length > 0) {
      logger.warn({ 
        aiSystemId, 
        warnings: validation.warnings,
        telemetryAge: `${Math.round(validation.age)}h`,
        eventCount: validation.eventCount
      }, 'Compliance scoring: data quality warnings');
    }
    
    // For compliance, we log errors but don't short-circuit since compliance mappings
    // are stored in database (not derived from telemetry). However, stale telemetry
    // indicates the system may not be actively monitored.
    if (validation.errors.length > 0) {
      logger.error({ 
        aiSystemId, 
        errors: validation.errors,
        telemetryAge: `${Math.round(validation.age)}h`,
        eventCount: validation.eventCount
      }, 'Compliance scoring: telemetry validation errors - compliance data may be stale');
    }
    
    // Calculate scores for each framework in parallel
    const [hipaa, nist, fda, iso42001, stateLaws] = await Promise.all([
      calculateFrameworkCompliance(aiSystemId, 'HIPAA'),
      calculateFrameworkCompliance(aiSystemId, 'NIST_AI_RMF'),
      calculateFrameworkCompliance(aiSystemId, 'FDA'),
      calculateFrameworkCompliance(aiSystemId, 'ISO_42001'),
      calculateFrameworkCompliance(aiSystemId, 'STATE_LAWS'),
    ]);

    // Calculate weighted overall score
    const overall = Math.round(
      hipaa.score * FRAMEWORK_WEIGHTS.HIPAA +
      nist.score * FRAMEWORK_WEIGHTS.NIST_AI_RMF +
      fda.score * FRAMEWORK_WEIGHTS.FDA +
      iso42001.score * FRAMEWORK_WEIGHTS.ISO_42001 +
      stateLaws.score * FRAMEWORK_WEIGHTS.STATE_LAWS
    );

    // Overall grade
    let grade: "A" | "B" | "C" | "D" | "F";
    if (overall >= 90) grade = "A";
    else if (overall >= 80) grade = "B";
    else if (overall >= 70) grade = "C";
    else if (overall >= 60) grade = "D";
    else grade = "F";

    // Count critical violations across all frameworks
    const allViolations = [
      ...hipaa.violations,
      ...nist.violations,
      ...fda.violations,
      ...iso42001.violations,
      ...stateLaws.violations,
    ];
    const criticalViolations = allViolations.filter(v => v.severity === "critical").length;

    // Audit readiness assessment
    const auditReadiness = {
      ready: [hipaa, nist, fda, iso42001].every(f => f.auditReadiness === "ready"),
      missingEvidence: 0, // Will be enhanced in Phase 2
      reviewRequired: allViolations.filter(v => v.requiresAction).length,
    };

    // Generate recommendations
    const recommendations: string[] = [];
    if (criticalViolations > 0) {
      recommendations.push(`URGENT: Address ${criticalViolations} critical compliance violations`);
    }
    if (hipaa.score < 80) {
      recommendations.push(`HIPAA compliance below 80% (${hipaa.score}%) - immediate review required`);
    }
    if (nist.score < 70) {
      recommendations.push(`NIST AI RMF compliance needs improvement (${nist.score}%)`);
    }
    if (!auditReadiness.ready) {
      recommendations.push(`System not audit-ready - ${auditReadiness.reviewRequired} controls need review`);
    }
    if (allViolations.some(v => v.controlId.includes('164.312(e)'))) {
      recommendations.push('Critical: PHI encryption controls violated - enable encryption immediately');
    }

    // Log audit trail for acquisition due diligence
    logScoringAudit({
      timestamp: new Date(),
      aiSystemId,
      scoringType: 'compliance',
      telemetryAge: validation.age,
      eventCount: validation.eventCount,
      score: overall,
      dataQuality,
      warnings: validation.warnings.concat(validation.errors),
    });

    return {
      overall,
      grade,
      frameworks: {
        hipaa,
        nist,
        fda,
        iso42001,
        stateLaws,
      },
      criticalViolations,
      auditReadiness,
      recommendations,
    };
  } catch (error) {
    logger.error({ error, aiSystemId }, "Failed to calculate compliance breakdown");
    throw error;
  }
}

/**
 * Calculate portfolio-wide compliance across all frameworks
 */
export async function calculatePortfolioCompliance(healthSystemId: string): Promise<{
  overall: number;
  grade: "A" | "B" | "C" | "D" | "F";
  frameworkScores: {
    hipaa: number;
    nist: number;
    fda: number;
    iso42001: number;
    stateLaws: number;
  };
  systemCount: number;
  compliantSystems: number;
  criticalViolations: number;
  auditReady: boolean;
}> {
  try {
    const systems = await storage.getAISystems(healthSystemId);

    if (systems.length === 0) {
      return {
        overall: 100,
        grade: "A",
        frameworkScores: {
          hipaa: 100,
          nist: 100,
          fda: 100,
          iso42001: 100,
          stateLaws: 100,
        },
        systemCount: 0,
        compliantSystems: 0,
        criticalViolations: 0,
        auditReady: true,
      };
    }

    // Calculate breakdown for each system
    const breakdowns = await Promise.all(
      systems.map((sys: any) => calculateComplianceBreakdown(sys.id))
    );

    // Average scores across all systems for each framework
    const frameworkScores = {
      hipaa: Math.round(breakdowns.reduce((sum: number, b: any) => sum + b.frameworks.hipaa.score, 0) / breakdowns.length),
      nist: Math.round(breakdowns.reduce((sum: number, b: any) => sum + b.frameworks.nist.score, 0) / breakdowns.length),
      fda: Math.round(breakdowns.reduce((sum: number, b: any) => sum + b.frameworks.fda.score, 0) / breakdowns.length),
      iso42001: Math.round(breakdowns.reduce((sum: number, b: any) => sum + b.frameworks.iso42001.score, 0) / breakdowns.length),
      stateLaws: Math.round(breakdowns.reduce((sum: number, b: any) => sum + b.frameworks.stateLaws.score, 0) / breakdowns.length),
    };

    // Overall portfolio compliance (weighted average)
    const overall = Math.round(breakdowns.reduce((sum: number, b: any) => sum + b.overall, 0) / breakdowns.length);

    // Grade
    let grade: "A" | "B" | "C" | "D" | "F";
    if (overall >= 90) grade = "A";
    else if (overall >= 80) grade = "B";
    else if (overall >= 70) grade = "C";
    else if (overall >= 60) grade = "D";
    else grade = "F";

    // Count systems with >80% compliance
    const compliantSystems = breakdowns.filter((b: any) => b.overall >= 80).length;

    // Count total critical violations
    const criticalViolations = breakdowns.reduce((sum: number, b: any) => sum + b.criticalViolations, 0);

    // Portfolio is audit-ready if all systems are audit-ready
    const auditReady = breakdowns.every((b: any) => b.auditReadiness.ready);

    return {
      overall,
      grade,
      frameworkScores,
      systemCount: systems.length,
      compliantSystems,
      criticalViolations,
      auditReady,
    };
  } catch (error) {
    logger.error({ error, healthSystemId }, "Failed to calculate portfolio compliance");
    throw error;
  }
}

export const frameworkComplianceScoringService = {
  calculateFrameworkCompliance,
  calculateComplianceBreakdown,
  calculatePortfolioCompliance,
};
