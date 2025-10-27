/**
 * Telemetry Polling Workflow
 * 
 * Multi-platform scheduled polling for:
 * - LangSmith (LLM traces)
 * - Arize (Model monitoring)
 * - LangFuse (Open-source LLM observability)
 * - Weights & Biases (ML experiment tracking)
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

    // Step 2: Aggregate by platform
    const platformStats = await step.run("aggregate-stats", async () => {
      const stats: Record<string, { polled: number; successful: number; eventsIngested: number }> = {};

      for (const result of results) {
        if (!stats[result.platform]) {
          stats[result.platform] = { polled: 0, successful: 0, eventsIngested: 0 };
        }

        stats[result.platform].polled++;
        if (result.success) {
          stats[result.platform].successful++;
          stats[result.platform].eventsIngested += result.eventsIngested;
        }
      }

      logger.info({ platformStats: stats }, "Platform statistics");
      return stats;
    });

    return {
      systemsPolled: results.length,
      totalEventsIngested: results.reduce((sum, r) => sum + r.eventsIngested, 0),
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      platformStats,
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
        platform: pollResult.platform,
        eventsIngested: pollResult.eventsIngested,
        success: pollResult.success,
      }, "On-demand telemetry polling complete");
      
      return pollResult;
    });

    return {
      aiSystemId,
      platform: result.platform,
      ...result,
    };
  }
);
