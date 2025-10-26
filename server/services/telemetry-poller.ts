/**
 * Telemetry Polling Service
 * 
 * Complements webhook-based telemetry with active polling
 * Useful for:
 * - Backfilling data
 * - Verifying webhook delivery
 * - Fallback when webhooks fail
 * - On-demand metrics retrieval
 * 
 * PRODUCTION-READY: Database-backed persistence with deduplication
 */

import { logger } from '../logger';
import { storage } from '../storage';
import { LangSmithClient, createLangSmithClient } from './langsmith-client';
import type { TelemetryPollingConfig, InsertTelemetryPollingConfig } from '@shared/schema';

export interface PollingResult {
  aiSystemId: string;
  eventsIngested: number;
  errorsDetected: number;
  latencyMs: number;
  polledAt: Date;
  success: boolean;
  error?: string;
}

export class TelemetryPoller {
  private langSmithClient: LangSmithClient | null;

  constructor() {
    this.langSmithClient = createLangSmithClient();
  }

  /**
   * Register an AI system for polling (database-backed)
   */
  async registerAISystem(config: InsertTelemetryPollingConfig): Promise<TelemetryPollingConfig> {
    const existing = await storage.getPollingConfig(config.aiSystemId);
    
    if (existing) {
      // Update existing config
      await storage.updatePollingConfig(config.aiSystemId, config);
      logger.info({ config }, 'Updated AI system polling configuration');
      return storage.getPollingConfig(config.aiSystemId) as Promise<TelemetryPollingConfig>;
    } else {
      // Create new config
      const created = await storage.createPollingConfig(config);
      logger.info({ config }, 'Registered AI system for telemetry polling');
      return created;
    }
  }

  /**
   * Unregister an AI system from polling (database-backed)
   */
  async unregisterAISystem(aiSystemId: string): Promise<void> {
    await storage.deletePollingConfig(aiSystemId);
    logger.info({ aiSystemId }, 'Unregistered AI system from polling');
  }

  /**
   * Poll telemetry for a specific AI system
   */
  async pollSystem(aiSystemId: string): Promise<PollingResult> {
    const config = await storage.getPollingConfig(aiSystemId);
    
    if (!config) {
      throw new Error(`No polling config found for AI system ${aiSystemId}`);
    }

    if (!config.enabled) {
      logger.debug({ aiSystemId }, 'Polling disabled for AI system');
      return {
        aiSystemId,
        eventsIngested: 0,
        errorsDetected: 0,
        latencyMs: 0,
        polledAt: new Date(),
        success: true,
      };
    }

    if (!this.langSmithClient) {
      logger.warn({ aiSystemId }, 'LangSmith client not configured - skipping poll');
      
      await storage.updatePollingStatus(aiSystemId, {
        lastPolledAt: new Date(),
        lastPollStatus: 'failed',
        lastPollEventsIngested: 0,
        lastPollError: 'LangSmith client not configured',
      });
      
      return {
        aiSystemId,
        eventsIngested: 0,
        errorsDetected: 0,
        latencyMs: 0,
        polledAt: new Date(),
        success: false,
        error: 'LangSmith client not configured',
      };
    }

    const startTime = Date.now();

    try {
      logger.info({ aiSystemId, projectName: config.projectName }, 'Polling LangSmith telemetry');

      // Fetch metrics from LangSmith
      const metrics = await this.langSmithClient.pollMetrics(
        config.projectName,
        config.lookbackMinutes
      );

      // Convert LangSmith runs to our telemetry events
      const events = metrics.runs.map(run => {
        const payload = {
          run_id: run.id,
          trace_id: run.trace_id,
          name: run.name,
          run_type: run.run_type,
          inputs: run.inputs,
          outputs: run.outputs,
          error: run.error,
          start_time: run.start_time,
          end_time: run.end_time,
          tags: run.tags,
          metadata: run.metadata,
          feedback_stats: run.feedback_stats,
          polled: true,
          polling_timestamp: new Date().toISOString(),
          project_name: config.projectName,
        };

        return {
          aiSystemId,
          eventType: run.run_type === 'llm' ? 'run' : 'other',
          source: 'langsmith',
          runId: run.id, // Deduplicated by unique index on (aiSystemId, source, runId)
          ruleId: null,
          severity: run.error ? 'high' : null,
          metric: run.error ? 'error_count' : 'run_count',
          metricValue: '1',
          threshold: null,
          encryptedPayload: JSON.stringify(payload), // Will be encrypted by storage layer
          phiRedacted: false,
          phiEntitiesDetected: 0,
          processedAt: new Date(),
        };
      });

      // Store events in database with deduplication
      let eventsIngested = 0;
      for (const event of events) {
        try {
          await storage.createAITelemetryEvent(event);
          eventsIngested++;
        } catch (error) {
          // Log but continue (likely duplicate due to unique index on runId)
          logger.debug({ err: error, runId: event.runId }, 'Failed to store telemetry event (likely duplicate)');
        }
      }

      const latencyMs = Date.now() - startTime;

      logger.info({
        aiSystemId,
        eventsIngested,
        totalRuns: metrics.totalRuns,
        errorRate: `${metrics.errorRate.toFixed(2)}%`,
        latencyMs,
      }, 'Telemetry polling complete');

      // Update polling status in database
      await storage.updatePollingStatus(aiSystemId, {
        lastPolledAt: new Date(),
        lastPollStatus: 'success',
        lastPollEventsIngested: eventsIngested,
        lastPollError: null,
      });

      return {
        aiSystemId,
        eventsIngested,
        errorsDetected: Math.round((metrics.errorRate / 100) * metrics.totalRuns),
        latencyMs,
        polledAt: new Date(),
        success: true,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error({ err: error, aiSystemId }, 'Telemetry polling failed');
      
      // Update polling status in database
      await storage.updatePollingStatus(aiSystemId, {
        lastPolledAt: new Date(),
        lastPollStatus: 'failed',
        lastPollEventsIngested: 0,
        lastPollError: errorMessage,
      });
      
      return {
        aiSystemId,
        eventsIngested: 0,
        errorsDetected: 0,
        latencyMs,
        polledAt: new Date(),
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Poll all enabled AI systems (database-backed)
   * Respects configured poll intervals - only polls systems that are due
   */
  async pollAll(): Promise<PollingResult[]> {
    const results: PollingResult[] = [];
    
    // Fetch all enabled polling configs from database
    const configs = await storage.getAllPollingConfigs(true);
    
    logger.info({ count: configs.length }, 'Checking polling schedule for enabled AI systems');
    
    const now = new Date();
    let polledCount = 0;
    let skippedCount = 0;
    
    for (const config of configs) {
      // Check if system is due for polling based on configured interval
      const isDue = this.isPollingDue(config, now);
      
      if (!isDue) {
        skippedCount++;
        logger.debug({ 
          aiSystemId: config.aiSystemId,
          pollIntervalMinutes: config.pollIntervalMinutes,
          lastPolledAt: config.lastPolledAt,
          nextPollDue: config.lastPolledAt 
            ? new Date(config.lastPolledAt.getTime() + config.pollIntervalMinutes * 60 * 1000)
            : 'never',
        }, 'Skipping poll - not due yet');
        continue;
      }
      
      try {
        const result = await this.pollSystem(config.aiSystemId);
        results.push(result);
        polledCount++;
      } catch (error) {
        logger.error({ err: error, aiSystemId: config.aiSystemId }, 'Failed to poll AI system');
        results.push({
          aiSystemId: config.aiSystemId,
          eventsIngested: 0,
          errorsDetected: 0,
          latencyMs: 0,
          polledAt: new Date(),
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        polledCount++;
      }
    }
    
    logger.info({ 
      totalConfigs: configs.length,
      polled: polledCount,
      skipped: skippedCount,
    }, 'Polling cycle complete');
    
    return results;
  }

  /**
   * Check if a system is due for polling based on configured interval
   */
  private isPollingDue(config: TelemetryPollingConfig, now: Date): boolean {
    // Never polled before - poll now
    if (!config.lastPolledAt) {
      return true;
    }
    
    // Calculate next poll time based on interval
    const intervalMs = config.pollIntervalMinutes * 60 * 1000;
    const nextPollTime = new Date(config.lastPolledAt.getTime() + intervalMs);
    
    // Due if current time is past next poll time
    return now >= nextPollTime;
  }

  /**
   * Get polling status for an AI system (database-backed)
   */
  async getPollingConfig(aiSystemId: string): Promise<TelemetryPollingConfig | undefined> {
    return storage.getPollingConfig(aiSystemId);
  }

  /**
   * Get all polling configurations (database-backed)
   */
  async getAllConfigs(): Promise<TelemetryPollingConfig[]> {
    return storage.getAllPollingConfigs(false);
  }
}

// Singleton instance
export const telemetryPoller = new TelemetryPoller();
