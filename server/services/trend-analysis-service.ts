import { db } from "../db";
import { aiTelemetryEvents, aiSystems } from "@shared/schema";
import { eq, desc, and, gte } from "drizzle-orm";

interface TrendDataPoint {
  timestamp: Date;
  value: number;
}

interface TrendAnalysisResult {
  metric: string;
  currentValue: number;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  trendVelocity: number; // Rate of change per day
  predictedValue: number; // Value in 7 days
  predictedDate: Date; // When threshold will be crossed
  threshold: number;
  confidenceScore: number; // 0-100
  datapointsAnalyzed: number;
  willCrossThreshold: boolean;
}

interface PredictionThresholds {
  drift_score: number;
  error_rate: number;
  latency_p95: number;
  bias_score: number;
  phi_leak_count: number;
}

// Compliance violation thresholds
const THRESHOLDS: PredictionThresholds = {
  drift_score: 0.3, // Model drift threshold
  error_rate: 0.05, // 5% error rate
  latency_p95: 5000, // 5 seconds p95 latency
  bias_score: 0.15, // Bias detection threshold
  phi_leak_count: 1, // Any PHI leakage is critical
};

export class TrendAnalysisService {
  /**
   * Analyze trends for all metrics of an AI system
   */
  async analyzeSystemTrends(aiSystemId: string, lookbackDays: number = 14): Promise<TrendAnalysisResult[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

    // Get historical telemetry events
    const events = await db
      .select()
      .from(aiTelemetryEvents)
      .where(
        and(
          eq(aiTelemetryEvents.aiSystemId, aiSystemId),
          gte(aiTelemetryEvents.createdAt, cutoffDate)
        )
      )
      .orderBy(desc(aiTelemetryEvents.createdAt));

    if (events.length < 3) {
      // Not enough data for trend analysis
      return [];
    }

    // Group events by metric
    const metricGroups = this.groupEventsByMetric(events);
    
    // Analyze each metric
    const results: TrendAnalysisResult[] = [];
    for (const [metric, dataPoints] of Object.entries(metricGroups)) {
      if (dataPoints.length >= 3) {
        const analysis = this.analyzeTrend(metric, dataPoints);
        if (analysis) {
          results.push(analysis);
        }
      }
    }

    return results;
  }

  /**
   * Group telemetry events by metric type
   */
  private groupEventsByMetric(events: any[]): Record<string, TrendDataPoint[]> {
    const groups: Record<string, TrendDataPoint[]> = {};

    for (const event of events) {
      const metric = event.metric;
      if (!metric || !event.metricValue) continue;

      const value = parseFloat(event.metricValue);
      if (isNaN(value)) continue;

      if (!groups[metric]) {
        groups[metric] = [];
      }

      groups[metric].push({
        timestamp: new Date(event.createdAt),
        value: value,
      });
    }

    return groups;
  }

  /**
   * Perform linear regression and trend analysis on a metric
   */
  private analyzeTrend(metric: string, dataPoints: TrendDataPoint[]): TrendAnalysisResult | null {
    // Sort by timestamp
    dataPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Calculate linear regression
    const regression = this.calculateLinearRegression(dataPoints);
    
    // Get threshold for this metric
    const threshold = this.getThreshold(metric);
    if (!threshold) {
      return null; // Unknown metric, skip
    }

    const currentValue = dataPoints[dataPoints.length - 1].value;
    const slope = regression.slope;
    
    // Determine trend direction
    let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
    const slopeThreshold = Math.abs(currentValue) * 0.01; // 1% change considered significant
    
    if (slope > slopeThreshold) {
      trendDirection = 'increasing';
    } else if (slope < -slopeThreshold) {
      trendDirection = 'decreasing';
    }

    // Calculate velocity (change per day)
    const velocityPerMs = slope;
    const velocityPerDay = velocityPerMs * 24 * 60 * 60 * 1000;

    // Predict value in 7 days
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const predictedValue = regression.intercept + regression.slope * (now + sevenDaysMs);

    // Calculate when threshold will be crossed
    const willCrossThreshold = this.willCrossThreshold(currentValue, predictedValue, threshold, metric);
    let predictedDate = new Date(now + sevenDaysMs);
    
    if (willCrossThreshold && slope !== 0) {
      // Calculate exact crossing time
      const timeToThreshold = (threshold - regression.intercept) / regression.slope - now;
      if (timeToThreshold > 0 && timeToThreshold < 30 * 24 * 60 * 60 * 1000) { // Within 30 days
        predictedDate = new Date(now + timeToThreshold);
      }
    }

    // Calculate confidence score based on data quality
    const confidenceScore = this.calculateConfidence(dataPoints, regression.r2);

    return {
      metric,
      currentValue,
      trendDirection,
      trendVelocity: velocityPerDay,
      predictedValue,
      predictedDate,
      threshold,
      confidenceScore,
      datapointsAnalyzed: dataPoints.length,
      willCrossThreshold,
    };
  }

  /**
   * Calculate linear regression (y = mx + b)
   */
  private calculateLinearRegression(dataPoints: TrendDataPoint[]): {
    slope: number;
    intercept: number;
    r2: number;
  } {
    const n = dataPoints.length;
    
    // Convert timestamps to numeric values (ms since epoch)
    const x = dataPoints.map(p => p.timestamp.getTime());
    const y = dataPoints.map(p => p.value);

    // Calculate means
    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;

    // Calculate slope and intercept
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (x[i] - xMean) * (y[i] - yMean);
      denominator += (x[i] - xMean) * (x[i] - xMean);
    }

    const slope = denominator === 0 ? 0 : numerator / denominator;
    const intercept = yMean - slope * xMean;

    // Calculate R² (coefficient of determination)
    let ssRes = 0; // Residual sum of squares
    let ssTot = 0; // Total sum of squares
    
    for (let i = 0; i < n; i++) {
      const predicted = slope * x[i] + intercept;
      ssRes += (y[i] - predicted) ** 2;
      ssTot += (y[i] - yMean) ** 2;
    }

    const r2 = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);

    return { slope, intercept, r2 };
  }

  /**
   * Get threshold for a specific metric
   */
  private getThreshold(metric: string): number | null {
    const normalizedMetric = metric.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    if (normalizedMetric.includes('drift')) return THRESHOLDS.drift_score;
    if (normalizedMetric.includes('error')) return THRESHOLDS.error_rate;
    if (normalizedMetric.includes('latency')) return THRESHOLDS.latency_p95;
    if (normalizedMetric.includes('bias')) return THRESHOLDS.bias_score;
    if (normalizedMetric.includes('phi') || normalizedMetric.includes('leak')) return THRESHOLDS.phi_leak_count;
    
    return null;
  }

  /**
   * Determine if metric will cross threshold
   */
  private willCrossThreshold(
    currentValue: number,
    predictedValue: number,
    threshold: number,
    metric: string
  ): boolean {
    // For most metrics, crossing means going above threshold
    // For some metrics (e.g., accuracy), crossing means going below
    
    const isBelowThreshold = currentValue < threshold;
    const willBeBelowThreshold = predictedValue < threshold;
    
    // If currently compliant but will become non-compliant, that's a crossing
    return isBelowThreshold !== willBeBelowThreshold;
  }

  /**
   * Calculate confidence score based on data quality
   */
  private calculateConfidence(dataPoints: TrendDataPoint[], r2: number): number {
    // Factors affecting confidence:
    // 1. R² value (goodness of fit)
    // 2. Number of data points
    // 3. Data recency and distribution
    
    let confidence = 0;

    // R² contribution (0-60 points)
    confidence += Math.max(0, Math.min(60, r2 * 60));

    // Data points contribution (0-25 points)
    // More points = higher confidence, capped at 20+ points
    const pointsScore = Math.min(25, (dataPoints.length / 20) * 25);
    confidence += pointsScore;

    // Data distribution contribution (0-15 points)
    // Check if data is evenly distributed over time
    if (dataPoints.length >= 2) {
      const timeSpan = dataPoints[dataPoints.length - 1].timestamp.getTime() - 
                       dataPoints[0].timestamp.getTime();
      const avgInterval = timeSpan / (dataPoints.length - 1);
      
      // Calculate variance in intervals
      let intervalVariance = 0;
      for (let i = 1; i < dataPoints.length; i++) {
        const interval = dataPoints[i].timestamp.getTime() - dataPoints[i - 1].timestamp.getTime();
        intervalVariance += (interval - avgInterval) ** 2;
      }
      intervalVariance /= (dataPoints.length - 1);
      
      // Lower variance = better distribution = higher confidence
      const distributionScore = Math.max(0, 15 - (intervalVariance / avgInterval) * 5);
      confidence += Math.min(15, distributionScore);
    }

    return Math.round(Math.max(0, Math.min(100, confidence)));
  }

  /**
   * Map prediction type to severity based on urgency
   */
  mapPredictionToSeverity(daysUntilCrossing: number, metric: string): string {
    // Critical PHI leaks are always critical
    if (metric.toLowerCase().includes('phi') || metric.toLowerCase().includes('leak')) {
      return 'critical';
    }

    // Time-based severity
    if (daysUntilCrossing <= 2) return 'critical';
    if (daysUntilCrossing <= 7) return 'high';
    if (daysUntilCrossing <= 14) return 'medium';
    return 'low';
  }

  /**
   * Map metric to prediction type
   */
  mapMetricToPredictionType(metric: string): string {
    const normalized = metric.toLowerCase();
    
    if (normalized.includes('drift')) return 'drift';
    if (normalized.includes('error')) return 'error_spike';
    if (normalized.includes('latency')) return 'latency_degradation';
    if (normalized.includes('bias')) return 'bias';
    if (normalized.includes('phi') || normalized.includes('leak')) return 'phi_exposure';
    
    return 'drift'; // Default
  }
}

export const trendAnalysisService = new TrendAnalysisService();
