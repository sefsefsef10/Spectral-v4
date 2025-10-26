/**
 * Provider Connections API
 * 
 * Endpoints for managing EHR and AI platform integrations
 */

import { Router } from 'express';
import { storage } from '../storage';
import { logger } from '../logger';
import { providerSyncService } from '../services/providers/sync-service';
import { ProviderRegistry } from '../services/providers/registry';
import { inngest } from '../inngest/client';
import type { Request, Response } from 'express';

const router = Router();

/**
 * Get all provider connections for health system
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'health_system') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const healthSystemId = user.healthSystemId;
    if (!healthSystemId) {
      return res.status(400).json({ error: 'Health system ID required' });
    }
    
    const connections = await storage.getProviderConnections(healthSystemId);
    
    // Redact credentials for security - never expose secrets to clients
    const redactedConnections = connections.map(conn => ({
      ...conn,
      credentials: '[REDACTED]',
    }));
    
    res.json(redactedConnections);
    
  } catch (error) {
    logger.error({ err: error }, 'Failed to get provider connections');
    res.status(500).json({ error: 'Failed to get provider connections' });
  }
});

/**
 * Get specific provider connection
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'health_system') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const connection = await storage.getProviderConnection(req.params.id);
    
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    
    // Verify ownership
    if (connection.healthSystemId !== user.healthSystemId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Redact credentials for security - never expose secrets to clients
    const redactedConnection = {
      ...connection,
      credentials: '[REDACTED]',
    };
    
    res.json(redactedConnection);
    
  } catch (error) {
    logger.error({ err: error }, 'Failed to get provider connection');
    res.status(500).json({ error: 'Failed to get provider connection' });
  }
});

/**
 * Create new provider connection
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'health_system') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const healthSystemId = user.healthSystemId;
    if (!healthSystemId) {
      return res.status(400).json({ error: 'Health system ID required' });
    }
    
    const { providerType, baseUrl, credentials, syncEnabled, syncIntervalMinutes } = req.body;
    
    // Validate provider type
    if (!ProviderRegistry.isSupported(providerType)) {
      return res.status(400).json({ error: `Unsupported provider type: ${providerType}` });
    }
    
    // Check if connection already exists
    const existing = await storage.getProviderConnectionByType(healthSystemId, providerType);
    if (existing) {
      return res.status(409).json({ error: `Connection already exists for ${providerType}` });
    }
    
    // Validate credentials format
    const adapter = ProviderRegistry.getAdapter(providerType as any);
    if (!adapter.validateCredentials(credentials)) {
      return res.status(400).json({ error: 'Invalid credentials format' });
    }
    
    // Store credentials as JSON string for encryption
    const credentialsJson = JSON.stringify(credentials);
    
    // Create connection
    const connection = await storage.createProviderConnection({
      healthSystemId,
      providerType,
      baseUrl,
      credentials: credentialsJson,
      status: 'inactive',
      syncEnabled: syncEnabled ?? false,
      syncIntervalMinutes: syncIntervalMinutes ?? 1440, // 24 hours default
    });
    
    // Log audit event
    await storage.createAuditLog({
      userId: user.id,
      action: 'create',
      resourceType: 'provider_connection',
      resourceId: connection.id,
      resourceName: `${providerType} connection`,
      metadata: { providerType, baseUrl },
      healthSystemId,
    });
    
    // Redact credentials for security - never expose secrets to clients
    const redactedConnection = {
      ...connection,
      credentials: '[REDACTED]',
    };
    
    res.status(201).json(redactedConnection);
    
  } catch (error) {
    logger.error({ err: error }, 'Failed to create provider connection');
    res.status(500).json({ error: 'Failed to create provider connection' });
  }
});

/**
 * Update provider connection
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'health_system') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const connection = await storage.getProviderConnection(req.params.id);
    
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    
    // Verify ownership
    if (connection.healthSystemId !== user.healthSystemId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { baseUrl, credentials, syncEnabled, syncIntervalMinutes, status } = req.body;
    
    const updates: any = {};
    
    if (baseUrl !== undefined) updates.baseUrl = baseUrl;
    if (status !== undefined) updates.status = status;
    if (syncEnabled !== undefined) updates.syncEnabled = syncEnabled;
    if (syncIntervalMinutes !== undefined) updates.syncIntervalMinutes = syncIntervalMinutes;
    
    if (credentials !== undefined) {
      // Validate credentials format
      const adapter = ProviderRegistry.getAdapter(connection.providerType as any);
      if (!adapter.validateCredentials(credentials)) {
        return res.status(400).json({ error: 'Invalid credentials format' });
      }
      updates.credentials = JSON.stringify(credentials);
    }
    
    await storage.updateProviderConnection(req.params.id, updates);
    
    // Log audit event
    await storage.createAuditLog({
      userId: user.id,
      action: 'update',
      resourceType: 'provider_connection',
      resourceId: connection.id,
      resourceName: `${connection.providerType} connection`,
      metadata: { updates: Object.keys(updates) },
      healthSystemId: connection.healthSystemId,
    });
    
    // Get updated connection
    const updated = await storage.getProviderConnection(req.params.id);
    
    // Redact credentials for security - never expose secrets to clients
    const redactedUpdated = updated ? {
      ...updated,
      credentials: '[REDACTED]',
    } : null;
    
    res.json(redactedUpdated);
    
  } catch (error) {
    logger.error({ err: error }, 'Failed to update provider connection');
    res.status(500).json({ error: 'Failed to update provider connection' });
  }
});

/**
 * Delete provider connection
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'health_system') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const connection = await storage.getProviderConnection(req.params.id);
    
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    
    // Verify ownership
    if (connection.healthSystemId !== user.healthSystemId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await storage.deleteProviderConnection(req.params.id);
    
    // Log audit event
    await storage.createAuditLog({
      userId: user.id,
      action: 'delete',
      resourceType: 'provider_connection',
      resourceId: connection.id,
      resourceName: `${connection.providerType} connection`,
      healthSystemId: connection.healthSystemId,
    });
    
    res.status(204).send();
    
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete provider connection');
    res.status(500).json({ error: 'Failed to delete provider connection' });
  }
});

/**
 * Test provider connection
 */
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'health_system') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const connection = await storage.getProviderConnection(req.params.id);
    
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    
    // Verify ownership
    if (connection.healthSystemId !== user.healthSystemId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
      const success = await providerSyncService.testConnection(req.params.id);
      
      if (success) {
        // Update status to active and clear any previous errors
        await storage.updateProviderConnection(req.params.id, { 
          status: 'active',
          lastError: null 
        });
        
        res.json({ success: true, message: 'Connection successful' });
      } else {
        // Update status to error with message
        await storage.updateProviderConnection(req.params.id, { 
          status: 'error',
          lastError: 'Connection test failed - please verify credentials and base URL' 
        });
        
        res.json({ success: false, message: 'Connection failed' });
      }
    } catch (testError) {
      // Capture specific error and store in database
      const errorMessage = testError instanceof Error ? testError.message : 'Unknown connection error';
      
      await storage.updateProviderConnection(req.params.id, { 
        status: 'error',
        lastError: errorMessage 
      });
      
      logger.error({ err: testError, connectionId: req.params.id }, 'Connection test exception');
      
      res.status(500).json({ 
        error: 'Connection test failed', 
        message: errorMessage 
      });
    }
    
  } catch (error) {
    logger.error({ err: error }, 'Connection test failed');
    res.status(500).json({ error: 'Connection test failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * Trigger manual sync
 */
router.post('/:id/sync', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'health_system') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const connection = await storage.getProviderConnection(req.params.id);
    
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    
    // Verify ownership
    if (connection.healthSystemId !== user.healthSystemId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Send Inngest event for async processing
    await inngest.send({
      name: 'provider/sync.trigger',
      data: {
        connectionId: req.params.id,
        triggeredBy: user.id,
      },
    });
    
    // Log audit event
    await storage.createAuditLog({
      userId: user.id,
      action: 'trigger_sync',
      resourceType: 'provider_connection',
      resourceId: connection.id,
      resourceName: `${connection.providerType} connection`,
      healthSystemId: connection.healthSystemId,
    });
    
    res.json({ message: 'Sync triggered successfully' });
    
  } catch (error) {
    logger.error({ err: error }, 'Failed to trigger sync');
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

/**
 * Get supported provider types
 */
router.get('/meta/providers', async (req: Request, res: Response) => {
  try {
    const adapters = ProviderRegistry.getAllAdapters();
    const providers = adapters.map(adapter => ({
      type: adapter.providerType,
      category: adapter.category,
    }));
    
    res.json(providers);
    
  } catch (error) {
    logger.error({ err: error }, 'Failed to get providers');
    res.status(500).json({ error: 'Failed to get providers' });
  }
});

export default router;
