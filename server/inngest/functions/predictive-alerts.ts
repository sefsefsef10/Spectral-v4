import { inngest } from "../client";
import { logger } from "../../logger";

/**
 * Scheduled function to generate predictive alerts for health systems
 * Runs hourly via cron
 */
export const predictiveAlertsJob = inngest.createFunction(
  {
    id: "predictive-alerts-hourly",
    retries: 2,
  },
  { cron: "0 * * * *" }, // Every hour at minute 0
  async ({ step }) => {
    // Step 1: Get all active health systems
    const healthSystems = await step.run("get-health-systems", async () => {
      // For now, generate for demo health system
      // In production, loop through all active health systems
      return [{ id: "demo-health-system-001", name: "Demo Health System" }];
    });

    // Step 2: Generate alerts for each health system (parallel)
    const results = await Promise.all(
      healthSystems.map((hs) =>
        step.run(`generate-alerts-${hs.id}`, async () => {
          try {
            const { predictiveAlertService } = await import("../../services/predictive-alert-service");
            const alertCount = await predictiveAlertService.generatePredictiveAlertsForHealthSystem(hs.id);
            logger.info(
              { healthSystemId: hs.id, alertCount },
              "Generated predictive alerts"
            );
            return { healthSystemId: hs.id, alertCount };
          } catch (error) {
            logger.error(
              { err: error, healthSystemId: hs.id },
              "Failed to generate predictive alerts"
            );
            return { healthSystemId: hs.id, alertCount: 0, error: String(error) };
          }
        })
      )
    );

    return {
      processedHealthSystems: results.length,
      totalAlerts: results.reduce((sum, r) => sum + r.alertCount, 0),
      results,
    };
  }
);

/**
 * On-demand predictive alert generation
 */
export const predictiveAlertsOnDemand = inngest.createFunction(
  {
    id: "predictive-alerts-on-demand",
    retries: 2,
  },
  { event: "alerts/predictive.generate" },
  async ({ event, step }) => {
    const { healthSystemId } = event.data;

    const alertCount = await step.run("generate-alerts", async () => {
      const { predictiveAlertService } = await import("../../services/predictive-alert-service");
      const count = await predictiveAlertService.generatePredictiveAlertsForHealthSystem(healthSystemId);
      logger.info(
        { healthSystemId, alertCount: count },
        "Generated predictive alerts on-demand"
      );
      return count;
    });

    return {
      healthSystemId,
      alertCount,
    };
  }
);
