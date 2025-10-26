/**
 * Telemetry Validation Service
 * 
 * CRITICAL FOR ACQUISITION DUE DILIGENCE
 * Ensures scoring data is fresh and complete to prevent artificially inflated grades.
 * 
 * Validates:
 * - Telemetry data exists and is recent (< 7 days stale)
 * - Minimum event thresholds met for statistical validity
 * - No duplicate severity weighting
 * - Audit logging for all score calculations
 */

import { logger } from "../../logger";

export interface TelemetryValidationResult {
  isValid: boolean;
  isFresh: boolean;
  age: number; // Age of most recent telemetry in hours
  eventCount: number;
  warnings: string[];
  errors: string[];
}

export interface ScoringAuditLog {
  timestamp: Date;
  healthSystemId?: string;
  aiSystemId?: string;
  scoringType: string; // 'phi-risk' | 'clinical-safety' | 'compliance' | 'operational'
  telemetryAge: number; // hours
  eventCount: number;
  score: number;
  dataQuality: 'fresh' | 'stale' | 'missing';
  warnings: string[];
}

// Data freshness thresholds
const TELEMETRY_FRESHNESS = {
  FRESH: 24 * 60 * 60 * 1000,        // 24 hours
  ACCEPTABLE: 7 * 24 * 60 * 60 * 1000, // 7 days
  STALE: 30 * 24 * 60 * 60 * 1000,   // 30 days
};

// Minimum event thresholds for statistical validity
const MIN_EVENTS = {
  PHI_RISK: 5,         // Need at least 5 events for PHI scoring
  CLINICAL_SAFETY: 10, // Need at least 10 events for clinical safety
  COMPLIANCE: 3,       // Need at least 3 events for compliance
};

/**
 * Validate telemetry data freshness and completeness
 */
export function validateTelemetry(
  events: any[],
  scoringType: 'phi-risk' | 'clinical-safety' | 'compliance' | 'operational'
): TelemetryValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  let isValid = true;
  let isFresh = true;

  // Check if we have any events
  if (events.length === 0) {
    errors.push('No telemetry events found');
    return {
      isValid: false,
      isFresh: false,
      age: Infinity,
      eventCount: 0,
      warnings: [],
      errors,
    };
  }

  // Find most recent event
  const mostRecentEvent = events.reduce((latest: any, event: any) => {
    const eventTime = new Date(event.timestamp).getTime();
    const latestTime = latest ? new Date(latest.timestamp).getTime() : 0;
    return eventTime > latestTime ? event : latest;
  }, null);

  const mostRecentTime = mostRecentEvent ? new Date(mostRecentEvent.timestamp).getTime() : 0;
  const age = (Date.now() - mostRecentTime) / (60 * 60 * 1000); // in hours
  const ageInDays = Math.round(age / 24);

  // Check data freshness
  const ageInMs = Date.now() - mostRecentTime;
  if (ageInMs > TELEMETRY_FRESHNESS.STALE) {
    errors.push(`Telemetry is stale (${ageInDays} days old) - scores may be inaccurate`);
    isValid = false;
    isFresh = false;
  } else if (ageInMs > TELEMETRY_FRESHNESS.ACCEPTABLE) {
    warnings.push(`Telemetry is aging (${ageInDays} days old) - recommend data refresh`);
    isFresh = false;
  } else if (ageInMs > TELEMETRY_FRESHNESS.FRESH) {
    warnings.push(`Telemetry is ${Math.round(age)} hours old`);
    isFresh = false;
  }

  // Check minimum event thresholds
  const minThreshold = scoringType === 'phi-risk' ? MIN_EVENTS.PHI_RISK :
                      scoringType === 'clinical-safety' ? MIN_EVENTS.CLINICAL_SAFETY :
                      scoringType === 'compliance' ? MIN_EVENTS.COMPLIANCE : 1;

  if (events.length < minThreshold) {
    warnings.push(
      `Insufficient events (${events.length} < ${minThreshold}) - ` +
      `statistical validity may be compromised`
    );
  }

  // Check for duplicate event IDs (prevents double-counting severity)
  const eventIds = events.map((e: any) => e.id).filter(Boolean);
  const uniqueEventIds = new Set(eventIds);
  if (eventIds.length !== uniqueEventIds.size) {
    const duplicateCount = eventIds.length - uniqueEventIds.size;
    errors.push(`Found ${duplicateCount} duplicate events - severity may be inflated`);
    isValid = false;
  }

  return {
    isValid,
    isFresh,
    age,
    eventCount: events.length,
    warnings,
    errors,
  };
}

/**
 * Log scoring audit trail with telemetry quality metadata
 */
export function logScoringAudit(audit: ScoringAuditLog): void {
  logger.info({
    scoringAudit: {
      timestamp: audit.timestamp.toISOString(),
      healthSystemId: audit.healthSystemId,
      aiSystemId: audit.aiSystemId,
      scoringType: audit.scoringType,
      score: audit.score,
      telemetryAge: `${Math.round(audit.telemetryAge)}h`,
      eventCount: audit.eventCount,
      dataQuality: audit.dataQuality,
      warnings: audit.warnings,
    }
  }, `Scoring calculation: ${audit.scoringType} = ${audit.score}`);
}

/**
 * Determine data quality level based on validation result
 */
export function getDataQuality(validation: TelemetryValidationResult): 'fresh' | 'stale' | 'missing' {
  if (!validation.isValid || validation.eventCount === 0) return 'missing';
  if (!validation.isFresh) return 'stale';
  return 'fresh';
}

/**
 * Calculate confidence modifier based on data quality
 * Returns a multiplier (0.0 - 1.0) to apply to the score
 */
export function getConfidenceModifier(dataQuality: 'fresh' | 'stale' | 'missing'): number {
  switch (dataQuality) {
    case 'fresh': return 1.0;   // 100% confidence
    case 'stale': return 0.85;  // 85% confidence - penalize stale data
    case 'missing': return 0.5; // 50% confidence - significant penalty
  }
}
