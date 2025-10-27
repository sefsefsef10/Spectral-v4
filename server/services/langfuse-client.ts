/**
 * LangFuse API Client
 * 
 * Open-source LLM engineering platform for observability and analytics
 * Provides direct API access for polling telemetry data
 * 
 * Documentation: https://langfuse.com/docs/integrations/api
 */

import { logger } from '../logger';

export interface LangFuseConfig {
  publicKey: string;
  secretKey: string;
  baseUrl?: string;
}

export interface LangFuseTrace {
  id: string;
  name: string;
  userId?: string;
  sessionId?: string;
  timestamp: string;
  release?: string;
  version?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  public?: boolean;
}

export interface LangFuseObservation {
  id: string;
  traceId: string;
  type: 'SPAN' | 'EVENT' | 'GENERATION';
  name: string;
  startTime: string;
  endTime?: string;
  completionStartTime?: string;
  model?: string;
  modelParameters?: Record<string, any>;
  input?: any;
  output?: any;
  metadata?: Record<string, any>;
  level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
  statusMessage?: string;
  version?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface LangFuseScore {
  id: string;
  traceId: string;
  observationId?: string;
  name: string;
  value: number;
  timestamp: string;
  comment?: string;
}

export interface ListTracesOptions {
  userId?: string;
  name?: string;
  sessionId?: string;
  fromTimestamp?: Date;
  toTimestamp?: Date;
  tags?: string[];
  limit?: number;
  page?: number;
}

export interface PollMetricsResult {
  traces: LangFuseTrace[];
  observations: LangFuseObservation[];
  scores: LangFuseScore[];
  totalTraces: number;
  errorRate: number;
  averageLatency: number;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  polledAt: Date;
}

export class LangFuseClient {
  private publicKey: string;
  private secretKey: string;
  private baseUrl: string;

  constructor(config: LangFuseConfig) {
    this.publicKey = config.publicKey;
    this.secretKey = config.secretKey;
    this.baseUrl = config.baseUrl || 'https://cloud.langfuse.com';
  }

  /**
   * List traces with filtering options
   */
  async listTraces(options: ListTracesOptions = {}): Promise<LangFuseTrace[]> {
    try {
      const params = new URLSearchParams();
      
      if (options.userId) params.append('userId', options.userId);
      if (options.name) params.append('name', options.name);
      if (options.sessionId) params.append('sessionId', options.sessionId);
      if (options.fromTimestamp) params.append('fromTimestamp', options.fromTimestamp.toISOString());
      if (options.toTimestamp) params.append('toTimestamp', options.toTimestamp.toISOString());
      if (options.tags && options.tags.length > 0) {
        options.tags.forEach(tag => params.append('tags', tag));
      }
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.page) params.append('page', options.page.toString());

      const response = await this.makeRequest(`/api/public/traces?${params.toString()}`);
      return response.data || [];
    } catch (error) {
      logger.error({ err: error, options }, 'Failed to list LangFuse traces');
      throw error;
    }
  }

  /**
   * Get a specific trace by ID
   */
  async getTrace(traceId: string): Promise<LangFuseTrace> {
    try {
      const response = await this.makeRequest(`/api/public/traces/${traceId}`);
      return response;
    } catch (error) {
      logger.error({ err: error, traceId }, 'Failed to get LangFuse trace');
      throw error;
    }
  }

  /**
   * Get observations for a trace
   */
  async getObservations(traceId: string): Promise<LangFuseObservation[]> {
    try {
      const response = await this.makeRequest(`/api/public/traces/${traceId}/observations`);
      return response.data || [];
    } catch (error) {
      logger.error({ err: error, traceId }, 'Failed to get LangFuse observations');
      throw error;
    }
  }

  /**
   * Get scores for a trace
   */
  async getScores(traceId: string): Promise<LangFuseScore[]> {
    try {
      const response = await this.makeRequest(`/api/public/scores?traceId=${traceId}`);
      return response.data || [];
    } catch (error) {
      logger.error({ err: error, traceId }, 'Failed to get LangFuse scores');
      throw error;
    }
  }

  /**
   * Poll for recent telemetry data and compute metrics
   * 
   * @param sessionId Optional session ID to filter traces
   * @param lookbackMinutes How many minutes of data to retrieve (default: 15)
   * @returns Aggregated metrics and raw data
   */
  async pollMetrics(
    sessionId?: string,
    lookbackMinutes: number = 15
  ): Promise<PollMetricsResult> {
    const fromTimestamp = new Date(Date.now() - lookbackMinutes * 60 * 1000);
    const toTimestamp = new Date();

    logger.info({ sessionId, lookbackMinutes, fromTimestamp, toTimestamp }, 'Polling LangFuse metrics');

    try {
      // Fetch traces from the lookback window
      const traces = await this.listTraces({
        sessionId,
        fromTimestamp,
        toTimestamp,
        limit: 1000,
      });

      // Fetch observations and scores for each trace
      const observationPromises = traces.map(trace => 
        this.getObservations(trace.id).catch(() => [])
      );
      const scorePromises = traces.map(trace => 
        this.getScores(trace.id).catch(() => [])
      );

      const [observationArrays, scoreArrays] = await Promise.all([
        Promise.all(observationPromises),
        Promise.all(scorePromises),
      ]);

      const observations = observationArrays.flat();
      const scores = scoreArrays.flat();

      // Calculate metrics
      const totalTraces = traces.length;
      
      // Error rate from observations with ERROR level
      const errorObservations = observations.filter(o => o.level === 'ERROR' || o.statusMessage?.toLowerCase().includes('error')).length;
      const errorRate = observations.length > 0 ? (errorObservations / observations.length) * 100 : 0;

      // Calculate average latency from generation observations
      const generationObservations = observations.filter(o => 
        o.type === 'GENERATION' && o.startTime && o.endTime
      );
      const latencies = generationObservations.map(o => {
        const start = new Date(o.startTime).getTime();
        const end = new Date(o.endTime!).getTime();
        return end - start;
      });
      const averageLatency = latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;

      // Calculate token usage
      const tokenUsage = observations.reduce(
        (acc, o) => {
          if (o.usage) {
            acc.prompt += o.usage.promptTokens || 0;
            acc.completion += o.usage.completionTokens || 0;
            acc.total += o.usage.totalTokens || 0;
          }
          return acc;
        },
        { prompt: 0, completion: 0, total: 0 }
      );

      logger.info({
        sessionId,
        totalTraces,
        totalObservations: observations.length,
        errorRate: `${errorRate.toFixed(2)}%`,
        averageLatency: `${(averageLatency / 1000).toFixed(2)}s`,
        tokenUsage,
      }, 'LangFuse metrics polling complete');

      return {
        traces,
        observations,
        scores,
        totalTraces,
        errorRate,
        averageLatency,
        tokenUsage,
        polledAt: new Date(),
      };
    } catch (error) {
      logger.error({ err: error, sessionId }, 'LangFuse metrics polling failed');
      throw error;
    }
  }

  /**
   * Make authenticated request to LangFuse API
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Basic auth with public key as username, secret key as password
    const credentials = Buffer.from(`${this.publicKey}:${this.secretKey}`).toString('base64');
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${credentials}`,
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LangFuse API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error({ err: error, url }, 'LangFuse API request failed');
      throw error;
    }
  }
}

/**
 * Create LangFuse client from environment variables
 */
export function createLangFuseClient(): LangFuseClient | null {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  
  if (!publicKey || !secretKey) {
    logger.warn('LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY not configured - polling disabled');
    return null;
  }

  return new LangFuseClient({ publicKey, secretKey });
}
