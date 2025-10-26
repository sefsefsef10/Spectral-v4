/**
 * 📊 BENCHMARKING ENGINE - Phase 5 Scale & Acquisition
 * 
 * Calculates industry benchmarks for AI governance metrics
 * Provides comparative analytics for acquisition positioning
 */

import { db } from "../db";
import {
  aiSystems,
  healthSystems,
  monitoringAlerts,
  executiveReports,
} from "../../shared/schema";
import { eq, sql, and } from "drizzle-orm";
import { logger } from "../logger";

export interface BenchmarkData {
  category: string;
  metricType: string;
  p50Value: number; // Median
  p90Value: number; // 90th percentile
  p99Value: number; // 99th percentile
  sampleSize: number;
  period: string;
}

export interface ComparativeAnalysis {
  yourValue: number;
  p50Benchmark: number;
  p90Benchmark: number;
  p99Benchmark: number;
  percentileRank: number;
  performanceLevel: 'top_1%' | 'top_10%' | 'above_median' | 'below_median';
  gapToTopPerformer: number;
}

export type BenchmarkCategory =
  | 'Clinical_Imaging'
  | 'Clinical_Decision_Support'
  | 'Administrative_RCM'
  | 'Operations_Optimization'
  | 'Research_Analytics'
  | 'All_Categories';

export type MetricType =
  | 'time_to_production'
  | 'compliance_score'
  | 'violation_rate'
  | 'uptime_percentage'
  | 'alert_resolution_time'
  | 'certification_pass_rate';

export class BenchmarkingEngine {
  /**
   * Calculate percentile benchmarks for a metric
   */
  async calculateBenchmarks(
    category: BenchmarkCategory,
    metricType: MetricType,
    period?: string
  ): Promise<BenchmarkData> {
    const targetPeriod = period || this.getCurrentPeriod();

    logger.info({
      category,
      metricType,
      period: targetPeriod,
    }, "Calculating benchmarks");

    // Get raw data points for this category and metric
    const dataPoints = await this.collectDataPoints(category, metricType, targetPeriod);

    if (dataPoints.length === 0) {
      throw new Error("Insufficient data for benchmark calculation");
    }

    // Calculate percentiles
    const sorted = dataPoints.sort((a, b) => a - b);
    const p50 = this.calculatePercentile(sorted, 50);
    const p90 = this.calculatePercentile(sorted, 90);
    const p99 = this.calculatePercentile(sorted, 99);

    const benchmark: BenchmarkData = {
      category,
      metricType,
      p50Value: p50,
      p90Value: p90,
      p99Value: p99,
      sampleSize: dataPoints.length,
      period: targetPeriod,
    };

    logger.info({
      category,
      metricType,
      sampleSize: dataPoints.length,
      p50,
      p90,
      p99,
    }, "Benchmarks calculated");

    return benchmark;
  }

  /**
   * Compare a value against benchmarks
   */
  async compareToBenchmarks(
    category: BenchmarkCategory,
    metricType: MetricType,
    yourValue: number
  ): Promise<ComparativeAnalysis> {
    const benchmarks = await this.calculateBenchmarks(category, metricType);
    const dataPoints = await this.collectDataPoints(category, metricType);

    // Calculate percentile rank
    const sorted = dataPoints.sort((a, b) => a - b);
    const rank = this.calculatePercentileRank(yourValue, sorted);

    // Determine performance level
    let performanceLevel: ComparativeAnalysis['performanceLevel'];
    if (rank >= 99) performanceLevel = 'top_1%';
    else if (rank >= 90) performanceLevel = 'top_10%';
    else if (rank >= 50) performanceLevel = 'above_median';
    else performanceLevel = 'below_median';

    // Gap to top performer
    const topPerformer = benchmarks.p99Value;
    const gapToTopPerformer = topPerformer - yourValue;

    const analysis: ComparativeAnalysis = {
      yourValue,
      p50Benchmark: benchmarks.p50Value,
      p90Benchmark: benchmarks.p90Value,
      p99Benchmark: benchmarks.p99Value,
      percentileRank: rank,
      performanceLevel,
      gapToTopPerformer,
    };

    return analysis;
  }

  /**
   * Get all benchmarks for a category
   */
  async getCategoryBenchmarks(
    category: BenchmarkCategory
  ): Promise<Record<MetricType, BenchmarkData>> {
    const metricTypes: MetricType[] = [
      'time_to_production',
      'compliance_score',
      'violation_rate',
      'uptime_percentage',
      'alert_resolution_time',
      'certification_pass_rate',
    ];

    const benchmarks: Partial<Record<MetricType, BenchmarkData>> = {};

    for (const metricType of metricTypes) {
      try {
        benchmarks[metricType] = await this.calculateBenchmarks(category, metricType);
      } catch (error) {
        logger.warn({
          category,
          metricType,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, "Failed to calculate benchmark");
      }
    }

    return benchmarks as Record<MetricType, BenchmarkData>;
  }

  /**
   * Collect data points for benchmark calculation
   */
  private async collectDataPoints(
    category: BenchmarkCategory,
    metricType: MetricType,
    period?: string
  ): Promise<number[]> {
    // Get AI systems in this category
    let systems = await db.select().from(aiSystems);

    if (category !== 'All_Categories') {
      systems = systems.filter(s => this.categorizeSystem(s.department) === category);
    }

    const dataPoints: number[] = [];

    switch (metricType) {
      case 'compliance_score':
        // Mock compliance scores (would come from actual compliance data)
        dataPoints.push(...systems.map(() => 70 + Math.random() * 25));
        break;

      case 'violation_rate':
        // Calculate violation rate per system
        for (const system of systems) {
          const alerts = await db
            .select()
            .from(monitoringAlerts)
            .where(eq(monitoringAlerts.aiSystemId, system.id));
          const violationRate = (alerts.length / 30) * 100; // Violations per 30 days
          dataPoints.push(violationRate);
        }
        break;

      case 'uptime_percentage':
        // Mock uptime (would come from monitoring)
        dataPoints.push(...systems.map(() => 98 + Math.random() * 2));
        break;

      case 'time_to_production':
        // Mock time to production (in days)
        dataPoints.push(...systems.map(() => 30 + Math.random() * 60));
        break;

      case 'alert_resolution_time':
        // Calculate average resolution time
        const allAlerts = await db
          .select()
          .from(monitoringAlerts)
          .where(eq(monitoringAlerts.resolved, true));

        // Mock resolution time in hours
        dataPoints.push(...allAlerts.map(() => 4 + Math.random() * 20));
        break;

      case 'certification_pass_rate':
        // Mock certification pass rate
        dataPoints.push(...Array(systems.length).fill(0).map(() => 70 + Math.random() * 25));
        break;

      default:
        throw new Error(`Unknown metric type: ${metricType}`);
    }

    return dataPoints;
  }

  /**
   * Categorize AI system by department
   */
  private categorizeSystem(department: string): BenchmarkCategory {
    const deptLower = department.toLowerCase();

    if (deptLower.includes('radiology') || deptLower.includes('imaging')) {
      return 'Clinical_Imaging';
    }
    if (deptLower.includes('clinical') || deptLower.includes('emergency')) {
      return 'Clinical_Decision_Support';
    }
    if (deptLower.includes('finance') || deptLower.includes('revenue') || deptLower.includes('billing')) {
      return 'Administrative_RCM';
    }
    if (deptLower.includes('operations') || deptLower.includes('flow')) {
      return 'Operations_Optimization';
    }
    if (deptLower.includes('research') || deptLower.includes('analytics')) {
      return 'Research_Analytics';
    }

    return 'All_Categories';
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;

    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) {
      return sortedArray[lower];
    }

    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Calculate percentile rank for a value
   */
  private calculatePercentileRank(value: number, sortedArray: number[]): number {
    if (sortedArray.length === 0) return 50;

    const position = sortedArray.filter(v => v < value).length;
    const rank = (position / sortedArray.length) * 100;

    return Math.round(rank);
  }

  /**
   * Get benchmark trends over time
   */
  async getBenchmarkTrends(
    category: BenchmarkCategory,
    metricType: MetricType,
    periods: number = 6
  ): Promise<BenchmarkData[]> {
    const trends: BenchmarkData[] = [];

    for (let i = 0; i < periods; i++) {
      const period = this.getPeriodOffset(i);
      try {
        const benchmark = await this.calculateBenchmarks(category, metricType, period);
        trends.push(benchmark);
      } catch {
        // Skip periods with insufficient data
        continue;
      }
    }

    return trends.reverse(); // Oldest to newest
  }

  /**
   * Get current period (YYYY-MM)
   */
  private getCurrentPeriod(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Get period with offset
   */
  private getPeriodOffset(monthsAgo: number): string {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Generate benchmark summary report
   */
  async generateBenchmarkReport(
    category: BenchmarkCategory
  ): Promise<{
    category: string;
    period: string;
    benchmarks: Record<string, BenchmarkData>;
    insights: string[];
  }> {
    const benchmarks = await this.getCategoryBenchmarks(category);
    const insights: string[] = [];

    // Generate insights based on benchmarks
    const complianceBenchmark = benchmarks.compliance_score;
    if (complianceBenchmark && complianceBenchmark.p50Value < 80) {
      insights.push(`Industry median compliance score is ${complianceBenchmark.p50Value.toFixed(1)}% - opportunity for improvement`);
    }

    const violationBenchmark = benchmarks.violation_rate;
    if (violationBenchmark && violationBenchmark.p50Value > 10) {
      insights.push(`Median violation rate is ${violationBenchmark.p50Value.toFixed(1)} per month - focus on prevention`);
    }

    return {
      category,
      period: this.getCurrentPeriod(),
      benchmarks,
      insights,
    };
  }
}

export const benchmarkingEngine = new BenchmarkingEngine();
