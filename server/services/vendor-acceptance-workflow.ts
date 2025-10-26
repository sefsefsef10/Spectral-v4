/**
 * 🌐 VENDOR ACCEPTANCE WORKFLOW - Phase 2 Network Effects
 * 
 * Handles health systems accepting/rejecting vendor certifications
 * Creates network effects through vendor adoption tracking
 */

import { db } from "../db";
import { 
  vendorAcceptances, 
  healthSystemVendorRelationships,
  complianceCertifications,
  vendors,
  healthSystems,
  users
} from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../logger";

export interface AcceptVendorRequest {
  healthSystemId: string;
  vendorId: string;
  certificationId?: string;
  acceptedBy: string; // User ID
  expirationDate?: Date;
  requiredInRFP?: boolean;
  notes?: string;
}

export interface RejectVendorRequest {
  healthSystemId: string;
  vendorId: string;
  certificationId?: string;
  rejectedBy: string; // User ID
  rejectionReason: string;
  notes?: string;
}

export interface VendorAcceptanceStatus {
  id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  vendor: {
    id: string;
    name: string;
    category: string | null;
  };
  certification?: {
    id: string;
    status: string;
    verifiedDate: Date | null;
  };
  acceptedDate?: Date;
  expirationDate?: Date;
  acceptedBy?: string;
  rejectionReason?: string;
  notes?: string;
}

export class VendorAcceptanceWorkflow {
  /**
   * Accept a vendor certification
   * Creates acceptance record and establishes vendor-health system relationship
   */
  async acceptVendor(request: AcceptVendorRequest): Promise<VendorAcceptanceStatus> {
    logger.info({
      healthSystemId: request.healthSystemId,
      vendorId: request.vendorId,
      certificationId: request.certificationId,
    }, "Processing vendor acceptance");

    // Check if certification exists and is approved
    if (request.certificationId) {
      const certification = await db
        .select()
        .from(complianceCertifications)
        .where(eq(complianceCertifications.id, request.certificationId))
        .limit(1);

      if (certification.length === 0) {
        throw new Error("Certification not found");
      }

      if (certification[0].status !== 'approved') {
        throw new Error("Cannot accept vendor with non-approved certification");
      }
    }

    // Check for existing acceptance
    const existing = await db
      .select()
      .from(vendorAcceptances)
      .where(
        and(
          eq(vendorAcceptances.healthSystemId, request.healthSystemId),
          eq(vendorAcceptances.vendorId, request.vendorId)
        )
      )
      .limit(1);

    let acceptanceId: string;

    if (existing.length > 0) {
      // Update existing acceptance
      const updated = await db
        .update(vendorAcceptances)
        .set({
          status: 'accepted',
          acceptedDate: new Date(),
          expirationDate: request.expirationDate,
          acceptedBy: request.acceptedBy,
          certificationId: request.certificationId,
          requiredInRFP: request.requiredInRFP || false,
          notes: request.notes,
          rejectionReason: null, // Clear any previous rejection
          updatedAt: new Date(),
        })
        .where(eq(vendorAcceptances.id, existing[0].id))
        .returning();

      acceptanceId = updated[0].id;
    } else {
      // Create new acceptance
      const created = await db
        .insert(vendorAcceptances)
        .values({
          healthSystemId: request.healthSystemId,
          vendorId: request.vendorId,
          certificationId: request.certificationId,
          status: 'accepted',
          acceptedDate: new Date(),
          expirationDate: request.expirationDate,
          acceptedBy: request.acceptedBy,
          requiredInRFP: request.requiredInRFP || false,
          notes: request.notes,
        })
        .returning();

      acceptanceId = created[0].id;
    }

    // Create or update vendor-health system relationship
    await this.upsertVendorRelationship(request.healthSystemId, request.vendorId);

    // Get full acceptance details
    const acceptance = await this.getAcceptanceStatus(acceptanceId);

    logger.info({
      acceptanceId,
      healthSystemId: request.healthSystemId,
      vendorId: request.vendorId,
    }, "Vendor acceptance completed");

    return acceptance;
  }

  /**
   * Reject a vendor certification
   */
  async rejectVendor(request: RejectVendorRequest): Promise<VendorAcceptanceStatus> {
    logger.info({
      healthSystemId: request.healthSystemId,
      vendorId: request.vendorId,
      reason: request.rejectionReason,
    }, "Processing vendor rejection");

    // Check for existing acceptance
    const existing = await db
      .select()
      .from(vendorAcceptances)
      .where(
        and(
          eq(vendorAcceptances.healthSystemId, request.healthSystemId),
          eq(vendorAcceptances.vendorId, request.vendorId)
        )
      )
      .limit(1);

    let acceptanceId: string;

    if (existing.length > 0) {
      // Update existing to rejected
      const updated = await db
        .update(vendorAcceptances)
        .set({
          status: 'rejected',
          rejectionReason: request.rejectionReason,
          notes: request.notes,
          acceptedDate: null, // Clear acceptance date
          acceptedBy: null,
          updatedAt: new Date(),
        })
        .where(eq(vendorAcceptances.id, existing[0].id))
        .returning();

      acceptanceId = updated[0].id;
    } else {
      // Create new rejection
      const created = await db
        .insert(vendorAcceptances)
        .values({
          healthSystemId: request.healthSystemId,
          vendorId: request.vendorId,
          certificationId: request.certificationId,
          status: 'rejected',
          rejectionReason: request.rejectionReason,
          notes: request.notes,
        })
        .returning();

      acceptanceId = created[0].id;
    }

    // Deactivate vendor-health system relationship when rejected
    await this.deactivateVendorRelationship(request.healthSystemId, request.vendorId);

    const acceptance = await this.getAcceptanceStatus(acceptanceId);

    logger.info({
      acceptanceId,
      healthSystemId: request.healthSystemId,
      vendorId: request.vendorId,
    }, "Vendor rejection completed");

    return acceptance;
  }

  /**
   * Get all vendor acceptances for a health system
   */
  async getHealthSystemAcceptances(healthSystemId: string): Promise<VendorAcceptanceStatus[]> {
    const acceptances = await db
      .select({
        acceptance: vendorAcceptances,
        vendor: vendors,
        certification: complianceCertifications,
      })
      .from(vendorAcceptances)
      .leftJoin(vendors, eq(vendorAcceptances.vendorId, vendors.id))
      .leftJoin(complianceCertifications, eq(vendorAcceptances.certificationId, complianceCertifications.id))
      .where(eq(vendorAcceptances.healthSystemId, healthSystemId))
      .orderBy(desc(vendorAcceptances.updatedAt));

    return acceptances.map(row => ({
      id: row.acceptance.id,
      status: row.acceptance.status as 'pending' | 'accepted' | 'rejected' | 'expired',
      vendor: {
        id: row.vendor?.id || '',
        name: row.vendor?.name || '',
        category: row.vendor?.category || null,
      },
      certification: row.certification ? {
        id: row.certification.id,
        status: row.certification.status,
        verifiedDate: row.certification.verifiedDate,
      } : undefined,
      acceptedDate: row.acceptance.acceptedDate || undefined,
      expirationDate: row.acceptance.expirationDate || undefined,
      acceptedBy: row.acceptance.acceptedBy || undefined,
      rejectionReason: row.acceptance.rejectionReason || undefined,
      notes: row.acceptance.notes || undefined,
    }));
  }

  /**
   * Get acceptance status by ID
   */
  private async getAcceptanceStatus(acceptanceId: string): Promise<VendorAcceptanceStatus> {
    const result = await db
      .select({
        acceptance: vendorAcceptances,
        vendor: vendors,
        certification: complianceCertifications,
      })
      .from(vendorAcceptances)
      .leftJoin(vendors, eq(vendorAcceptances.vendorId, vendors.id))
      .leftJoin(complianceCertifications, eq(vendorAcceptances.certificationId, complianceCertifications.id))
      .where(eq(vendorAcceptances.id, acceptanceId))
      .limit(1);

    if (result.length === 0) {
      throw new Error("Acceptance not found");
    }

    const row = result[0];
    return {
      id: row.acceptance.id,
      status: row.acceptance.status as 'pending' | 'accepted' | 'rejected' | 'expired',
      vendor: {
        id: row.vendor?.id || '',
        name: row.vendor?.name || '',
        category: row.vendor?.category || null,
      },
      certification: row.certification ? {
        id: row.certification.id,
        status: row.certification.status,
        verifiedDate: row.certification.verifiedDate,
      } : undefined,
      acceptedDate: row.acceptance.acceptedDate || undefined,
      expirationDate: row.acceptance.expirationDate || undefined,
      acceptedBy: row.acceptance.acceptedBy || undefined,
      rejectionReason: row.acceptance.rejectionReason || undefined,
      notes: row.acceptance.notes || undefined,
    };
  }

  /**
   * Create or update vendor-health system relationship
   */
  private async upsertVendorRelationship(
    healthSystemId: string,
    vendorId: string
  ): Promise<void> {
    const existing = await db
      .select()
      .from(healthSystemVendorRelationships)
      .where(
        and(
          eq(healthSystemVendorRelationships.healthSystemId, healthSystemId),
          eq(healthSystemVendorRelationships.vendorId, vendorId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing relationship
      await db
        .update(healthSystemVendorRelationships)
        .set({
          spectralVerifiedRequired: true,
          endDate: null, // Clear any previous end date
          updatedAt: new Date(),
        })
        .where(eq(healthSystemVendorRelationships.id, existing[0].id));
    } else {
      // Create new relationship
      await db.insert(healthSystemVendorRelationships).values({
        healthSystemId,
        vendorId,
        relationshipType: 'certified_vendor',
        spectralVerifiedRequired: true,
        startDate: new Date(),
      });
    }
  }

  /**
   * Deactivate vendor-health system relationship when vendor is rejected
   */
  private async deactivateVendorRelationship(
    healthSystemId: string,
    vendorId: string
  ): Promise<void> {
    const existing = await db
      .select()
      .from(healthSystemVendorRelationships)
      .where(
        and(
          eq(healthSystemVendorRelationships.healthSystemId, healthSystemId),
          eq(healthSystemVendorRelationships.vendorId, vendorId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Set end date to mark relationship as inactive
      await db
        .update(healthSystemVendorRelationships)
        .set({
          endDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(healthSystemVendorRelationships.id, existing[0].id));
    }
  }

  /**
   * Check if vendor is accepted by health system
   */
  async isVendorAccepted(healthSystemId: string, vendorId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(vendorAcceptances)
      .where(
        and(
          eq(vendorAcceptances.healthSystemId, healthSystemId),
          eq(vendorAcceptances.vendorId, vendorId),
          eq(vendorAcceptances.status, 'accepted')
        )
      )
      .limit(1);

    return result.length > 0;
  }

  /**
   * Get network metrics - how many health systems have accepted this vendor
   */
  async getVendorNetworkMetrics(vendorId: string): Promise<{
    totalAcceptances: number;
    activeAcceptances: number;
    healthSystemsReached: number;
    acceptanceRate: number;
  }> {
    const allAcceptances = await db
      .select()
      .from(vendorAcceptances)
      .where(eq(vendorAcceptances.vendorId, vendorId));

    const activeAcceptances = allAcceptances.filter(a => a.status === 'accepted');
    const uniqueHealthSystems = new Set(allAcceptances.map(a => a.healthSystemId));

    // Calculate acceptance rate (accepted / total)
    const acceptanceRate = allAcceptances.length > 0
      ? activeAcceptances.length / allAcceptances.length
      : 0;

    return {
      totalAcceptances: allAcceptances.length,
      activeAcceptances: activeAcceptances.length,
      healthSystemsReached: uniqueHealthSystems.size,
      acceptanceRate,
    };
  }
}

export const vendorAcceptanceWorkflow = new VendorAcceptanceWorkflow();
