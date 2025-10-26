/**
 * Telemetry Polling Workflow
 * 
 * Scheduled job to poll LangSmith API for AI telemetry data
 * Complements webhook-based ingestion with active polling
 */

import { inngest } from "../client";
import { logger } from "../../logger";

/**
 * Scheduled telemetry polling (every 15 minutes)
 */
export const telemetryPollingJob = inngest.createFunction(
  {
    id: "telemetry-polling-job",
    retries: 2,
  },
  { cron: "*/15 * * * *" }, // Every 15 minutes
  async ({ step }) => {
    // Step 1: Poll all registered AI systems
    const results = await step.run("poll-all-systems", async () => {
      const { telemetryPoller } = await import("../../services/telemetry-poller");
      const pollResults = await telemetryPoller.pollAll();
      
      logger.info({
        systemsPolled: pollResults.length,
        totalEventsIngested: pollResults.reduce((sum, r) => sum + r.eventsIngested, 0),
        successCount: pollResults.filter(r => r.success).length,
        failureCount: pollResults.filter(r => !r.success).length,
      }, "Telemetry polling complete");
      
      return pollResults;
    });

    return {
      systemsPolled: results.length,
      totalEventsIngested: results.reduce((sum, r) => sum + r.eventsIngested, 0),
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      results,
    };
  }
);

/**
 * On-demand telemetry polling for a specific AI system
 */
export const telemetryPollingOnDemand = inngest.createFunction(
  {
    id: "telemetry-polling-on-demand",
    retries: 2,
  },
  { event: "telemetry/poll.trigger" },
  async ({ event, step }) => {
    const { aiSystemId } = event.data;

    const result = await step.run("poll-system", async () => {
      const { telemetryPoller } = await import("../../services/telemetry-poller");
      const pollResult = await telemetryPoller.pollSystem(aiSystemId);
      
      logger.info({
        aiSystemId,
        eventsIngested: pollResult.eventsIngested,
        success: pollResult.success,
      }, "On-demand telemetry polling complete");
      
      return pollResult;
    });

    return result;
  }
);
