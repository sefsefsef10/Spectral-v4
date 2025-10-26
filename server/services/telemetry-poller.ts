/**
 * Telemetry Polling Service
 * 
 * Complements webhook-based telemetry with active polling
 * Useful for:
 * - Backfilling data
 * - Verifying webhook delivery
 * - Fallback when webhooks fail
 * - On-demand metrics retrieval
 */

import { logger } from '../logger';
import { storage } from '../storage';
import { LangSmithClient, createLangSmithClient } from './langsmith-client';

export interface PollingConfig {
  aiSystemId: string;
  projectName: string; // LangSmith project/session name
  pollIntervalMinutes: number;
  lookbackMinutes: number;
  enabled: boolean;
}

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
  private pollingConfigs: Map<string, PollingConfig> = new Map();

  constructor() {
    this.langSmithClient = createLangSmithClient();
  }

  /**
   * Register an AI system for polling
   */
  registerAISystem(config: PollingConfig): void {
    this.pollingConfigs.set(config.aiSystemId, config);
    logger.info({ config }, 'Registered AI system for telemetry polling');
  }

  /**
   * Unregister an AI system from polling
   */
  unregisterAISystem(aiSystemId: string): void {
    this.pollingConfigs.delete(aiSystemId);
    logger.info({ aiSystemId }, 'Unregistered AI system from polling');
  }

  /**
   * Poll telemetry for a specific AI system
   */
  async pollSystem(aiSystemId: string): Promise<PollingResult> {
    const config = this.pollingConfigs.get(aiSystemId);
    
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
      // Match the aiTelemetryEvents schema structure
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
          runId: run.id,
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

      // Store events in database
      let eventsIngested = 0;
      for (const event of events) {
        try {
          await storage.createAITelemetryEvent(event);
          eventsIngested++;
        } catch (error) {
          // Log but continue (may be duplicate)
          logger.debug({ err: error, runId: event.runId }, 'Failed to store telemetry event (may be duplicate)');
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
      
      logger.error({ err: error, aiSystemId }, 'Telemetry polling failed');
      
      return {
        aiSystemId,
        eventsIngested: 0,
        errorsDetected: 0,
        latencyMs,
        polledAt: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Poll all registered AI systems
   */
  async pollAll(): Promise<PollingResult[]> {
    const results: PollingResult[] = [];
    
    // Convert Map entries to array for iteration
    const entries = Array.from(this.pollingConfigs.entries());
    
    for (const [aiSystemId, config] of entries) {
      if (!config.enabled) {
        continue;
      }
      
      try {
        const result = await this.pollSystem(aiSystemId);
        results.push(result);
      } catch (error) {
        logger.error({ err: error, aiSystemId }, 'Failed to poll AI system');
        results.push({
          aiSystemId,
          eventsIngested: 0,
          errorsDetected: 0,
          latencyMs: 0,
          polledAt: new Date(),
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    return results;
  }

  /**
   * Start continuous polling loop (for background job)
   */
  startPolling(): void {
    // This should be called from a cron job or Inngest workflow
    // Not a setInterval to avoid drift and memory leaks
    logger.info('Telemetry polling service initialized');
  }

  /**
   * Get polling status for an AI system
   */
  getPollingConfig(aiSystemId: string): PollingConfig | undefined {
    return this.pollingConfigs.get(aiSystemId);
  }

  /**
   * Get all polling configurations
   */
  getAllConfigs(): PollingConfig[] {
    return Array.from(this.pollingConfigs.values());
  }
}

// Singleton instance
export const telemetryPoller = new TelemetryPoller();
