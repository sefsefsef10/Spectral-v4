/**
 * Provider Sync Service
 * 
 * Syncs AI systems from external providers (Epic, Cerner, LangSmith, etc.)
 * to Spectral's database
 */

import { logger } from '../../logger';
import { storage } from '../../storage';
import { ProviderRegistry } from './registry';
import { encrypt } from '../encryption';
import type { 
  ProviderConnection, 
  ProviderSyncResult, 
  ProviderAISystem,
  ProviderType,
} from './types';

export class ProviderSyncService {
  /**
   * Sync AI systems from a provider connection
   */
  async syncConnection(connectionId: string): Promise<ProviderSyncResult> {
    const startTime = Date.now();
    const connection = await storage.getProviderConnection(connectionId);
    
    if (!connection) {
      throw new Error(`Provider connection not found: ${connectionId}`);
    }
    
    if (!connection.syncEnabled) {
      throw new Error(`Sync disabled for connection: ${connectionId}`);
    }
    
    logger.info({ 
      connectionId, 
      providerType: connection.providerType,
      healthSystemId: connection.healthSystemId,
    }, 'Starting provider sync');
    
    try {
      // Get adapter for provider type
      const adapter = ProviderRegistry.getAdapter(connection.providerType as any as ProviderType);
      
      // Fetch AI systems from provider
      const providerSystems = await adapter.fetchAISystems(connection as any);
      
      logger.info({ 
        connectionId,
        systemsDiscovered: providerSystems.length,
      }, 'Provider systems fetched');
      
      // Sync systems to database
      let systemsCreated = 0;
      let systemsUpdated = 0;
      const errors: string[] = [];
      
      for (const providerSystem of providerSystems) {
        try {
          const result = await this.upsertSystem(
            connection.healthSystemId,
            providerSystem
          );
          
          if (result === 'created') {
            systemsCreated++;
          } else if (result === 'updated') {
            systemsUpdated++;
          }
          
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to sync ${providerSystem.name}: ${errorMsg}`);
          logger.error({ err: error, providerSystemId: providerSystem.providerSystemId }, 
            'Failed to upsert provider system');
        }
      }
      
      const result: ProviderSyncResult = {
        providerType: connection.providerType as ProviderType,
        systemsDiscovered: providerSystems.length,
        systemsCreated,
        systemsUpdated,
        errors,
        syncedAt: new Date(),
        durationMs: Date.now() - startTime,
      };
      
      // Update connection sync status
      await storage.updateProviderSyncStatus(connectionId, {
        lastSyncAt: new Date(),
        lastSyncStatus: errors.length === 0 ? 'success' : 'error',
        lastSyncSystemsDiscovered: result.systemsDiscovered,
        lastSyncSystemsCreated: result.systemsCreated,
        lastSyncSystemsUpdated: result.systemsUpdated,
        lastSyncError: errors.length > 0 ? errors.join('; ') : null,
        lastSyncDurationMs: result.durationMs,
      });
      
      logger.info({ 
        connectionId,
        result,
      }, 'Provider sync completed');
      
      return result;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      // Update connection with error status
      await storage.updateProviderSyncStatus(connectionId, {
        lastSyncAt: new Date(),
        lastSyncStatus: 'error',
        lastSyncError: errorMsg,
        lastSyncDurationMs: Date.now() - startTime,
      });
      
      logger.error({ err: error, connectionId }, 'Provider sync failed');
      throw error;
    }
  }
  
  /**
   * Upsert AI system from provider
   * Returns 'created' or 'updated'
   */
  private async upsertSystem(
    healthSystemId: string,
    providerSystem: ProviderAISystem
  ): Promise<'created' | 'updated' | 'skipped'> {
    // Check if system already exists (by provider ID)
    const existing = await storage.getAISystemByProviderRef(
      healthSystemId,
      providerSystem.providerType,
      providerSystem.providerSystemId
    );
    
    const systemData = {
      name: providerSystem.name,
      department: providerSystem.departmentName || providerSystem.clinicalUseCase || 'General',
      riskLevel: this.inferRiskLevel(providerSystem),
      status: this.mapDeploymentStatus(providerSystem.deploymentStatus),
      healthSystemId,
      vendorId: null, // Vendor mapping happens later (manual process)
      providerType: providerSystem.providerType,
      providerSystemId: providerSystem.providerSystemId,
      lastSyncedAt: new Date(),
    };
    
    if (existing) {
      // Update existing system
      await storage.updateAISystem(existing.id, systemData);
      return 'updated';
    } else {
      // Create new system
      await storage.createAISystem(systemData);
      return 'created';
    }
  }
  
  /**
   * Infer risk level from provider system data
   */
  private inferRiskLevel(system: ProviderAISystem): string {
    // PHI access = higher risk
    if (system.phiAccess) {
      return 'high';
    }
    
    // FDA regulated = higher risk
    if (system.fdaClassification) {
      return 'high';
    }
    
    // Clinical use cases = medium risk
    if (system.clinicalUseCase) {
      return 'medium';
    }
    
    return 'low';
  }
  
  /**
   * Map provider deployment status to Spectral status
   */
  private mapDeploymentStatus(deploymentStatus?: string): string {
    switch (deploymentStatus) {
      case 'active':
        return 'operational';
      case 'testing':
        return 'warning';
      case 'inactive':
      case 'deprecated':
        return 'critical';
      default:
        return 'operational';
    }
  }
  
  /**
   * Test provider connection
   */
  async testConnection(connectionId: string): Promise<boolean> {
    const connection = await storage.getProviderConnection(connectionId);
    
    if (!connection) {
      throw new Error(`Provider connection not found: ${connectionId}`);
    }
    
    const adapter = ProviderRegistry.getAdapter(connection.providerType as any as ProviderType);
    return adapter.testConnection(connection as any);
  }
}

export const providerSyncService = new ProviderSyncService();
