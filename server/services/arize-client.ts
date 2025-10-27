/**
 * 🔍 ARIZE AI CLIENT
 * 
 * Client for polling telemetry data from Arize AI platform
 * Similar to LangSmith client but for Arize's model monitoring API
 */

import { logger } from '../logger';

export interface ArizeConfig {
  apiKey: string;
  spaceId: string;
  baseUrl?: string;
}

export interface ArizeModel {
  modelId: string;
  modelName: string;
  modelType: string;
  createdAt: string;
}

export interface ArizePrediction {
  predictionId: string;
  modelId: string;
  timestamp: string;
  features: Record<string, any>;
  prediction: any;
  actual?: any;
  tags?: Record<string, string>;
}

export interface ArizeMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  drift?: number;
  predictionVolume: number;
}

export interface PollMetricsResult {
  predictions: ArizePrediction[];
  metrics: ArizeMetrics;
  totalPredictions: number;
  driftDetected: boolean;
  polledAt: Date;
}

export class ArizeClient {
  private apiKey: string;
  private spaceId: string;
  private baseUrl: string;

  constructor(config: ArizeConfig) {
    this.apiKey = config.apiKey;
    this.spaceId = config.spaceId;
    this.baseUrl = config.baseUrl || 'https://api.arize.com/v1';
  }

  /**
   * Make authenticated request to Arize API
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Arize-Space-Id': this.spaceId,
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Arize API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      logger.error({ err: error, url }, 'Arize API request failed');
      throw error;
    }
  }

  /**
   * List models in the space
   */
  async listModels(): Promise<ArizeModel[]> {
    try {
      const response = await this.makeRequest('/models');
      return response.models || [];
    } catch (error) {
      logger.error({ err: error }, 'Failed to list Arize models');
      throw error;
    }
  }

  /**
   * Get predictions for a model within a time range
   */
  async getPredictions(
    modelId: string,
    startTime: Date,
    endTime: Date,
    limit: number = 1000
  ): Promise<ArizePrediction[]> {
    try {
      const params = new URLSearchParams({
        modelId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        limit: limit.toString(),
      });

      const response = await this.makeRequest(`/predictions?${params.toString()}`);
      return response.predictions || [];
    } catch (error) {
      logger.error({ err: error, modelId }, 'Failed to get Arize predictions');
      throw error;
    }
  }

  /**
   * Get model metrics
   */
  async getModelMetrics(
    modelId: string,
    startTime: Date,
    endTime: Date
  ): Promise<ArizeMetrics> {
    try {
      const params = new URLSearchParams({
        modelId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

      const response = await this.makeRequest(`/metrics?${params.toString()}`);
      return {
        accuracy: response.accuracy,
        precision: response.precision,
        recall: response.recall,
        f1Score: response.f1_score,
        drift: response.drift_score,
        predictionVolume: response.prediction_volume || 0,
      };
    } catch (error) {
      logger.error({ err: error, modelId }, 'Failed to get Arize metrics');
      throw error;
    }
  }

  /**
   * Poll metrics for a model (similar to LangSmith)
   */
  async pollMetrics(
    modelId: string,
    lookbackMinutes: number = 15
  ): Promise<PollMetricsResult> {
    const startTime = new Date(Date.now() - lookbackMinutes * 60 * 1000);
    const endTime = new Date();

    logger.info({ modelId, lookbackMinutes, startTime, endTime }, 'Polling Arize metrics');

    try {
      // Fetch predictions
      const predictions = await this.getPredictions(modelId, startTime, endTime);

      // Fetch metrics
      const metrics = await this.getModelMetrics(modelId, startTime, endTime);

      // Detect drift (threshold: 0.1)
      const driftDetected = (metrics.drift || 0) > 0.1;

      logger.info({
        modelId,
        totalPredictions: predictions.length,
        drift: metrics.drift?.toFixed(3),
        driftDetected,
      }, 'Arize metrics polling complete');

      return {
        predictions,
        metrics,
        totalPredictions: predictions.length,
        driftDetected,
        polledAt: new Date(),
      };
    } catch (error) {
      logger.error({ err: error, modelId }, 'Arize metrics polling failed');
      throw error;
    }
  }
}

/**
 * Create Arize client from environment variables
 */
export function createArizeClient(): ArizeClient | null {
  const apiKey = process.env.ARIZE_API_KEY;
  const spaceId = process.env.ARIZE_SPACE_ID;

  if (!apiKey || !spaceId) {
    logger.warn('ARIZE_API_KEY or ARIZE_SPACE_ID not configured - polling disabled');
    return null;
  }

  return new ArizeClient({ apiKey, spaceId });
}
