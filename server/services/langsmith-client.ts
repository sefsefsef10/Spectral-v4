/**
 * LangSmith API Client
 * 
 * Provides direct API access to LangSmith for polling telemetry data
 * Complements webhook-based ingestion with on-demand retrieval
 * 
 * Documentation: https://docs.smith.langchain.com/api-reference
 */

import { logger } from '../logger';

export interface LangSmithConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface LangSmithRun {
  id: string;
  name: string;
  run_type: 'llm' | 'chain' | 'tool' | 'retriever' | 'prompt';
  start_time: string;
  end_time?: string;
  error?: string;
  inputs: Record<string, any>;
  outputs?: Record<string, any>;
  extra?: Record<string, any>;
  trace_id: string;
  dotted_order: string;
  parent_run_id?: string;
  session_id?: string;
  feedback_stats?: Record<string, any>;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface LangSmithProject {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  run_count?: number;
  metadata?: Record<string, any>;
}

export interface LangSmithFeedback {
  id: string;
  run_id: string;
  key: string;
  score?: number;
  value?: any;
  comment?: string;
  correction?: Record<string, any>;
  created_at: string;
}

export interface ListRunsOptions {
  projectName?: string;
  projectId?: string;
  runType?: 'llm' | 'chain' | 'tool' | 'retriever' | 'prompt';
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
  hasError?: boolean;
  tags?: string[];
}

export interface PollMetricsResult {
  runs: LangSmithRun[];
  feedback: LangSmithFeedback[];
  totalRuns: number;
  errorRate: number;
  averageLatency: number;
  polledAt: Date;
}

export class LangSmithClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: LangSmithConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.smith.langchain.com';
  }

  /**
   * List projects (datasets/sessions)
   */
  async listProjects(limit: number = 100): Promise<LangSmithProject[]> {
    try {
      const response = await this.makeRequest(`/projects?limit=${limit}`);
      return response;
    } catch (error) {
      logger.error({ err: error }, 'Failed to list LangSmith projects');
      throw error;
    }
  }

  /**
   * Get runs (traces) for a project
   */
  async listRuns(options: ListRunsOptions = {}): Promise<LangSmithRun[]> {
    try {
      const params = new URLSearchParams();
      
      if (options.projectName) params.append('session', options.projectName);
      if (options.projectId) params.append('session_id', options.projectId);
      if (options.runType) params.append('run_type', options.runType);
      if (options.startTime) params.append('start_time', options.startTime.toISOString());
      if (options.endTime) params.append('end_time', options.endTime.toISOString());
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.offset) params.append('offset', options.offset.toString());
      if (options.hasError !== undefined) params.append('has_error', options.hasError.toString());
      if (options.tags && options.tags.length > 0) {
        options.tags.forEach(tag => params.append('tag', tag));
      }

      const response = await this.makeRequest(`/runs?${params.toString()}`);
      return response;
    } catch (error) {
      logger.error({ err: error, options }, 'Failed to list LangSmith runs');
      throw error;
    }
  }

  /**
   * Get a specific run by ID
   */
  async getRun(runId: string): Promise<LangSmithRun> {
    try {
      const response = await this.makeRequest(`/runs/${runId}`);
      return response;
    } catch (error) {
      logger.error({ err: error, runId }, 'Failed to get LangSmith run');
      throw error;
    }
  }

  /**
   * Get feedback for a run
   */
  async getFeedback(runId: string): Promise<LangSmithFeedback[]> {
    try {
      const response = await this.makeRequest(`/runs/${runId}/feedback`);
      return response;
    } catch (error) {
      logger.error({ err: error, runId }, 'Failed to get LangSmith feedback');
      throw error;
    }
  }

  /**
   * Poll for recent telemetry data and compute metrics
   * 
   * @param projectName The LangSmith project/session to poll
   * @param lookbackMinutes How many minutes of data to retrieve (default: 15)
   * @returns Aggregated metrics and raw data
   */
  async pollMetrics(
    projectName: string,
    lookbackMinutes: number = 15
  ): Promise<PollMetricsResult> {
    const startTime = new Date(Date.now() - lookbackMinutes * 60 * 1000);
    const endTime = new Date();

    logger.info({ projectName, lookbackMinutes, startTime, endTime }, 'Polling LangSmith metrics');

    try {
      // Fetch runs from the lookback window
      const runs = await this.listRuns({
        projectName,
        startTime,
        endTime,
        limit: 1000, // Adjust based on expected volume
      });

      // Fetch feedback for runs
      const feedbackPromises = runs
        .slice(0, 100) // Limit to 100 most recent runs to avoid rate limits
        .map(run => this.getFeedback(run.id).catch(() => []));
      
      const feedbackArrays = await Promise.all(feedbackPromises);
      const feedback = feedbackArrays.flat();

      // Calculate metrics
      const totalRuns = runs.length;
      const errorRuns = runs.filter(r => r.error !== null && r.error !== undefined).length;
      const errorRate = totalRuns > 0 ? (errorRuns / totalRuns) * 100 : 0;

      // Calculate average latency (only for completed runs)
      const completedRuns = runs.filter(r => r.end_time && r.start_time);
      const latencies = completedRuns.map(r => {
        const start = new Date(r.start_time).getTime();
        const end = new Date(r.end_time!).getTime();
        return end - start;
      });
      const averageLatency = latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;

      logger.info({
        projectName,
        totalRuns,
        errorRate,
        averageLatency: `${(averageLatency / 1000).toFixed(2)}s`,
      }, 'LangSmith metrics polling complete');

      return {
        runs,
        feedback,
        totalRuns,
        errorRate,
        averageLatency,
        polledAt: new Date(),
      };
    } catch (error) {
      logger.error({ err: error, projectName }, 'LangSmith metrics polling failed');
      throw error;
    }
  }

  /**
   * Make authenticated request to LangSmith API
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LangSmith API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error({ err: error, url }, 'LangSmith API request failed');
      throw error;
    }
  }
}

/**
 * Create LangSmith client from environment variable
 */
export function createLangSmithClient(): LangSmithClient | null {
  const apiKey = process.env.LANGSMITH_API_KEY;
  
  if (!apiKey) {
    logger.warn('LANGSMITH_API_KEY not configured - polling disabled');
    return null;
  }

  return new LangSmithClient({ apiKey });
}
