import { logger } from "../logger";
import { db } from "../db";
import { predictiveAlerts, aiSystems } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { trendAnalysisService } from "./trend-analysis-service";
import type { InsertPredictiveAlert } from "@shared/schema";

export class PredictiveAlertService {
  /**
   * Generate predictive alerts for a specific AI system
   */
  async generatePredictiveAlerts(aiSystemId: string): Promise<number> {
    try {
      // Analyze trends for this system
      const trends = await trendAnalysisService.analyzeSystemTrends(aiSystemId, 14);

      let alertsGenerated = 0;

      for (const trend of trends) {
        // Only create alerts for metrics that will cross thresholds
        if (!trend.willCrossThreshold) {
          continue;
        }

        // Skip if confidence is too low
        if (trend.confidenceScore < 40) {
          continue;
        }

        // Check if we already have an active prediction for this metric
        const existingAlerts = await db
          .select()
          .from(predictiveAlerts)
          .where(
            and(
              eq(predictiveAlerts.aiSystemId, aiSystemId),
              eq(predictiveAlerts.metric, trend.metric),
              eq(predictiveAlerts.dismissed, false)
            )
          );

        // If already exists, skip (avoid duplicates)
        if (existingAlerts.length > 0) {
          continue;
        }

        // Calculate severity based on time until crossing
        const now = new Date();
        const daysUntilCrossing = Math.max(
          0,
          (trend.predictedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        const severity = trendAnalysisService.mapPredictionToSeverity(
          daysUntilCrossing,
          trend.metric
        );

        const predictionType = trendAnalysisService.mapMetricToPredictionType(trend.metric);

        // Create predictive alert
        const newAlert: InsertPredictiveAlert = {
          aiSystemId,
          predictionType,
          metric: trend.metric,
          currentValue: trend.currentValue.toString(),
          predictedValue: trend.predictedValue.toString(),
          threshold: trend.threshold.toString(),
          predictedDate: trend.predictedDate,
          confidenceScore: trend.confidenceScore,
          trendDirection: trend.trendDirection,
          trendVelocity: trend.trendVelocity.toFixed(6),
          datapointsAnalyzed: trend.datapointsAnalyzed,
          severity,
          dismissed: false,
        };

        await db.insert(predictiveAlerts).values(newAlert);
        alertsGenerated++;
      }

      return alertsGenerated;
    } catch (error) {
      logger.error({ err: error, aiSystemId }, `Error generating predictive alerts for system ${aiSystemId}`);
      return 0;
    }
  }

  /**
   * Generate predictive alerts for all AI systems in a health system
   */
  async generatePredictiveAlertsForHealthSystem(healthSystemId: string): Promise<number> {
    try {
      // Get all AI systems for this health system
      const systems = await db
        .select()
        .from(aiSystems)
        .where(eq(aiSystems.healthSystemId, healthSystemId));

      let totalAlerts = 0;

      for (const system of systems) {
        const alerts = await this.generatePredictiveAlerts(system.id);
        totalAlerts += alerts;
      }

      logger.info({ healthSystemId, totalAlerts }, `Generated ${totalAlerts} predictive alerts for health system ${healthSystemId}`);

      return totalAlerts;
    } catch (error) {
      logger.error({ err: error, healthSystemId }, `Error generating predictive alerts for health system ${healthSystemId}`);
      return 0;
    }
  }

  /**
   * Dismiss a predictive alert
   */
  async dismissAlert(alertId: string): Promise<boolean> {
    try {
      await db
        .update(predictiveAlerts)
        .set({ dismissed: true })
        .where(eq(predictiveAlerts.id, alertId));

      return true;
    } catch (error) {
      logger.error({ err: error, alertId }, `Error dismissing alert ${alertId}`);
      return false;
    }
  }

  /**
   * Mark a prediction as actualized (it happened)
   */
  async actualizeAlert(alertId: string): Promise<boolean> {
    try {
      await db
        .update(predictiveAlerts)
        .set({ actualizedAt: new Date() })
        .where(eq(predictiveAlerts.id, alertId));

      return true;
    } catch (error) {
      logger.error({ err: error, alertId }, `Error actualizing alert ${alertId}`);
      return false;
    }
  }

  /**
   * Get active predictive alerts for an AI system
   */
  async getActiveAlerts(aiSystemId: string) {
    try {
      return await db
        .select()
        .from(predictiveAlerts)
        .where(
          and(
            eq(predictiveAlerts.aiSystemId, aiSystemId),
            eq(predictiveAlerts.dismissed, false)
          )
        );
    } catch (error) {
      logger.error({ err: error, aiSystemId }, `Error fetching alerts for system ${aiSystemId}`);
      return [];
    }
  }

  /**
   * Get predictive alerts for a health system
   */
  async getAlertsForHealthSystem(healthSystemId: string) {
    try {
      // First get all AI systems for this health system
      const systems = await db
        .select()
        .from(aiSystems)
        .where(eq(aiSystems.healthSystemId, healthSystemId));

      const systemIds = systems.map(s => s.id);

      if (systemIds.length === 0) {
        return [];
      }

      // Get all active predictive alerts for these systems
      const alerts = [];
      for (const systemId of systemIds) {
        const systemAlerts = await this.getActiveAlerts(systemId);
        alerts.push(...systemAlerts);
      }

      return alerts;
    } catch (error) {
      logger.error({ err: error, healthSystemId }, `Error fetching alerts for health system ${healthSystemId}`);
      return [];
    }
  }

  /**
   * Clean up old actualized or dismissed alerts
   */
  async cleanupOldAlerts(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // This would require a delete query with OR conditions
      // For now, just log that cleanup is needed
      logger.info({ daysOld }, `Cleanup of alerts older than ${daysOld} days would happen here`);
      
      return 0;
    } catch (error) {
      logger.error({ err: error }, "Error cleaning up old alerts");
      return 0;
    }
  }
}

export const predictiveAlertService = new PredictiveAlertService();
