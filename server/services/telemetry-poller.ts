/**
 * Telemetry Polling Service
 * 
 * Multi-platform telemetry polling supporting:
 * - LangSmith (LLM traces)
 * - Arize (Model monitoring)
 * - LangFuse (Open-source LLM observability)
 * - Weights & Biases (ML experiment tracking)
 * 
 * Complements webhook-based telemetry with active polling
 * PRODUCTION-READY: Database-backed persistence with deduplication
 */

import { logger } from '../logger';
import { storage } from '../storage';
import { LangSmithClient, createLangSmithClient } from './langsmith-client';
import { ArizeClient, createArizeClient } from './arize-client';
import { LangFuseClient, createLangFuseClient } from './langfuse-client';
import { WandBClient, createWandBClient } from './wandb-client';
import type { TelemetryPollingConfig, InsertTelemetryPollingConfig } from '@shared/schema';

export interface PollingResult {
  aiSystemId: string;
  platform: string;
  eventsIngested: number;
  errorsDetected: number;
  latencyMs: number;
  polledAt: Date;
  success: boolean;
  error?: string;
}

export class TelemetryPoller {
  private langSmithClient: LangSmithClient | null;
  private arizeClient: ArizeClient | null;
  private langFuseClient: LangFuseClient | null;
  private wandbClient: WandBClient | null;

  constructor() {
    this.langSmithClient = createLangSmithClient();
    this.arizeClient = createArizeClient();
    this.langFuseClient = createLangFuseClient();
    this.wandbClient = createWandBClient();
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
    logger.info({ aiSystemId }, 'Unregister AI system from polling');
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
        platform: config.platform || 'unknown',
        eventsIngested: 0,
        errorsDetected: 0,
        latencyMs: 0,
        polledAt: new Date(),
        success: true,
      };
    }

    const platform = config.platform || 'langsmith';
    
    // Route to appropriate platform
    switch (platform.toLowerCase()) {
      case 'langsmith':
        return this.pollLangSmith(aiSystemId, config);
      case 'arize':
        return this.pollArize(aiSystemId, config);
      case 'langfuse':
        return this.pollLangFuse(aiSystemId, config);
      case 'wandb':
        return this.pollWandB(aiSystemId, config);
      default:
        throw new Error(`Unsupported polling platform: ${platform}`);
    }
  }

  /**
   * Poll LangSmith for telemetry data
   */
  private async pollLangSmith(
    aiSystemId: string,
    config: TelemetryPollingConfig
  ): Promise<PollingResult> {
    const startTime = Date.now();

    if (!this.langSmithClient) {
      await storage.updatePollingStatus(aiSystemId, {
        lastPolledAt: new Date(),
        lastPollStatus: 'failed',
        lastPollEventsIngested: 0,
        lastPollError: 'LangSmith client not configured',
      });
      
      return {
        aiSystemId,
        platform: 'langsmith',
        eventsIngested: 0,
        errorsDetected: 0,
        latencyMs: Date.now() - startTime,
        polledAt: new Date(),
        success: false,
        error: 'LangSmith client not configured',
      };
    }

    try {
      logger.info({ aiSystemId, projectName: config.projectName }, 'Polling LangSmith telemetry');

      const metrics = await this.langSmithClient.pollMetrics(
        config.projectName,
        config.lookbackMinutes
      );

      // Convert runs to telemetry events
      const events = metrics.runs.map(run => ({
        aiSystemId,
        eventType: run.run_type === 'llm' ? 'run' : 'other',
        source: 'langsmith',
        runId: run.id,
        ruleId: undefined,
        severity: run.error ? 'high' : undefined,
        metric: run.error ? 'error_count' : 'run_count',
        metricValue: '1',
        threshold: undefined,
        encryptedPayload: JSON.stringify({
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
          polled: true,
        }),
        phiRedacted: false,
        phiEntitiesDetected: 0,
        processedAt: new Date(),
      }));

      // Store events with deduplication
      let eventsIngested = 0;
      for (const event of events) {
        try {
          await storage.createAITelemetryEvent(event);
          eventsIngested++;
        } catch (error) {
          logger.debug({ err: error, runId: event.runId }, 'Failed to store event (likely duplicate)');
        }
      }

      const latencyMs = Date.now() - startTime;

      await storage.updatePollingStatus(aiSystemId, {
        lastPolledAt: new Date(),
        lastPollStatus: 'success',
        lastPollEventsIngested: eventsIngested,
        lastPollError: undefined,
      });

      return {
        aiSystemId,
        platform: 'langsmith',
        eventsIngested,
        errorsDetected: Math.round((metrics.errorRate / 100) * metrics.totalRuns),
        latencyMs,
        polledAt: new Date(),
        success: true,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await storage.updatePollingStatus(aiSystemId, {
        lastPolledAt: new Date(),
        lastPollStatus: 'failed',
        lastPollEventsIngested: 0,
        lastPollError: errorMessage,
      });
      
      return {
        aiSystemId,
        platform: 'langsmith',
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
   * Poll Arize for telemetry data
   */
  private async pollArize(
    aiSystemId: string,
    config: TelemetryPollingConfig
  ): Promise<PollingResult> {
    const startTime = Date.now();

    if (!this.arizeClient) {
      await storage.updatePollingStatus(aiSystemId, {
        lastPolledAt: new Date(),
        lastPollStatus: 'failed',
        lastPollEventsIngested: 0,
        lastPollError: 'Arize client not configured',
      });
      
      return {
        aiSystemId,
        platform: 'arize',
        eventsIngested: 0,
        errorsDetected: 0,
        latencyMs: Date.now() - startTime,
        polledAt: new Date(),
        success: false,
        error: 'Arize client not configured',
      };
    }

    try {
      logger.info({ aiSystemId, modelId: config.projectName }, 'Polling Arize telemetry');

      const metrics = await this.arizeClient.pollMetrics(
        config.projectName, // modelId
        config.lookbackMinutes
      );

      // Convert predictions to telemetry events
      const events = metrics.predictions.map(pred => ({
        aiSystemId,
        eventType: 'prediction',
        source: 'arize',
        runId: pred.predictionId,
        ruleId: undefined,
        severity: metrics.driftDetected ? 'medium' : undefined,
        metric: 'prediction_count',
        metricValue: '1',
        threshold: undefined,
        encryptedPayload: JSON.stringify({
          prediction_id: pred.predictionId,
          model_id: pred.modelId,
          timestamp: pred.timestamp,
          features: pred.features,
          prediction: pred.prediction,
          actual: pred.actual,
          tags: pred.tags,
          metrics: metrics.metrics,
          polled: true,
        }),
        phiRedacted: false,
        phiEntitiesDetected: 0,
        processedAt: new Date(),
      }));

      // Store events with deduplication
      let eventsIngested = 0;
      for (const event of events) {
        try {
          await storage.createAITelemetryEvent(event);
          eventsIngested++;
        } catch (error) {
          logger.debug({ err: error, runId: event.runId }, 'Failed to store event (likely duplicate)');
        }
      }

      const latencyMs = Date.now() - startTime;

      await storage.updatePollingStatus(aiSystemId, {
        lastPolledAt: new Date(),
        lastPollStatus: 'success',
        lastPollEventsIngested: eventsIngested,
        lastPollError: undefined,
      });

      return {
        aiSystemId,
        platform: 'arize',
        eventsIngested,
        errorsDetected: metrics.driftDetected ? 1 : 0,
        latencyMs,
        polledAt: new Date(),
        success: true,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await storage.updatePollingStatus(aiSystemId, {
        lastPolledAt: new Date(),
        lastPollStatus: 'failed',
        lastPollEventsIngested: 0,
        lastPollError: errorMessage,
      });
      
      return {
        aiSystemId,
        platform: 'arize',
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
   * Poll LangFuse for telemetry data
   */
  private async pollLangFuse(
    aiSystemId: string,
    config: TelemetryPollingConfig
  ): Promise<PollingResult> {
    const startTime = Date.now();

    if (!this.langFuseClient) {
      await storage.updatePollingStatus(aiSystemId, {
        lastPolledAt: new Date(),
        lastPollStatus: 'failed',
        lastPollEventsIngested: 0,
        lastPollError: 'LangFuse client not configured',
      });
      
      return {
        aiSystemId,
        platform: 'langfuse',
        eventsIngested: 0,
        errorsDetected: 0,
        latencyMs: Date.now() - startTime,
        polledAt: new Date(),
        success: false,
        error: 'LangFuse client not configured',
      };
    }

    try {
      logger.info({ aiSystemId, sessionId: config.projectName }, 'Polling LangFuse telemetry');

      const metrics = await this.langFuseClient.pollMetrics(
        config.projectName, // sessionId
        config.lookbackMinutes
      );

      // Convert observations to telemetry events
      const events = metrics.observations.map(obs => ({
        aiSystemId,
        eventType: obs.type.toLowerCase(),
        source: 'langfuse',
        runId: obs.id,
        ruleId: undefined,
        severity: obs.level === 'ERROR' ? 'high' : undefined,
        metric: obs.type === 'GENERATION' ? 'generation_count' : 'span_count',
        metricValue: '1',
        threshold: undefined,
        encryptedPayload: JSON.stringify({
          observation_id: obs.id,
          trace_id: obs.traceId,
          type: obs.type,
          name: obs.name,
          model: obs.model,
          input: obs.input,
          output: obs.output,
          usage: obs.usage,
          start_time: obs.startTime,
          end_time: obs.endTime,
          metadata: obs.metadata,
          polled: true,
        }),
        phiRedacted: false,
        phiEntitiesDetected: 0,
        processedAt: new Date(),
      }));

      // Store events with deduplication
      let eventsIngested = 0;
      for (const event of events) {
        try {
          await storage.createAITelemetryEvent(event);
          eventsIngested++;
        } catch (error) {
          logger.debug({ err: error, runId: event.runId }, 'Failed to store event (likely duplicate)');
        }
      }

      const latencyMs = Date.now() - startTime;

      await storage.updatePollingStatus(aiSystemId, {
        lastPolledAt: new Date(),
        lastPollStatus: 'success',
        lastPollEventsIngested: eventsIngested,
        lastPollError: undefined,
      });

      return {
        aiSystemId,
        platform: 'langfuse',
        eventsIngested,
        errorsDetected: Math.round((metrics.errorRate / 100) * metrics.observations.length),
        latencyMs,
        polledAt: new Date(),
        success: true,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await storage.updatePollingStatus(aiSystemId, {
        lastPolledAt: new Date(),
        lastPollStatus: 'failed',
        lastPollEventsIngested: 0,
        lastPollError: errorMessage,
      });
      
      return {
        aiSystemId,
        platform: 'langfuse',
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
   * Poll Weights & Biases for telemetry data
   */
  private async pollWandB(
    aiSystemId: string,
    config: TelemetryPollingConfig
  ): Promise<PollingResult> {
    const startTime = Date.now();

    if (!this.wandbClient) {
      await storage.updatePollingStatus(aiSystemId, {
        lastPolledAt: new Date(),
        lastPollStatus: 'failed',
        lastPollEventsIngested: 0,
        lastPollError: 'W&B client not configured',
      });
      
      return {
        aiSystemId,
        platform: 'wandb',
        eventsIngested: 0,
        errorsDetected: 0,
        latencyMs: Date.now() - startTime,
        polledAt: new Date(),
        success: false,
        error: 'W&B client not configured',
      };
    }

    try {
      logger.info({ aiSystemId, project: config.projectName }, 'Polling W&B telemetry');

      const metrics = await this.wandbClient.pollMetrics(
        config.projectName,
        config.lookbackMinutes
      );

      // Convert runs to telemetry events
      const events = metrics.runs.map(run => ({
        aiSystemId,
        eventType: 'experiment_run',
        source: 'wandb',
        runId: run.id,
        ruleId: undefined,
        severity: (run.state === 'crashed' || run.state === 'failed') ? 'high' : undefined,
        metric: 'run_count',
        metricValue: '1',
        threshold: undefined,
        encryptedPayload: JSON.stringify({
          run_id: run.id,
          name: run.name,
          state: run.state,
          created_at: run.createdAt,
          runtime: run.runtime,
          config: run.config,
          summary: run.summary,
          tags: run.tags,
          group: run.group,
          polled: true,
        }),
        phiRedacted: false,
        phiEntitiesDetected: 0,
        processedAt: new Date(),
      }));

      // Store events with deduplication
      let eventsIngested = 0;
      for (const event of events) {
        try {
          await storage.createAITelemetryEvent(event);
          eventsIngested++;
        } catch (error) {
          logger.debug({ err: error, runId: event.runId }, 'Failed to store event (likely duplicate)');
        }
      }

      const latencyMs = Date.now() - startTime;

      await storage.updatePollingStatus(aiSystemId, {
        lastPolledAt: new Date(),
        lastPollStatus: 'success',
        lastPollEventsIngested: eventsIngested,
        lastPollError: undefined,
      });

      return {
        aiSystemId,
        platform: 'wandb',
        eventsIngested,
        errorsDetected: Math.round((metrics.failureRate / 100) * metrics.totalRuns),
        latencyMs,
        polledAt: new Date(),
        success: true,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await storage.updatePollingStatus(aiSystemId, {
        lastPolledAt: new Date(),
        lastPollStatus: 'failed',
        lastPollEventsIngested: 0,
        lastPollError: errorMessage,
      });
      
      return {
        aiSystemId,
        platform: 'wandb',
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
    
    const configs = await storage.getAllPollingConfigs(true);
    
    logger.info({ count: configs.length }, 'Checking polling schedule for enabled AI systems');
    
    const now = new Date();
    let polledCount = 0;
    let skippedCount = 0;
    
    for (const config of configs) {
      const isDue = this.isPollingDue(config, now);
      
      if (!isDue) {
        skippedCount++;
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
          platform: config.platform || 'unknown',
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
    if (!config.lastPolledAt) {
      return true;
    }
    
    const intervalMs = config.pollIntervalMinutes * 60 * 1000;
    const nextPollTime = new Date(config.lastPolledAt.getTime() + intervalMs);
    
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
