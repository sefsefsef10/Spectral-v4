/**
 * CertificationApplicationRepository Interface
 * 
 * Domain layer defines WHAT we need, not HOW it's implemented.
 * Infrastructure layer will provide the Drizzle implementation.
 */

import { CertificationApplication } from '../entities/CertificationApplication';

export interface CertificationApplicationRepository {
  /**
   * Find application by unique ID
   * Returns null if not found
   */
  findById(id: string): Promise<CertificationApplication | null>;

  /**
   * Find all applications for a vendor
   */
  findByVendorId(vendorId: string): Promise<CertificationApplication[]>;

  /**
   * Find all applications in a specific status
   */
  findByStatus(status: string): Promise<CertificationApplication[]>;

  /**
   * Save application (create or update)
   * Returns saved application
   */
  save(application: CertificationApplication): Promise<CertificationApplication>;

  /**
   * Check if application exists
   */
  exists(id: string): Promise<boolean>;
}

/**
 * DeploymentRepository Interface
 * 
 * Repository for querying vendor deployments
 */
export interface DeploymentRepository {
  /**
   * Get all deployments for a vendor
   */
  findByVendorId(vendorId: string): Promise<Deployment[]>;

  /**
   * Get count of active deployments for a vendor
   */
  countActiveByVendorId(vendorId: string): Promise<number>;
}

export interface Deployment {
  id: string;
  vendorId: string;
  status: string;
}
