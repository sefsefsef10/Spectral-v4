import { db } from '../db';
import { complianceControlVersions, complianceControls } from '../../shared/schema';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { logger } from '../logger';

/**
 * Compliance Control Versioning Service
 * 
 * Manages semantic versioning for compliance controls to track regulatory updates
 * and maintain audit trail of control changes over time.
 * 
 * Features:
 * - Semantic versioning (MAJOR.MINOR.PATCH)
 * - Change tracking with JSONB diff
 * - Effective/deprecated date management
 * - Version history and rollback support
 * - Automatic version bumping
 */

export interface ControlVersion {
  id: string;
  controlId: string;
  version: string;
  changes: any;
  effectiveDate: Date;
  deprecatedDate: Date | null;
  createdAt: Date;
}

export interface VersionChanges {
  added?: string[];
  removed?: string[];
  modified?: {
    field: string;
    oldValue?: any;
    newValue?: any;
  }[];
  reason?: string;
}

export class ComplianceControlVersioningService {
  /**
   * Create a new version of a compliance control
   */
  async createVersion(
    controlId: string,
    versionType: 'major' | 'minor' | 'patch',
    changes: VersionChanges,
    effectiveDate: Date = new Date()
  ): Promise<ControlVersion> {
    logger.info({ controlId, versionType }, 'Creating new control version');

    // Get current version
    const currentVersion = await this.getCurrentVersion(controlId);
    
    // For first initialization, start at 1.0.0 without bumping
    const newVersion = currentVersion 
      ? this.bumpVersion(currentVersion, versionType)
      : '1.0.0';

    // Deprecate previous version if exists
    if (currentVersion) {
      await this.deprecateVersion(controlId, currentVersion, effectiveDate);
    }

    // Create new version
    const [version] = await db
      .insert(complianceControlVersions)
      .values({
        controlId,
        version: newVersion,
        changes,
        effectiveDate,
      })
      .returning();

    logger.info({ controlId, version: newVersion }, 'Control version created');
    return version as ControlVersion;
  }

  /**
   * Get current (active) version of a control
   */
  async getCurrentVersion(controlId: string): Promise<string | null> {
    const [version] = await db
      .select({ version: complianceControlVersions.version })
      .from(complianceControlVersions)
      .where(
        and(
          eq(complianceControlVersions.controlId, controlId),
          isNull(complianceControlVersions.deprecatedDate)
        )
      )
      .orderBy(desc(complianceControlVersions.effectiveDate))
      .limit(1);

    return version?.version || null;
  }

  /**
   * Get full version history for a control
   */
  async getVersionHistory(controlId: string): Promise<ControlVersion[]> {
    const versions = await db
      .select()
      .from(complianceControlVersions)
      .where(eq(complianceControlVersions.controlId, controlId))
      .orderBy(desc(complianceControlVersions.effectiveDate));

    return versions as ControlVersion[];
  }

  /**
   * Get specific version details
   */
  async getVersion(controlId: string, version: string): Promise<ControlVersion | null> {
    const [versionRecord] = await db
      .select()
      .from(complianceControlVersions)
      .where(
        and(
          eq(complianceControlVersions.controlId, controlId),
          eq(complianceControlVersions.version, version)
        )
      )
      .limit(1);

    return (versionRecord as ControlVersion) || null;
  }

  /**
   * Deprecate a specific version
   */
  async deprecateVersion(
    controlId: string,
    version: string,
    deprecatedDate: Date = new Date()
  ): Promise<void> {
    await db
      .update(complianceControlVersions)
      .set({ deprecatedDate })
      .where(
        and(
          eq(complianceControlVersions.controlId, controlId),
          eq(complianceControlVersions.version, version)
        )
      );

    logger.info({ controlId, version }, 'Control version deprecated');
  }

  /**
   * Get all controls that need version updates (no current version)
   */
  async getControlsNeedingVersions(): Promise<string[]> {
    const controls = await db.select({ controlId: complianceControls.controlId }).from(complianceControls);

    const needsVersion: string[] = [];
    for (const control of controls) {
      const currentVersion = await this.getCurrentVersion(control.controlId);
      if (!currentVersion) {
        needsVersion.push(control.controlId);
      }
    }

    return needsVersion;
  }

  /**
   * Initialize versioning for all existing controls
   */
  async initializeAllControlVersions(): Promise<void> {
    logger.info('Initializing versions for all compliance controls');

    const controls = await db.select({ controlId: complianceControls.controlId }).from(complianceControls);

    let initialized = 0;
    for (const control of controls) {
      const currentVersion = await this.getCurrentVersion(control.controlId);
      if (!currentVersion) {
        await this.createVersion(
          control.controlId,
          'major',
          {
            added: ['Initial version'],
            reason: 'Control catalog initialization',
          },
          new Date()
        );
        initialized++;
      }
    }

    logger.info({ initialized, total: controls.length }, 'Control versions initialized');
  }

  /**
   * Bump version number based on type
   */
  private bumpVersion(currentVersion: string, versionType: 'major' | 'minor' | 'patch'): string {
    const [major, minor, patch] = currentVersion.split('.').map(Number);

    switch (versionType) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
      default:
        throw new Error(`Invalid version type: ${versionType}`);
    }
  }

  /**
   * Get version statistics
   */
  async getVersionStats(): Promise<{
    totalControls: number;
    versionedControls: number;
    unversionedControls: number;
    totalVersions: number;
    averageVersionsPerControl: number;
  }> {
    const allControls = await db.select().from(complianceControls);
    const allVersions = await db.select().from(complianceControlVersions);

    const versionedControlIds = new Set(allVersions.map((v) => v.controlId));

    return {
      totalControls: allControls.length,
      versionedControls: versionedControlIds.size,
      unversionedControls: allControls.length - versionedControlIds.size,
      totalVersions: allVersions.length,
      averageVersionsPerControl:
        versionedControlIds.size > 0 ? allVersions.length / versionedControlIds.size : 0,
    };
  }
}

export const controlVersioningService = new ComplianceControlVersioningService();
