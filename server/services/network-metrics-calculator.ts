/**
 * 📈 NETWORK METRICS CALCULATOR - Phase 2 Network Effects
 * 
 * Calculates and tracks network effects metrics daily
 * Measures the strength of the Spectral network over time
 */

import { db } from "../db";
import { 
  networkMetricsDailySnapshots,
  healthSystems,
  vendors,
  vendorAcceptances,
  spectralStandardAdoptions,
  complianceCertifications
} from "../../shared/schema";
import { eq, gte, lte, and, desc } from "drizzle-orm";
import { logger } from "../logger";

export interface NetworkSnapshot {
  snapshotDate: Date;
  totalHealthSystems: number;
  activeHealthSystems: number;
  totalVendors: number;
  certifiedVendors: number;
  totalAcceptances: number;
  spectralStandardAdopters: number;
  networkDensity: number;
  averageAcceptanceRate: number;
  newHealthSystemsThisWeek: number;
  newVendorsThisWeek: number;
  newCertificationsThisWeek: number;
}

export class NetworkMetricsCalculator {
  /**
   * Calculate and store daily network metrics
   * Should be run once per day via background job
   */
  async calculateDailyMetrics(): Promise<NetworkSnapshot> {
    logger.info("Calculating daily network metrics");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Total health systems
    const allHealthSystems = await db.select().from(healthSystems);
    const totalHealthSystems = allHealthSystems.length;

    // 2. Active health systems (those with at least one vendor acceptance)
    const acceptances = await db.select().from(vendorAcceptances);
    const activeHealthSystemIds = new Set(acceptances.map(a => a.healthSystemId));
    const activeHealthSystems = activeHealthSystemIds.size;

    // 3. Total vendors
    const allVendors = await db.select().from(vendors);
    const totalVendors = allVendors.length;

    // 4. Certified vendors (those with approved certifications)
    const certifications = await db
      .select()
      .from(complianceCertifications)
      .where(eq(complianceCertifications.status, 'approved'));
    const certifiedVendorIds = new Set(certifications.map(c => c.vendorId));
    const certifiedVendors = certifiedVendorIds.size;

    // 5. Total acceptances (accepted status only)
    const activeAcceptances = acceptances.filter(a => a.status === 'accepted');
    const totalAcceptances = activeAcceptances.length;

    // 6. Spectral Standard adopters
    const adoptions = await db.select().from(spectralStandardAdoptions);
    const spectralStandardAdopters = new Set(adoptions.map(a => a.healthSystemId)).size;

    // 7. Network density: (actual connections / possible connections)
    // Possible connections = totalHealthSystems * totalVendors
    const possibleConnections = totalHealthSystems * totalVendors;
    const networkDensity = possibleConnections > 0 
      ? totalAcceptances / possibleConnections 
      : 0;

    // 8. Average acceptance rate per health system
    const acceptancesByHealthSystem = new Map<string, number>();
    activeAcceptances.forEach(a => {
      const count = acceptancesByHealthSystem.get(a.healthSystemId) || 0;
      acceptancesByHealthSystem.set(a.healthSystemId, count + 1);
    });
    const averageAcceptanceRate = activeHealthSystems > 0
      ? totalAcceptances / activeHealthSystems
      : 0;

    // 9. New health systems this week
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const newHealthSystemsThisWeek = allHealthSystems.filter(
      hs => new Date(hs.createdAt) >= oneWeekAgo
    ).length;

    // 10. New vendors this week
    const newVendorsThisWeek = allVendors.filter(
      v => new Date(v.createdAt) >= oneWeekAgo
    ).length;

    // 11. New certifications this week
    const newCertificationsThisWeek = certifications.filter(
      c => new Date(c.createdAt) >= oneWeekAgo
    ).length;

    // Store snapshot
    await db.insert(networkMetricsDailySnapshots).values({
      snapshotDate: today,
      totalHealthSystems,
      activeHealthSystems,
      totalVendors,
      certifiedVendors,
      totalAcceptances,
      spectralStandardAdopters,
      networkDensity: networkDensity.toFixed(4),
      averageAcceptanceRate: averageAcceptanceRate.toFixed(2),
      newHealthSystemsThisWeek,
      newVendorsThisWeek,
      newCertificationsThisWeek,
    });

    logger.info({
      totalHealthSystems,
      activeHealthSystems,
      totalVendors,
      certifiedVendors,
      networkDensity: networkDensity.toFixed(4),
    }, "Daily network metrics calculated and stored");

    return {
      snapshotDate: today,
      totalHealthSystems,
      activeHealthSystems,
      totalVendors,
      certifiedVendors,
      totalAcceptances,
      spectralStandardAdopters,
      networkDensity,
      averageAcceptanceRate,
      newHealthSystemsThisWeek,
      newVendorsThisWeek,
      newCertificationsThisWeek,
    };
  }

  /**
   * Get network metrics for a specific date range
   */
  async getMetricsRange(startDate: Date, endDate: Date): Promise<NetworkSnapshot[]> {
    const snapshots = await db
      .select()
      .from(networkMetricsDailySnapshots)
      .where(
        and(
          gte(networkMetricsDailySnapshots.snapshotDate, startDate),
          lte(networkMetricsDailySnapshots.snapshotDate, endDate)
        )
      );

    return snapshots.map(s => ({
      snapshotDate: s.snapshotDate,
      totalHealthSystems: s.totalHealthSystems,
      activeHealthSystems: s.activeHealthSystems,
      totalVendors: s.totalVendors,
      certifiedVendors: s.certifiedVendors,
      totalAcceptances: s.totalAcceptances,
      spectralStandardAdopters: s.spectralStandardAdopters,
      networkDensity: parseFloat(s.networkDensity || '0'),
      averageAcceptanceRate: parseFloat(s.averageAcceptanceRate || '0'),
      newHealthSystemsThisWeek: s.newHealthSystemsThisWeek || 0,
      newVendorsThisWeek: s.newVendorsThisWeek || 0,
      newCertificationsThisWeek: s.newCertificationsThisWeek || 0,
    }));
  }

  /**
   * Get latest network snapshot
   */
  async getLatestSnapshot(): Promise<NetworkSnapshot | null> {
    const result = await db
      .select()
      .from(networkMetricsDailySnapshots)
      .orderBy(desc(networkMetricsDailySnapshots.snapshotDate))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const s = result[0];
    return {
      snapshotDate: s.snapshotDate,
      totalHealthSystems: s.totalHealthSystems,
      activeHealthSystems: s.activeHealthSystems,
      totalVendors: s.totalVendors,
      certifiedVendors: s.certifiedVendors,
      totalAcceptances: s.totalAcceptances,
      spectralStandardAdopters: s.spectralStandardAdopters,
      networkDensity: parseFloat(s.networkDensity || '0'),
      averageAcceptanceRate: parseFloat(s.averageAcceptanceRate || '0'),
      newHealthSystemsThisWeek: s.newHealthSystemsThisWeek || 0,
      newVendorsThisWeek: s.newVendorsThisWeek || 0,
      newCertificationsThisWeek: s.newCertificationsThisWeek || 0,
    };
  }

  /**
   * Calculate network effects strength score (0-100)
   * Based on key metrics that indicate strong network effects
   */
  async calculateNetworkEffectsScore(): Promise<{
    score: number;
    breakdown: {
      densityScore: number;
      adoptionScore: number;
      growthScore: number;
      standardizationScore: number;
    };
  }> {
    const latest = await this.getLatestSnapshot();
    
    if (!latest) {
      return {
        score: 0,
        breakdown: {
          densityScore: 0,
          adoptionScore: 0,
          growthScore: 0,
          standardizationScore: 0,
        },
      };
    }

    // 1. Network Density Score (0-25 points)
    // Higher density = stronger network effects
    const densityScore = Math.min(latest.networkDensity * 100, 25);

    // 2. Adoption Score (0-25 points)
    // % of health systems actively using the platform
    const adoptionRate = latest.totalHealthSystems > 0
      ? latest.activeHealthSystems / latest.totalHealthSystems
      : 0;
    const adoptionScore = adoptionRate * 25;

    // 3. Growth Score (0-25 points)
    // Recent growth indicates momentum
    const growthRate = (
      latest.newHealthSystemsThisWeek +
      latest.newVendorsThisWeek +
      latest.newCertificationsThisWeek
    ) / 10; // Normalize
    const growthScore = Math.min(growthRate, 25);

    // 4. Standardization Score (0-25 points)
    // % of health systems that adopted the Spectral Standard
    const standardizationRate = latest.totalHealthSystems > 0
      ? latest.spectralStandardAdopters / latest.totalHealthSystems
      : 0;
    const standardizationScore = standardizationRate * 25;

    const totalScore = densityScore + adoptionScore + growthScore + standardizationScore;

    logger.info({
      score: totalScore.toFixed(1),
      densityScore: densityScore.toFixed(1),
      adoptionScore: adoptionScore.toFixed(1),
      growthScore: growthScore.toFixed(1),
      standardizationScore: standardizationScore.toFixed(1),
    }, "Network effects score calculated");

    return {
      score: Math.min(totalScore, 100),
      breakdown: {
        densityScore,
        adoptionScore,
        growthScore,
        standardizationScore,
      },
    };
  }
}

export const networkMetricsCalculator = new NetworkMetricsCalculator();
