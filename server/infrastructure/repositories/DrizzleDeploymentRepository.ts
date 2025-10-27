/**
 * Drizzle ORM Implementation of DeploymentRepository
 * 
 * Provides access to vendor deployment data for certification validation.
 */

import { db } from '../../db';
import { deployments } from '../../../shared/schema';
import { eq, and } from 'drizzle-orm';
import type { DeploymentRepository, Deployment } from '../../domain/repositories/CertificationApplicationRepository';

export class DrizzleDeploymentRepository implements DeploymentRepository {
  async findByVendorId(vendorId: string): Promise<Deployment[]> {
    const rows = await db
      .select({
        id: deployments.id,
        vendorId: deployments.vendorId,
        status: deployments.status
      })
      .from(deployments)
      .where(eq(deployments.vendorId, vendorId));

    return rows.map(row => ({
      id: row.id,
      vendorId: row.vendorId,
      status: row.status
    }));
  }

  async countActiveByVendorId(vendorId: string): Promise<number> {
    const rows = await db
      .select({
        id: deployments.id
      })
      .from(deployments)
      .where(
        and(
          eq(deployments.vendorId, vendorId),
          eq(deployments.status, 'active')
        )
      );

    return rows.length;
  }
}
