/**
 * Weights & Biases (W&B) API Client
 * 
 * ML experiment tracking and model monitoring platform
 * Provides direct API access for polling telemetry data
 * 
 * Documentation: https://docs.wandb.ai/ref/app/public-api
 */

import { logger } from '../logger';

export interface WandBConfig {
  apiKey: string;
  entity?: string;  // Team or username
  baseUrl?: string;
}

export interface WandBProject {
  id: string;
  name: string;
  entity: string;
  description?: string;
  createdAt: string;
  runCount?: number;
}

export interface WandBRun {
  id: string;
  name: string;
  displayName?: string;
  state: 'running' | 'finished' | 'crashed' | 'failed' | 'killed';
  createdAt: string;
  heartbeatAt?: string;
  runtime?: number;
  tags?: string[];
  config?: Record<string, any>;
  summary?: Record<string, any>;
  user?: {
    username: string;
    email?: string;
  };
  group?: string;
  jobType?: string;
  notes?: string;
}

export interface WandBMetric {
  name: string;
  step: number;
  value: number;
  timestamp: number;
}

export interface ListRunsOptions {
  project: string;
  entity?: string;
  state?: string;
  createdAtFrom?: Date;
  createdAtTo?: Date;
  tags?: string[];
  limit?: number;
}

export interface PollMetricsResult {
  runs: WandBRun[];
  metrics: Record<string, WandBMetric[]>;
  totalRuns: number;
  failureRate: number;
  averageRuntime: number;
  polledAt: Date;
}

export class WandBClient {
  private apiKey: string;
  private entity: string;
  private baseUrl: string;

  constructor(config: WandBConfig) {
    this.apiKey = config.apiKey;
    this.entity = config.entity || 'default';
    this.baseUrl = config.baseUrl || 'https://api.wandb.ai';
  }

  /**
   * List projects for the entity
   */
  async listProjects(limit: number = 100): Promise<WandBProject[]> {
    try {
      const query = `
        query Projects($entity: String!, $limit: Int!) {
          entity(name: $entity) {
            projects(first: $limit) {
              edges {
                node {
                  id
                  name
                  description
                  createdAt
                  runCount
                }
              }
            }
          }
        }
      `;

      const response = await this.makeGraphQLRequest(query, {
        entity: this.entity,
        limit,
      });

      const edges = response.data?.entity?.projects?.edges || [];
      return edges.map((edge: any) => ({
        ...edge.node,
        entity: this.entity,
      }));
    } catch (error) {
      logger.error({ err: error }, 'Failed to list W&B projects');
      throw error;
    }
  }

  /**
   * List runs for a project
   */
  async listRuns(options: ListRunsOptions): Promise<WandBRun[]> {
    try {
      const query = `
        query Runs($entity: String!, $project: String!, $filters: JSONString) {
          project(name: $project, entityName: $entity) {
            runs(filters: $filters) {
              edges {
                node {
                  id
                  name
                  displayName
                  state
                  createdAt
                  heartbeatAt
                  config
                  summaryMetrics
                  tags
                  user {
                    username
                    email
                  }
                  group
                  jobType
                  notes
                }
              }
            }
          }
        }
      `;

      // Build filters
      const filters: any = {};
      if (options.state) filters.state = options.state;
      if (options.tags && options.tags.length > 0) filters.tags = { $in: options.tags };
      if (options.createdAtFrom) filters.createdAt = { $gte: options.createdAtFrom.toISOString() };
      if (options.createdAtTo) {
        filters.createdAt = { ...filters.createdAt, $lte: options.createdAtTo.toISOString() };
      }

      const response = await this.makeGraphQLRequest(query, {
        entity: options.entity || this.entity,
        project: options.project,
        filters: JSON.stringify(filters),
      });

      const edges = response.data?.project?.runs?.edges || [];
      return edges.map((edge: any) => ({
        id: edge.node.id,
        name: edge.node.name,
        displayName: edge.node.displayName,
        state: edge.node.state,
        createdAt: edge.node.createdAt,
        heartbeatAt: edge.node.heartbeatAt,
        config: edge.node.config,
        summary: edge.node.summaryMetrics,
        tags: edge.node.tags,
        user: edge.node.user,
        group: edge.node.group,
        jobType: edge.node.jobType,
        notes: edge.node.notes,
      }));
    } catch (error) {
      logger.error({ err: error, options }, 'Failed to list W&B runs');
      throw error;
    }
  }

  /**
   * Get metrics for a specific run
   */
  async getRunMetrics(
    entity: string,
    project: string,
    runId: string,
    metricNames?: string[]
  ): Promise<Record<string, WandBMetric[]>> {
    try {
      const query = `
        query RunHistory($entity: String!, $project: String!, $runName: String!, $keys: [String!]) {
          project(name: $project, entityName: $entity) {
            run(name: $runName) {
              history(keys: $keys) {
                _step
                _timestamp
              }
            }
          }
        }
      `;

      const response = await this.makeGraphQLRequest(query, {
        entity,
        project,
        runName: runId,
        keys: metricNames,
      });

      const history = response.data?.project?.run?.history || [];
      const metrics: Record<string, WandBMetric[]> = {};

      // Transform history into metric format
      for (const record of history) {
        for (const [key, value] of Object.entries(record)) {
          if (key.startsWith('_')) continue; // Skip metadata fields

          if (!metrics[key]) metrics[key] = [];
          
          metrics[key].push({
            name: key,
            step: record._step,
            value: value as number,
            timestamp: record._timestamp,
          });
        }
      }

      return metrics;
    } catch (error) {
      logger.error({ err: error, runId }, 'Failed to get W&B run metrics');
      throw error;
    }
  }

  /**
   * Poll for recent telemetry data and compute metrics
   * 
   * @param project The W&B project name
   * @param lookbackMinutes How many minutes of data to retrieve (default: 15)
   * @returns Aggregated metrics and raw data
   */
  async pollMetrics(
    project: string,
    lookbackMinutes: number = 15
  ): Promise<PollMetricsResult> {
    const createdAtFrom = new Date(Date.now() - lookbackMinutes * 60 * 1000);
    const createdAtTo = new Date();

    logger.info({ project, lookbackMinutes, createdAtFrom, createdAtTo }, 'Polling W&B metrics');

    try {
      // Fetch runs from the lookback window
      const runs = await this.listRuns({
        project,
        entity: this.entity,
        createdAtFrom,
        createdAtTo,
        limit: 1000,
      });

      // Calculate aggregate metrics
      const totalRuns = runs.length;
      const failedRuns = runs.filter(r => 
        r.state === 'crashed' || r.state === 'failed'
      ).length;
      const failureRate = totalRuns > 0 ? (failedRuns / totalRuns) * 100 : 0;

      // Calculate average runtime (for finished runs)
      const finishedRuns = runs.filter(r => r.state === 'finished');
      const runtimes = finishedRuns.map(r => {
        if (!r.createdAt || !r.heartbeatAt) return 0;
        const start = new Date(r.createdAt).getTime();
        const end = new Date(r.heartbeatAt).getTime();
        return end - start;
      }).filter(rt => rt > 0);
      
      const averageRuntime = runtimes.length > 0
        ? runtimes.reduce((a, b) => a + b, 0) / runtimes.length
        : 0;

      logger.info({
        project,
        totalRuns,
        failureRate: `${failureRate.toFixed(2)}%`,
        averageRuntime: `${(averageRuntime / 1000).toFixed(2)}s`,
      }, 'W&B metrics polling complete');

      return {
        runs,
        metrics: {}, // Detailed metrics would require per-run polling
        totalRuns,
        failureRate,
        averageRuntime,
        polledAt: new Date(),
      };
    } catch (error) {
      logger.error({ err: error, project }, 'W&B metrics polling failed');
      throw error;
    }
  }

  /**
   * Make authenticated GraphQL request to W&B API
   */
  private async makeGraphQLRequest(query: string, variables: Record<string, any> = {}): Promise<any> {
    const url = `${this.baseUrl}/graphql`;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`W&B API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(`W&B GraphQL errors: ${JSON.stringify(result.errors)}`);
      }

      return result;
    } catch (error) {
      logger.error({ err: error, url }, 'W&B API request failed');
      throw error;
    }
  }
}

/**
 * Create W&B client from environment variables
 */
export function createWandBClient(): WandBClient | null {
  const apiKey = process.env.WANDB_API_KEY;
  const entity = process.env.WANDB_ENTITY;
  
  if (!apiKey) {
    logger.warn('WANDB_API_KEY not configured - polling disabled');
    return null;
  }

  return new WandBClient({ apiKey, entity });
}
