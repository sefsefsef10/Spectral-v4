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

  /**
   * Calculate viral coefficient - how many new vendors does each health system bring?
   * Viral coefficient > 1 indicates viral growth
   */
  async calculateViralCoefficient(): Promise<number> {
    const allAcceptances = await db.select().from(vendorAcceptances).where(eq(vendorAcceptances.status, 'accepted'));
    const allHealthSystems = await db.select().from(healthSystems);
    
    if (allHealthSystems.length === 0) return 0;
    
    // Average vendor acceptances per health system
    const avgAcceptancesPerHealthSystem = allAcceptances.length / allHealthSystems.length;
    
    // Viral coefficient = new customers brought in per existing customer
    // Simplified calculation: acceptances per health system
    const viralCoefficient = avgAcceptancesPerHealthSystem;
    
    logger.info({ viralCoefficient: viralCoefficient.toFixed(2) }, "Viral coefficient calculated");
    
    return viralCoefficient;
  }

  /**
   * Calculate cross-side liquidity - ratio of vendors to health systems
   * Higher ratio = more choice for health systems
   */
  async calculateCrossSideLiquidity(): Promise<{
    vendorsPerHealthSystem: number;
    healthSystemsPerVendor: number;
    liquidity: number;
  }> {
    const healthSystemCount = (await db.select().from(healthSystems)).length;
    const vendorCount = (await db.select().from(vendors)).length;
    
    if (healthSystemCount === 0 || vendorCount === 0) {
      return { vendorsPerHealthSystem: 0, healthSystemsPerVendor: 0, liquidity: 0 };
    }
    
    const vendorsPerHealthSystem = vendorCount / healthSystemCount;
    const healthSystemsPerVendor = healthSystemCount / vendorCount;
    
    // Liquidity score: balanced marketplace has ratio close to 1
    const liquidity = Math.min(vendorsPerHealthSystem, healthSystemsPerVendor) / Math.max(vendorsPerHealthSystem, healthSystemsPerVendor);
    
    logger.info({
      vendorsPerHealthSystem: vendorsPerHealthSystem.toFixed(2),
      healthSystemsPerVendor: healthSystemsPerVendor.toFixed(2),
      liquidity: liquidity.toFixed(2),
    }, "Cross-side liquidity calculated");
    
    return {
      vendorsPerHealthSystem,
      healthSystemsPerVendor,
      liquidity,
    };
  }

  /**
   * Get vendor acceptance analytics - breakdown by health system
   */
  async getVendorAcceptanceAnalytics(): Promise<{
    totalAcceptances: number;
    acceptanceRate: number;
    topHealthSystems: Array<{
      id: string;
      name: string;
      acceptanceCount: number;
      rfpRequirement: boolean;
    }>;
    acceptancesByMonth: Array<{
      month: string;
      count: number;
    }>;
  }> {
    const allAcceptances = await db.select({
      acceptance: vendorAcceptances,
      healthSystem: healthSystems,
    })
      .from(vendorAcceptances)
      .leftJoin(healthSystems, eq(vendorAcceptances.healthSystemId, healthSystems.id));
    
    const acceptedCount = allAcceptances.filter(a => a.acceptance.status === 'accepted').length;
    const acceptanceRate = allAcceptances.length > 0 ? acceptedCount / allAcceptances.length : 0;
    
    // Group by health system
    const byHealthSystem = new Map<string, { name: string; count: number; rfpRequired: boolean }>();
    allAcceptances.forEach(a => {
      if (a.acceptance.status === 'accepted' && a.healthSystem) {
        const existing = byHealthSystem.get(a.healthSystem.id) || { name: a.healthSystem.name, count: 0, rfpRequired: false };
        existing.count++;
        if (a.acceptance.requiredInRFP) existing.rfpRequired = true;
        byHealthSystem.set(a.healthSystem.id, existing);
      }
    });
    
    const topHealthSystems = Array.from(byHealthSystem.entries())
      .map(([id, data]) => ({ id, name: data.name, acceptanceCount: data.count, rfpRequirement: data.rfpRequired }))
      .sort((a, b) => b.acceptanceCount - a.acceptanceCount)
      .slice(0, 10);
    
    // Group by month
    const acceptancesByMonth = new Map<string, number>();
    allAcceptances.forEach(a => {
      if (a.acceptance.status === 'accepted' && a.acceptance.acceptedDate) {
        const month = new Date(a.acceptance.acceptedDate).toISOString().slice(0, 7); // YYYY-MM
        acceptancesByMonth.set(month, (acceptancesByMonth.get(month) || 0) + 1);
      }
    });
    
    return {
      totalAcceptances: acceptedCount,
      acceptanceRate,
      topHealthSystems,
      acceptancesByMonth: Array.from(acceptancesByMonth.entries())
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    };
  }

  /**
   * Get RFP adoption tracking - how many health systems require Spectral in RFPs
   */
  async getRFPAdoptionMetrics(): Promise<{
    totalHealthSystems: number;
    healthSystemsRequiringSpectral: number;
    rfpAdoptionRate: number;
    spectralStandardAdopters: number;
    recentAdoptions: Array<{
      healthSystemName: string;
      adoptedDate: Date;
      publiclyAnnounced: boolean;
    }>;
  }> {
    const allHealthSystems = await db.select().from(healthSystems);
    const acceptancesWithRFP = await db.select().from(vendorAcceptances).where(eq(vendorAcceptances.requiredInRFP, true));
    const healthSystemsWithRFPRequirement = new Set(acceptancesWithRFP.map(a => a.healthSystemId));
    
    const spectralAdoptions = await db.select({
      adoption: spectralStandardAdoptions,
      healthSystem: healthSystems,
    })
      .from(spectralStandardAdoptions)
      .leftJoin(healthSystems, eq(spectralStandardAdoptions.healthSystemId, healthSystems.id))
      .orderBy(desc(spectralStandardAdoptions.announcedDate))
      .limit(10);
    
    return {
      totalHealthSystems: allHealthSystems.length,
      healthSystemsRequiringSpectral: healthSystemsWithRFPRequirement.size,
      rfpAdoptionRate: allHealthSystems.length > 0 ? healthSystemsWithRFPRequirement.size / allHealthSystems.length : 0,
      spectralStandardAdopters: spectralAdoptions.length,
      recentAdoptions: spectralAdoptions.map(a => ({
        healthSystemName: a.healthSystem?.name || 'Unknown',
        adoptedDate: a.adoption.announcedDate,
        publiclyAnnounced: a.adoption.publiclyAnnounced || false,
      })),
    };
  }
}

export const networkMetricsCalculator = new NetworkMetricsCalculator();
