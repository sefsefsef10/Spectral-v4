import { storage } from "../storage";
import type { AISystem, AITelemetryEvent } from "@shared/schema";

// Risk scoring weights for different event types
const RISK_WEIGHTS = {
  critical: 10,
  high: 5,
  medium: 2,
  low: 1,
};

// Time window for risk calculation (24 hours)
const RISK_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface RiskScore {
  aiSystemId: string;
  score: number; // 0-100
  riskLevel: "Low" | "Medium" | "High" | "Critical";
  status: "verified" | "drift" | "testing" | "critical";
  recommendation: string;
  factors: {
    criticalEvents: number;
    highEvents: number;
    mediumEvents: number;
    lowEvents: number;
    totalEvents: number;
  };
}

/**
 * Calculate risk score for an AI system based on recent telemetry events
 */
export async function calculateRiskScore(aiSystemId: string): Promise<RiskScore> {
  const aiSystem = await storage.getAISystem(aiSystemId);
  if (!aiSystem) {
    throw new Error(`AI system ${aiSystemId} not found`);
  }

  // Get telemetry events from the last 24 hours
  const allEvents = await storage.getAITelemetryEvents(aiSystemId);
  const now = new Date();
  const windowStart = new Date(now.getTime() - RISK_WINDOW_MS);
  
  const recentEvents = allEvents.filter(event => 
    event.createdAt && event.createdAt >= windowStart
  );

  // Count events by severity
  const factors = {
    criticalEvents: recentEvents.filter(e => e.severity === "critical").length,
    highEvents: recentEvents.filter(e => e.severity === "high").length,
    mediumEvents: recentEvents.filter(e => e.severity === "medium").length,
    lowEvents: recentEvents.filter(e => e.severity === "low").length,
    totalEvents: recentEvents.length,
  };

  // Calculate weighted score
  const weightedScore = 
    factors.criticalEvents * RISK_WEIGHTS.critical +
    factors.highEvents * RISK_WEIGHTS.high +
    factors.mediumEvents * RISK_WEIGHTS.medium +
    factors.lowEvents * RISK_WEIGHTS.low;

  // Normalize to 0-100 scale (cap at 100)
  // Assumption: 50+ points = high risk, 20-50 = medium risk
  const normalizedScore = Math.min(100, weightedScore);

  // Determine risk level and status
  let riskLevel: RiskScore["riskLevel"];
  let status: RiskScore["status"];
  let recommendation: string;

  if (normalizedScore >= 50 || factors.criticalEvents >= 3) {
    riskLevel = "Critical";
    status = "critical";
    recommendation = "Immediate action required. System shows critical compliance drift. Review telemetry events and implement corrective measures.";
  } else if (normalizedScore >= 20 || factors.criticalEvents >= 1 || factors.highEvents >= 3) {
    riskLevel = "High";
    status = "drift";
    recommendation = "High risk detected. System requires attention. Review recent alerts and investigate root causes.";
  } else if (normalizedScore >= 10 || factors.highEvents >= 1 || factors.mediumEvents >= 5) {
    riskLevel = "Medium";
    status = "drift";
    recommendation = "Moderate risk detected. Monitor closely and address medium-severity events.";
  } else if (normalizedScore > 0) {
    riskLevel = "Low";
    status = "verified";
    recommendation = "Low risk. System operating within acceptable parameters. Continue routine monitoring.";
  } else {
    riskLevel = "Low";
    status = "verified";
    recommendation = "No recent telemetry events. System appears stable. Ensure monitoring is properly configured.";
  }

  return {
    aiSystemId,
    score: normalizedScore,
    riskLevel,
    status,
    recommendation,
    factors,
  };
}

/**
 * Calculate risk scores for all AI systems in a health system
 */
export async function calculateHealthSystemRiskScores(healthSystemId: string): Promise<RiskScore[]> {
  const aiSystems = await storage.getAISystems(healthSystemId);
  const scores = await Promise.all(
    aiSystems.map(system => calculateRiskScore(system.id))
  );
  return scores;
}

/**
 * Update AI system risk level and status based on calculated risk score
 */
export async function updateAISystemRisk(aiSystemId: string): Promise<void> {
  const riskScore = await calculateRiskScore(aiSystemId);
  
  await storage.updateAISystem(aiSystemId, {
    riskLevel: riskScore.riskLevel,
    status: riskScore.status,
  });
}

/**
 * Batch update risk scores for all AI systems in a health system
 */
export async function updateHealthSystemRisks(healthSystemId: string): Promise<void> {
  const scores = await calculateHealthSystemRiskScores(healthSystemId);
  
  await Promise.all(
    scores.map(score => storage.updateAISystem(score.aiSystemId, {
      riskLevel: score.riskLevel,
      status: score.status,
    }))
  );
}
