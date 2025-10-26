import { inngest } from "../client";
import { logger } from "../../logger";

/**
 * Scheduled automated action executor
 * Runs every 5 minutes to execute pending automated actions
 */
export const automatedActionExecutor = inngest.createFunction(
  {
    id: "automated-action-executor",
    retries: 2,
  },
  { cron: "*/5 * * * *" }, // Every 5 minutes
  async ({ step }) => {
    // Step 1: Get pending automated actions
    const pendingActions = await step.run("get-pending-actions", async () => {
      const { storage } = await import("../../storage");
      const actions = await storage.getAllPendingActions();
      logger.info({ count: actions.length }, "Found pending automated actions");
      return actions;
    });

    if (pendingActions.length === 0) {
      return { executedActions: 0, results: [] };
    }

    // Step 2: Execute actions in parallel (with concurrency limit)
    const batchSize = 5; // Execute 5 actions at a time
    const results = [];

    for (let i = 0; i < pendingActions.length; i += batchSize) {
      const batch = pendingActions.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map((action) =>
          step.run(`execute-action-${action.id}`, async () => {
            try {
              const { executeAutomatedAction } = await import("../../services/action-executor");
              await executeAutomatedAction(action.id);
              logger.info({ actionId: action.id }, "Executed automated action");
              return { actionId: action.id, success: true };
            } catch (error) {
              logger.error(
                { err: error, actionId: action.id },
                "Failed to execute automated action"
              );
              return { actionId: action.id, success: false, error: String(error) };
            }
          })
        )
      );

      results.push(...batchResults);

      // Optional: Add delay between batches to avoid rate limits
      if (i + batchSize < pendingActions.length) {
        await step.sleep("batch-delay", "2s");
      }
    }

    return {
      executedActions: results.length,
      successCount: results.filter((r) => r.success).length,
      failureCount: results.filter((r) => !r.success).length,
      results,
    };
  }
);
