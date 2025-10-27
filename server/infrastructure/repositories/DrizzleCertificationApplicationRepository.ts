/**
 * Drizzle ORM Implementation of CertificationApplicationRepository
 * 
 * Maps between domain entities and database persistence.
 * This is the infrastructure layer - it knows about Drizzle, PostgreSQL, and database models.
 */

import { db } from '../../db';
import { certificationApplications } from '../../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import {
  CertificationApplication,
  CertificationTier,
  ApplicationStatus,
  type ComplianceStatements
} from '../../domain/entities/CertificationApplication';
import type { CertificationApplicationRepository } from '../../domain/repositories/CertificationApplicationRepository';

export class DrizzleCertificationApplicationRepository implements CertificationApplicationRepository {
  async findById(id: string): Promise<CertificationApplication | null> {
    const [row] = await db
      .select()
      .from(certificationApplications)
      .where(eq(certificationApplications.id, id))
      .limit(1);

    if (!row) {
      return null;
    }

    return this.toDomain(row);
  }

  async findByVendorId(vendorId: string): Promise<CertificationApplication[]> {
    const rows = await db
      .select()
      .from(certificationApplications)
      .where(eq(certificationApplications.vendorId, vendorId))
      .orderBy(desc(certificationApplications.createdAt));

    return rows.map(row => this.toDomain(row));
  }

  async findByStatus(status: string): Promise<CertificationApplication[]> {
    const rows = await db
      .select()
      .from(certificationApplications)
      .where(eq(certificationApplications.status, status))
      .orderBy(desc(certificationApplications.createdAt));

    return rows.map(row => this.toDomain(row));
  }

  async save(application: CertificationApplication): Promise<CertificationApplication> {
    const data = this.toDatabase(application);

    const [saved] = await db
      .insert(certificationApplications)
      .values(data)
      .onConflictDoUpdate({
        target: certificationApplications.id,
        set: {
          status: data.status,
          automatedChecksPassed: data.automatedChecksPassed,
          automatedChecksResult: data.automatedChecksResult,
          score: data.score,
          updatedAt: new Date()
        }
      })
      .returning();

    return this.toDomain(saved);
  }

  async exists(id: string): Promise<boolean> {
    const [row] = await db
      .select({ id: certificationApplications.id })
      .from(certificationApplications)
      .where(eq(certificationApplications.id, id))
      .limit(1);

    return !!row;
  }

  /**
   * Map database row to domain entity
   */
  private toDomain(row: any): CertificationApplication {
    // Parse compliance statements from JSON string
    let complianceStatements: ComplianceStatements;
    try {
      complianceStatements = row.complianceStatements 
        ? JSON.parse(row.complianceStatements)
        : { hipaa: false, nist: false };
    } catch (error) {
      complianceStatements = { hipaa: false, nist: false };
    }

    return CertificationApplication.reconstitute(
      row.id,
      row.vendorId,
      row.tierRequested as CertificationTier,
      row.documentationUrls || [],
      complianceStatements,
      row.apiEndpoint || null,
      row.status as ApplicationStatus,
      row.automatedChecksPassed || false,
      row.automatedChecksResult || null,
      row.score || 0,
      new Date(row.createdAt),
      new Date(row.updatedAt || row.createdAt) // Fallback to createdAt if updatedAt doesn't exist
    );
  }

  /**
   * Map domain entity to database model
   */
  private toDatabase(application: CertificationApplication): any {
    return {
      id: application.id,
      vendorId: application.vendorId,
      tierRequested: application.tierRequested,
      status: application.status,
      documentationUrls: application.documentationUrls,
      complianceStatements: JSON.stringify(application.complianceStatements),
      apiEndpoint: application.apiEndpoint,
      automatedChecksPassed: application.automatedChecksPassed,
      automatedChecksResult: application.automatedChecksResult,
      score: application.score,
      submittedAt: application.createdAt,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt
    };
  }
}
