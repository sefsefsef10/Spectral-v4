/**
 * 🏆 SPECTRAL STANDARD ADOPTION TRACKER - Phase 2 Network Effects
 * 
 * Tracks health systems adopting the Spectral Standard for AI procurement
 * Creates competitive moat through industry standardization
 */

import { db } from "../db";
import { spectralStandardAdoptions, healthSystems, vendorAcceptances } from "../../shared/schema";
import { eq, and, lte, desc } from "drizzle-orm";
import { logger } from "../logger";

export interface SpectralStandardAdoption {
  healthSystemId: string;
  adoptionType: 'mandatory' | 'preferred' | 'pilot' | 'observing';
  scope: string; // 'all_ai_systems', 'high_risk_only', 'new_procurements'
  categories?: string[]; // Which AI categories require Spectral certification
  announcedDate: Date;
  effectiveDate: Date;
  publiclyAnnounced?: boolean;
  pressReleaseUrl?: string;
  notes?: string;
}

export interface AdoptionStatus {
  id: string;
  healthSystem: {
    id: string;
    name: string;
    state?: string | null;
  };
  adoptionType: string;
  scope: string;
  categories?: string[];
  announcedDate: Date;
  effectiveDate: Date;
  publiclyAnnounced: boolean;
  pressReleaseUrl?: string;
  daysActive: number;
  vendorsCompliant: number;
}

export class SpectralStandardTracker {
  /**
   * Record a health system adopting the Spectral Standard
   */
  async recordAdoption(adoption: SpectralStandardAdoption): Promise<AdoptionStatus> {
    logger.info({
      healthSystemId: adoption.healthSystemId,
      adoptionType: adoption.adoptionType,
      scope: adoption.scope,
    }, "Recording Spectral Standard adoption");

    // Check if health system exists
    const healthSystem = await db
      .select()
      .from(healthSystems)
      .where(eq(healthSystems.id, adoption.healthSystemId))
      .limit(1);

    if (healthSystem.length === 0) {
      throw new Error("Health system not found");
    }

    // Create adoption record
    const created = await db
      .insert(spectralStandardAdoptions)
      .values({
        healthSystemId: adoption.healthSystemId,
        adoptionType: adoption.adoptionType,
        scope: adoption.scope,
        categories: adoption.categories ? JSON.parse(JSON.stringify(adoption.categories)) : null,
        announcedDate: adoption.announcedDate,
        effectiveDate: adoption.effectiveDate,
        publiclyAnnounced: adoption.publiclyAnnounced || false,
        pressReleaseUrl: adoption.pressReleaseUrl,
        notes: adoption.notes,
      })
      .returning();

    logger.info({
      adoptionId: created[0].id,
      healthSystemId: adoption.healthSystemId,
      publiclyAnnounced: adoption.publiclyAnnounced,
    }, "Spectral Standard adoption recorded");

    // Get full adoption status
    return this.getAdoptionStatus(created[0].id);
  }

  /**
   * Get adoption status by ID
   */
  async getAdoptionStatus(adoptionId: string): Promise<AdoptionStatus> {
    const result = await db
      .select({
        adoption: spectralStandardAdoptions,
        healthSystem: healthSystems,
      })
      .from(spectralStandardAdoptions)
      .leftJoin(healthSystems, eq(spectralStandardAdoptions.healthSystemId, healthSystems.id))
      .where(eq(spectralStandardAdoptions.id, adoptionId))
      .limit(1);

    if (result.length === 0) {
      throw new Error("Adoption not found");
    }

    const row = result[0];
    
    // Calculate days active
    const daysActive = Math.floor(
      (new Date().getTime() - new Date(row.adoption.effectiveDate).getTime()) / 
      (1000 * 60 * 60 * 24)
    );

    // Count compliant vendors (vendors accepted by this health system)
    const compliantVendors = await db
      .select()
      .from(vendorAcceptances)
      .where(
        and(
          eq(vendorAcceptances.healthSystemId, row.adoption.healthSystemId),
          eq(vendorAcceptances.status, 'accepted')
        )
      );

    return {
      id: row.adoption.id,
      healthSystem: {
        id: row.healthSystem?.id || '',
        name: row.healthSystem?.name || '',
        state: row.healthSystem?.state || null,
      },
      adoptionType: row.adoption.adoptionType,
      scope: row.adoption.scope || '',
      categories: row.adoption.categories ? JSON.parse(JSON.stringify(row.adoption.categories)) : undefined,
      announcedDate: row.adoption.announcedDate,
      effectiveDate: row.adoption.effectiveDate,
      publiclyAnnounced: row.adoption.publiclyAnnounced || false,
      pressReleaseUrl: row.adoption.pressReleaseUrl || undefined,
      daysActive,
      vendorsCompliant: compliantVendors.length,
    };
  }

  /**
   * Get all Spectral Standard adoptions
   */
  async getAllAdoptions(): Promise<AdoptionStatus[]> {
    const results = await db
      .select({
        adoption: spectralStandardAdoptions,
        healthSystem: healthSystems,
      })
      .from(spectralStandardAdoptions)
      .leftJoin(healthSystems, eq(spectralStandardAdoptions.healthSystemId, healthSystems.id))
      .orderBy(desc(spectralStandardAdoptions.announcedDate));

    const adoptionStatuses: AdoptionStatus[] = [];

    for (const row of results) {
      const daysActive = Math.floor(
        (new Date().getTime() - new Date(row.adoption.effectiveDate).getTime()) / 
        (1000 * 60 * 60 * 24)
      );

      const compliantVendors = await db
        .select()
        .from(vendorAcceptances)
        .where(
          and(
            eq(vendorAcceptances.healthSystemId, row.adoption.healthSystemId),
            eq(vendorAcceptances.status, 'accepted')
          )
        );

      adoptionStatuses.push({
        id: row.adoption.id,
        healthSystem: {
          id: row.healthSystem?.id || '',
          name: row.healthSystem?.name || '',
          state: row.healthSystem?.state || null,
        },
        adoptionType: row.adoption.adoptionType,
        scope: row.adoption.scope || '',
        categories: row.adoption.categories ? JSON.parse(JSON.stringify(row.adoption.categories)) : undefined,
        announcedDate: row.adoption.announcedDate,
        effectiveDate: row.adoption.effectiveDate,
        publiclyAnnounced: row.adoption.publiclyAnnounced || false,
        pressReleaseUrl: row.adoption.pressReleaseUrl || undefined,
        daysActive,
        vendorsCompliant: compliantVendors.length,
      });
    }

    return adoptionStatuses;
  }

  /**
   * Get public adoptions (for marketing/press)
   */
  async getPublicAdoptions(): Promise<AdoptionStatus[]> {
    const all = await this.getAllAdoptions();
    return all.filter(a => a.publiclyAnnounced);
  }

  /**
   * Get adoption metrics for network effects analysis
   */
  async getAdoptionMetrics(): Promise<{
    totalAdopters: number;
    mandatoryAdopters: number;
    preferredAdopters: number;
    pilotAdopters: number;
    publicAnnouncements: number;
    averageDaysToAdoption: number;
    adoptionsByMonth: Record<string, number>;
    topAdopters: Array<{
      healthSystemName: string;
      adoptionType: string;
      vendorsCompliant: number;
    }>;
  }> {
    const all = await this.getAllAdoptions();

    const totalAdopters = all.length;
    const mandatoryAdopters = all.filter(a => a.adoptionType === 'mandatory').length;
    const preferredAdopters = all.filter(a => a.adoptionType === 'preferred').length;
    const pilotAdopters = all.filter(a => a.adoptionType === 'pilot').length;
    const publicAnnouncements = all.filter(a => a.publiclyAnnounced).length;

    // Calculate average days from announced to effective
    const daysToAdoption = all.map(a => {
      const diff = new Date(a.effectiveDate).getTime() - new Date(a.announcedDate).getTime();
      return Math.floor(diff / (1000 * 60 * 60 * 24));
    });
    const averageDaysToAdoption = daysToAdoption.length > 0
      ? daysToAdoption.reduce((a, b) => a + b, 0) / daysToAdoption.length
      : 0;

    // Group adoptions by month
    const adoptionsByMonth: Record<string, number> = {};
    all.forEach(a => {
      const month = new Date(a.announcedDate).toISOString().slice(0, 7); // YYYY-MM
      adoptionsByMonth[month] = (adoptionsByMonth[month] || 0) + 1;
    });

    // Top adopters by vendor compliance
    const topAdopters = all
      .sort((a, b) => b.vendorsCompliant - a.vendorsCompliant)
      .slice(0, 10)
      .map(a => ({
        healthSystemName: a.healthSystem.name,
        adoptionType: a.adoptionType,
        vendorsCompliant: a.vendorsCompliant,
      }));

    return {
      totalAdopters,
      mandatoryAdopters,
      preferredAdopters,
      pilotAdopters,
      publicAnnouncements,
      averageDaysToAdoption,
      adoptionsByMonth,
      topAdopters,
    };
  }

  /**
   * Check if a health system has adopted the Spectral Standard
   */
  async hasAdoptedStandard(healthSystemId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(spectralStandardAdoptions)
      .where(
        and(
          eq(spectralStandardAdoptions.healthSystemId, healthSystemId),
          lte(spectralStandardAdoptions.effectiveDate, new Date())
        )
      )
      .limit(1);

    return result.length > 0;
  }

  /**
   * Get adoption type for a health system
   */
  async getAdoptionType(healthSystemId: string): Promise<string | null> {
    const result = await db
      .select()
      .from(spectralStandardAdoptions)
      .where(eq(spectralStandardAdoptions.healthSystemId, healthSystemId))
      .orderBy(desc(spectralStandardAdoptions.effectiveDate))
      .limit(1);

    return result.length > 0 ? result[0].adoptionType : null;
  }
}

export const spectralStandardTracker = new SpectralStandardTracker();
