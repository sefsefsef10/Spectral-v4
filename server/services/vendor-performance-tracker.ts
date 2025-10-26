/**
 * 📊 VENDOR PERFORMANCE TRACKER - Phase 5 Scale & Acquisition
 * 
 * Aggregates vendor performance metrics across all customers
 * Generates vendor reliability scorecards for marketplace
 */

import { db } from "../db";
import {
  vendors,
  healthSystemVendorRelationships,
  complianceCertifications,
  monitoringAlerts,
  aiSystems,
} from "../../shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { logger } from "../logger";

export interface VendorPerformanceMetrics {
  vendorId: string;
  vendorName: string;
  period: string;
  customerCount: number;
  activeDeployments: number;
  averageComplianceScore: number;
  violationsCount: number;
  criticalViolations: number;
  certificationRenewalRate: number;
  uptimePercentage: number;
  reliabilityScore: number; // 0-100 composite score
  trend: 'improving' | 'stable' | 'declining';
}

export interface VendorScorecard {
  vendor: {
    id: string;
    name: string;
    certifications: string[];
  };
  performance: {
    reliabilityScore: number;
    customerCount: number;
    activeDeployments: number;
    uptimePercentage: number;
  };
  compliance: {
    averageScore: number;
    violationsCount: number;
    criticalViolations: number;
  };
  trend: {
    direction: 'improving' | 'stable' | 'declining';
    changePercentage: number;
  };
  benchmarks: {
    percentileRank: number; // 0-100 (higher is better)
    industryAverage: number;
    topPerformer: boolean;
  };
}

export class VendorPerformanceTracker {
  // Memoization cache for metrics to avoid redundant database queries
  private metricsCache: Map<string, VendorPerformanceMetrics> = new Map();

  /**
   * Get cache key for metrics
   */
  private getCacheKey(vendorId: string, period: string): string {
    return `${vendorId}:${period}`;
  }

  /**
   * Clear metrics cache (call after period changes)
   */
  clearCache(): void {
    this.metricsCache.clear();
  }

  /**
   * Calculate performance metrics for a vendor in a given period
   */
  async calculateVendorMetrics(
    vendorId: string,
    period?: string
  ): Promise<VendorPerformanceMetrics> {
    const targetPeriod = period || this.getCurrentPeriod();

    // Check cache first
    const cacheKey = this.getCacheKey(vendorId, targetPeriod);
    const cached = this.metricsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    logger.info({
      vendorId,
      period: targetPeriod,
    }, "Calculating vendor performance metrics");

    // Get vendor details
    const vendor = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (vendor.length === 0) {
      throw new Error("Vendor not found");
    }

    // Get customer relationships
    const relationships = await db
      .select()
      .from(healthSystemVendorRelationships)
      .where(
        and(
          eq(healthSystemVendorRelationships.vendorId, vendorId),
          eq(healthSystemVendorRelationships.relationshipType, 'active')
        )
      );

    const customerCount = relationships.length;

    // Get AI systems deployed by this vendor
    const systems = await db
      .select()
      .from(aiSystems)
      .where(eq(aiSystems.vendorId, vendorId));

    const activeDeployments = systems.filter(s => s.status === 'active').length;

    // Get violations (alerts) for this vendor's systems
    const systemIds = systems.map(s => s.id);
    let violationsCount = 0;
    let criticalViolations = 0;

    if (systemIds.length > 0) {
      const alerts = await db
        .select()
        .from(monitoringAlerts)
        .where(sql`${monitoringAlerts.aiSystemId} = ANY(ARRAY[${sql.join(systemIds.map(id => sql.raw(`'${id}'`)), sql`, `)}]::text[])`);

      violationsCount = alerts.length;
      criticalViolations = alerts.filter(a => a.severity === 'critical').length;
    }

    // Get certifications
    const certifications = await db
      .select()
      .from(complianceCertifications)
      .where(
        and(
          eq(complianceCertifications.vendorId, vendorId),
          eq(complianceCertifications.status, 'active')
        )
      );

    // Calculate compliance score (based on certifications and violations)
    const certificationBonus = certifications.length * 10;
    const violationPenalty = violationsCount * 2 + criticalViolations * 10;
    const averageComplianceScore = Math.max(0, Math.min(100, 70 + certificationBonus - violationPenalty));

    // Mock uptime (in production, would come from monitoring)
    const uptimePercentage = 99.5;

    // Calculate reliability score (composite)
    const reliabilityScore = this.calculateReliabilityScore({
      complianceScore: averageComplianceScore,
      uptimePercentage,
      violationsCount,
      criticalViolations,
      certificationCount: certifications.length,
    });

    // Get trend (will be calculated separately to avoid recursion)
    const trend: 'improving' | 'stable' | 'declining' = 'stable';

    const metrics: VendorPerformanceMetrics = {
      vendorId,
      vendorName: vendor[0].name,
      period: targetPeriod,
      customerCount,
      activeDeployments,
      averageComplianceScore,
      violationsCount,
      criticalViolations,
      certificationRenewalRate: 95, // Mock - would calculate from certifications table
      uptimePercentage,
      reliabilityScore,
      trend,
    };

    logger.info({
      vendorId,
      reliabilityScore,
      customerCount,
    }, "Vendor metrics calculated");

    // Cache the metrics
    this.metricsCache.set(cacheKey, metrics);

    return metrics;
  }

  /**
   * Generate comprehensive vendor scorecard
   * Optimized with optional pre-computed metrics for batching
   */
  async generateScorecard(
    vendorId: string,
    preComputedMetrics?: VendorPerformanceMetrics,
    allVendorMetrics?: VendorPerformanceMetrics[]
  ): Promise<VendorScorecard> {
    // Use pre-computed metrics if available to avoid redundant queries
    const metrics = preComputedMetrics || await this.calculateVendorMetrics(vendorId);

    // Get vendor certifications
    const certifications = await db
      .select()
      .from(complianceCertifications)
      .where(
        and(
          eq(complianceCertifications.vendorId, vendorId),
          eq(complianceCertifications.status, 'active')
        )
      );

    // Calculate benchmarks (reuse allVendorMetrics if provided)
    const allVendors = allVendorMetrics || await this.getAllVendorMetrics();
    const percentileRank = this.calculatePercentileRank(metrics.reliabilityScore, allVendors);
    const industryAverage = this.calculateIndustryAverage(allVendors);
    const topPerformer = percentileRank >= 90;

    // Get vendor info
    const vendor = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    // Calculate trend direction and change percentage
    const trend = await this.calculateTrendDirection(metrics.reliabilityScore, vendorId);
    const previousMetrics = await this.getPreviousPeriodMetrics(vendorId);
    const changePercentage = previousMetrics
      ? ((metrics.reliabilityScore - previousMetrics.reliabilityScore) / previousMetrics.reliabilityScore) * 100
      : 0;
    
    // Update metrics with actual trend
    metrics.trend = trend;

    const scorecard: VendorScorecard = {
      vendor: {
        id: vendorId,
        name: vendor[0].name,
        certifications: certifications.map(c => c.type),
      },
      performance: {
        reliabilityScore: metrics.reliabilityScore,
        customerCount: metrics.customerCount,
        activeDeployments: metrics.activeDeployments,
        uptimePercentage: metrics.uptimePercentage,
      },
      compliance: {
        averageScore: metrics.averageComplianceScore,
        violationsCount: metrics.violationsCount,
        criticalViolations: metrics.criticalViolations,
      },
      trend: {
        direction: metrics.trend,
        changePercentage: Math.round(changePercentage * 10) / 10,
      },
      benchmarks: {
        percentileRank,
        industryAverage,
        topPerformer,
      },
    };

    return scorecard;
  }

  /**
   * Get all vendor metrics for benchmarking
   * Optimized to avoid redundant database queries
   */
  private async getAllVendorMetrics(): Promise<VendorPerformanceMetrics[]> {
    const allVendors = await db.select().from(vendors);

    // Fetch all metrics with limited concurrency to avoid timeouts
    const batchSize = 5;
    const metrics: VendorPerformanceMetrics[] = [];

    for (let i = 0; i < allVendors.length; i += batchSize) {
      const batch = allVendors.slice(i, i + batchSize);
      const batchMetrics = await Promise.all(
        batch.map(v => this.calculateVendorMetrics(v.id).catch(() => null))
      );
      metrics.push(...batchMetrics.filter((m): m is VendorPerformanceMetrics => m !== null));
    }

    return metrics;
  }

  /**
   * Calculate reliability score (0-100)
   */
  private calculateReliabilityScore(factors: {
    complianceScore: number;
    uptimePercentage: number;
    violationsCount: number;
    criticalViolations: number;
    certificationCount: number;
  }): number {
    // Weighted composite score
    const complianceWeight = 0.4;
    const uptimeWeight = 0.3;
    const violationWeight = 0.2;
    const certificationWeight = 0.1;

    const complianceComponent = factors.complianceScore * complianceWeight;
    const uptimeComponent = factors.uptimePercentage * uptimeWeight;
    const violationComponent = Math.max(0, 100 - (factors.violationsCount * 5 + factors.criticalViolations * 20)) * violationWeight;
    const certificationComponent = Math.min(100, factors.certificationCount * 20) * certificationWeight;

    const score = complianceComponent + uptimeComponent + violationComponent + certificationComponent;

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * Calculate trend direction based on reliability score
   * Separate method to avoid recursion
   */
  async calculateTrendDirection(
    currentScore: number,
    vendorId: string
  ): Promise<'improving' | 'stable' | 'declining'> {
    const previousMetrics = await this.getPreviousPeriodMetrics(vendorId);

    if (!previousMetrics) {
      return 'stable';
    }

    const difference = currentScore - previousMetrics.reliabilityScore;

    if (difference > 5) return 'improving';
    if (difference < -5) return 'declining';
    return 'stable';
  }

  /**
   * Get metrics from previous period
   */
  private async getPreviousPeriodMetrics(
    vendorId: string
  ): Promise<VendorPerformanceMetrics | null> {
    const previousPeriod = this.getPreviousPeriod();

    try {
      return await this.calculateVendorMetrics(vendorId, previousPeriod);
    } catch {
      return null;
    }
  }

  /**
   * Calculate percentile rank
   */
  private calculatePercentileRank(
    score: number,
    allMetrics: VendorPerformanceMetrics[]
  ): number {
    if (allMetrics.length === 0) return 50;

    const scores = allMetrics.map(m => m.reliabilityScore).sort((a, b) => a - b);
    const position = scores.filter(s => s < score).length;
    const percentile = (position / scores.length) * 100;

    return Math.round(percentile);
  }

  /**
   * Calculate industry average
   */
  private calculateIndustryAverage(allMetrics: VendorPerformanceMetrics[]): number {
    if (allMetrics.length === 0) return 70;

    const sum = allMetrics.reduce((acc, m) => acc + m.reliabilityScore, 0);
    return Math.round(sum / allMetrics.length);
  }

  /**
   * Get top performing vendors
   * Optimized to avoid redundant database queries
   */
  async getTopPerformers(limit: number = 10): Promise<VendorScorecard[]> {
    // Clear cache at the start of batch operations
    this.clearCache();

    const allMetrics = await this.getAllVendorMetrics();

    // Pre-fetch previous period metrics for all vendors (batched)
    const previousPeriod = this.getPreviousPeriod();
    for (let i = 0; i < allMetrics.length; i += 5) {
      const batch = allMetrics.slice(i, i + 5);
      await Promise.all(
        batch.map(m => this.calculateVendorMetrics(m.vendorId, previousPeriod).catch(() => null))
      );
    }

    // Sort by reliability score
    const sorted = allMetrics.sort((a, b) => b.reliabilityScore - a.reliabilityScore);

    // Generate scorecards for top performers
    const topPerformers = sorted.slice(0, limit);
    
    // Pass pre-computed metrics and all vendor metrics to avoid redundant queries
    const scorecards = await Promise.all(
      topPerformers.map(m => this.generateScorecard(m.vendorId, m, allMetrics))
    );

    return scorecards;
  }

  /**
   * Get vendor performance history
   */
  async getPerformanceHistory(
    vendorId: string,
    periods: number = 6
  ): Promise<VendorPerformanceMetrics[]> {
    const history: VendorPerformanceMetrics[] = [];

    for (let i = 0; i < periods; i++) {
      const period = this.getPeriodOffset(i);
      try {
        const metrics = await this.calculateVendorMetrics(vendorId, period);
        history.push(metrics);
      } catch {
        // Skip periods with no data
        continue;
      }
    }

    return history.reverse(); // Oldest to newest
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
   * Get previous period
   */
  private getPreviousPeriod(): string {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = prevMonth.getFullYear();
    const month = String(prevMonth.getMonth() + 1).padStart(2, '0');
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
}

export const vendorPerformanceTracker = new VendorPerformanceTracker();
