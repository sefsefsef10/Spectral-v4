/**
 * SSO Auto-Provisioning Service
 * 
 * Automatically creates health systems, vendors, and users on SSO login
 * Maps WorkOS organizations to Spectral entities with role-based access
 */

import { db } from '../db';
import { healthSystems, vendors, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../logger';
import bcrypt from 'bcryptjs';

export interface WorkOSProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  organizationId?: string;
  organizationName?: string;
  role?: string;
}

export interface ProvisioningResult {
  success: boolean;
  userId: string;
  healthSystemId?: string;
  vendorId?: string;
  created: {
    user: boolean;
    healthSystem: boolean;
    vendor: boolean;
  };
  error?: string;
}

export class SSOAutoProvisioning {
  /**
   * Provision user and organization from WorkOS SSO login
   */
  async provisionFromSSO(profile: WorkOSProfile): Promise<ProvisioningResult> {
    try {
      logger.info({
        email: profile.email,
        organizationId: profile.organizationId,
        organizationName: profile.organizationName,
      }, 'Starting SSO auto-provisioning');

      let healthSystemId: string | undefined;
      let vendorId: string | undefined;
      const created = {
        user: false,
        healthSystem: false,
        vendor: false,
      };

      // Step 1: Check if user already exists
      const existingUsers = await db
        .select()
        .from(users)
        .where(eq(users.email, profile.email))
        .limit(1);

      if (existingUsers.length > 0) {
        const existingUser = existingUsers[0];
        
        logger.info({
          email: profile.email,
          userId: existingUser.id,
        }, 'User already exists - skipping provisioning');

        return {
          success: true,
          userId: existingUser.id,
          healthSystemId: existingUser.healthSystemId ?? undefined,
          vendorId: existingUser.vendorId ?? undefined,
          created,
        };
      }

      // Step 2: Determine entity type and provision organization
      const isVendor = this.isVendorEmail(profile.email);
      
      if (isVendor) {
        vendorId = await this.provisionVendor(profile);
        created.vendor = !!vendorId;
      } else {
        healthSystemId = await this.provisionHealthSystem(profile);
        created.healthSystem = !!healthSystemId;
      }

      // Step 3: Create user
      const userId = await this.provisionUser(profile, healthSystemId, vendorId);
      created.user = !!userId;

      logger.info({
        email: profile.email,
        userId,
        healthSystemId,
        vendorId,
        created,
      }, 'SSO auto-provisioning complete');

      return {
        success: true,
        userId,
        healthSystemId,
        vendorId,
        created,
      };
    } catch (error) {
      logger.error({ err: error, profile }, 'SSO auto-provisioning failed');
      
      return {
        success: false,
        userId: '',
        created: {
          user: false,
          healthSystem: false,
          vendor: false,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Provision or retrieve health system
   */
  private async provisionHealthSystem(profile: WorkOSProfile): Promise<string> {
    const organizationName = profile.organizationName || this.extractDomain(profile.email);

    // Check if health system already exists
    const existing = await db
      .select()
      .from(healthSystems)
      .where(eq(healthSystems.name, organizationName))
      .limit(1);

    if (existing.length > 0) {
      logger.info({ healthSystemId: existing[0].id }, 'Health system already exists');
      return existing[0].id;
    }

    // Create new health system
    const result = await db
      .insert(healthSystems)
      .values({
        name: organizationName,
        tier: 'foundation', // Start with Foundation tier
        billingStatus: 'active',
        autoRenewal: true,
      })
      .returning();

    logger.info({ healthSystemId: result[0].id, name: organizationName }, 'Created new health system');
    
    return result[0].id;
  }

  /**
   * Provision or retrieve vendor
   */
  private async provisionVendor(profile: WorkOSProfile): Promise<string> {
    const vendorName = profile.organizationName || this.extractDomain(profile.email);

    // Check if vendor already exists
    const existing = await db
      .select()
      .from(vendors)
      .where(eq(vendors.name, vendorName))
      .limit(1);

    if (existing.length > 0) {
      logger.info({ vendorId: existing[0].id }, 'Vendor already exists');
      return existing[0].id;
    }

    // Create new vendor
    const result = await db
      .insert(vendors)
      .values({
        name: vendorName,
        certificationStatus: 'pending', // Needs certification
      })
      .returning();

    logger.info({ vendorId: result[0].id, name: vendorName }, 'Created new vendor');
    
    return result[0].id;
  }

  /**
   * Provision user
   */
  private async provisionUser(
    profile: WorkOSProfile,
    healthSystemId?: string,
    vendorId?: string
  ): Promise<string> {
    // Map WorkOS role to Spectral role
    const role = this.mapRole(profile.role, !!vendorId);

    // Generate random password (user won't need it with SSO)
    const password = await bcrypt.hash(Math.random().toString(36), 10);

    const result = await db
      .insert(users)
      .values({
        email: profile.email,
        password,
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        role,
        healthSystemId: healthSystemId || null,
        vendorId: vendorId || null,
        emailVerified: true, // SSO users are pre-verified
        ssoProvider: 'workos',
        ssoProviderId: profile.id,
      })
      .returning();

    logger.info({
      userId: result[0].id,
      email: profile.email,
      role,
    }, 'Created new user');

    return result[0].id;
  }

  /**
   * Determine if email belongs to a vendor
   */
  private isVendorEmail(email: string): boolean {
    const vendorDomains = [
      'ai.com',
      'ml.com',
      'healthtech.com',
      // Add known vendor domains
    ];

    const domain = email.split('@')[1];
    return vendorDomains.includes(domain);
  }

  /**
   * Extract domain name from email
   */
  private extractDomain(email: string): string {
    const domain = email.split('@')[1];
    return domain
      .split('.')[0]
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Map WorkOS role to Spectral role
   */
  private mapRole(workosRole?: string, isVendor?: boolean): string {
    if (isVendor) {
      return 'vendor';
    }

    const roleMap: Record<string, string> = {
      'admin': 'super_admin',
      'owner': 'super_admin',
      'member': 'health_system',
      'viewer': 'health_system',
    };

    return roleMap[workosRole?.toLowerCase() || ''] || 'health_system';
  }

  /**
   * Sync organization from WorkOS
   */
  async syncOrganization(organizationId: string, organizationData: any): Promise<void> {
    try {
      logger.info({ organizationId }, 'Syncing organization from WorkOS');

      // Update health system or vendor with latest data
      const name = organizationData.name;
      
      // Try health system first
      const healthSystem = await db
        .select()
        .from(healthSystems)
        .where(eq(healthSystems.name, name))
        .limit(1);

      if (healthSystem.length > 0) {
        await db
          .update(healthSystems)
          .set({
            name: organizationData.name,
            updatedAt: new Date(),
          })
          .where(eq(healthSystems.id, healthSystem[0].id));

        logger.info({ healthSystemId: healthSystem[0].id }, 'Synced health system');
        return;
      }

      // Try vendor
      const vendor = await db
        .select()
        .from(vendors)
        .where(eq(vendors.name, name))
        .limit(1);

      if (vendor.length > 0) {
        await db
          .update(vendors)
          .set({
            name: organizationData.name,
            updatedAt: new Date(),
          })
          .where(eq(vendors.id, vendor[0].id));

        logger.info({ vendorId: vendor[0].id }, 'Synced vendor');
      }
    } catch (error) {
      logger.error({ err: error, organizationId }, 'Failed to sync organization');
    }
  }
}

// Singleton instance
export const ssoAutoProvisioning = new SSOAutoProvisioning();
