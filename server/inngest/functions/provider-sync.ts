/**
 * Provider Sync Inngest Functions
 * 
 * Scheduled and on-demand synchronization of AI systems from external providers
 */

import { inngest } from "../client";
import { logger } from "../../logger";
import { storage } from "../../storage";
import { providerSyncService } from "../../services/providers/sync-service";

/**
 * Scheduled provider sync - runs every 6 hours for all active connections
 */
export const scheduledProviderSync = inngest.createFunction(
  {
    id: "provider-sync-scheduled",
    name: "Scheduled Provider Sync",
  },
  { cron: "0 */6 * * *" }, // Every 6 hours
  async ({ step }) => {
    return await step.run("sync-all-providers", async () => {
      logger.info("Starting scheduled provider sync");
      
      try {
        // Get all health systems (we need to query connections per health system)
        const healthSystems = await storage.getAllHealthSystems();
        
        let totalSystemsDiscovered = 0;
        let totalSystemsCreated = 0;
        let totalSystemsUpdated = 0;
        let totalErrors = 0;
        
        for (const healthSystem of healthSystems) {
          // Get all active provider connections for this health system
          const connections = await storage.getProviderConnections(healthSystem.id);
          
          for (const connection of connections) {
            // Skip if sync is disabled or status is not active
            if (!connection.syncEnabled || connection.status !== 'active') {
              continue;
            }
            
            // Check if sync is due based on interval
            const now = new Date();
            const lastSync = connection.lastSyncAt;
            
            if (lastSync) {
              const nextSyncTime = new Date(
                lastSync.getTime() + connection.syncIntervalMinutes * 60 * 1000
              );
              
              // Skip if not due yet
              if (now < nextSyncTime) {
                logger.debug({
                  connectionId: connection.id,
                  providerType: connection.providerType,
                  nextSyncDue: nextSyncTime,
                }, 'Skipping sync - not due yet');
                continue;
              }
            }
            
            // Perform sync
            try {
              const result = await providerSyncService.syncConnection(connection.id);
              
              totalSystemsDiscovered += result.systemsDiscovered;
              totalSystemsCreated += result.systemsCreated;
              totalSystemsUpdated += result.systemsUpdated;
              totalErrors += result.errors.length;
              
              logger.info({
                connectionId: connection.id,
                providerType: result.providerType,
                systemsDiscovered: result.systemsDiscovered,
                systemsCreated: result.systemsCreated,
                systemsUpdated: result.systemsUpdated,
                errors: result.errors.length,
              }, 'Provider sync completed');
              
            } catch (error) {
              totalErrors++;
              logger.error({
                err: error,
                connectionId: connection.id,
                providerType: connection.providerType,
              }, 'Provider sync failed');
            }
          }
        }
        
        logger.info({
          healthSystemsProcessed: healthSystems.length,
          totalSystemsDiscovered,
          totalSystemsCreated,
          totalSystemsUpdated,
          totalErrors,
        }, 'Scheduled provider sync completed');
        
        return {
          healthSystemsProcessed: healthSystems.length,
          totalSystemsDiscovered,
          totalSystemsCreated,
          totalSystemsUpdated,
          totalErrors,
        };
        
      } catch (error) {
        logger.error({ err: error }, 'Scheduled provider sync failed');
        throw error;
      }
    });
  }
);

/**
 * On-demand provider sync triggered by user
 */
export const onDemandProviderSync = inngest.createFunction(
  {
    id: "provider-sync-on-demand",
    name: "On-Demand Provider Sync",
    retries: 2,
  },
  { event: "provider/sync.trigger" },
  async ({ event, step }) => {
    const { connectionId, triggeredBy } = event.data;
    
    return await step.run("sync-provider", async () => {
      logger.info({
        connectionId,
        triggeredBy,
      }, 'Starting on-demand provider sync');
      
      try {
        const result = await providerSyncService.syncConnection(connectionId);
        
        logger.info({
          connectionId,
          providerType: result.providerType,
          systemsDiscovered: result.systemsDiscovered,
          systemsCreated: result.systemsCreated,
          systemsUpdated: result.systemsUpdated,
          errors: result.errors.length,
        }, 'On-demand provider sync completed');
        
        return result;
        
      } catch (error) {
        logger.error({
          err: error,
          connectionId,
        }, 'On-demand provider sync failed');
        throw error;
      }
    });
  }
);
