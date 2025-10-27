/**
 * 🔒 POLICY ADMINISTRATION API
 * 
 * Admin endpoints for managing encrypted compliance policies.
 * Restricted to admin users only.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import { migratePolicies, validatePolicyCompleteness } from '../services/translation-engine/policy-migration';
import { policyLoader } from '../services/translation-engine/policy-loader';
import { storage } from '../storage';
import { logger } from '../logger';
import { requireFeature } from '../config/feature-flags';
import { policyController } from '../api-adapters/PolicyController';

/**
 * Shared authentication middleware for health system users
 * Ensures user is authenticated and has health_system role
 */
async function requireHealthSystemAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const user = await storage.getUser(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  
  if (user.role !== 'health_system') {
    return res.status(403).json({ error: 'Health system access required' });
  }
  
  // Attach user to request for downstream use
  (req as any).user = user;
  next();
}

export function registerPolicyAdminRoutes(app: Express) {
  /**
   * POST /api/admin/policies/migrate
   * 
   * Migrate static policies to encrypted database storage (one-time setup)
   */
  app.post('/api/admin/policies/migrate', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user || user.permissions !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    try {
      logger.info({ userId: user.id }, 'Starting policy migration');
      
      await migratePolicies(user.id);
      
      // Clear cache to force reload of new policies
      policyLoader.clearCache();
      
      logger.info('Policy migration completed successfully');
      
      res.json({
        success: true,
        message: 'Policies migrated successfully - IP moat activated'
      });
    } catch (error: any) {
      logger.error({ error }, 'Policy migration failed');
      res.status(500).json({ 
        error: 'Failed to migrate policies',
        details: error.message
      });
    }
  });
  
  /**
   * GET /api/admin/policies/validate
   * 
   * Validate that all critical policies are present
   */
  app.get('/api/admin/policies/validate', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user || user.permissions !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    try {
      const isComplete = await validatePolicyCompleteness();
      
      res.json({
        success: true,
        complete: isComplete,
        message: isComplete 
          ? 'All critical policies are present'
          : 'Some critical policies are missing - run migration'
      });
    } catch (error: any) {
      logger.error({ error }, 'Policy validation failed');
      res.status(500).json({ 
        error: 'Failed to validate policies',
        details: error.message
      });
    }
  });
  
  /**
   * POST /api/admin/policies/warm-cache
   * 
   * Preload common policies into cache for performance
   */
  app.post('/api/admin/policies/warm-cache', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user || user.permissions !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    try {
      const eventTypes = [
        'phi_exposure',
        'bias_detected',
        'model_drift',
        'unauthorized_data_access',
        'clinical_accuracy_failure'
      ];
      
      await policyLoader.warmCache(eventTypes);
      
      res.json({
        success: true,
        message: 'Policy cache warmed successfully'
      });
    } catch (error: any) {
      logger.error({ error }, 'Cache warming failed');
      res.status(500).json({ 
        error: 'Failed to warm cache',
        details: error.message
      });
    }
  });
  
  /**
   * DELETE /api/admin/policies/clear-cache
   * 
   * Clear policy cache (forces reload from database)
   */
  app.delete('/api/admin/policies/clear-cache', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user || user.permissions !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    try {
      policyLoader.clearCache();
      
      res.json({
        success: true,
        message: 'Policy cache cleared'
      });
    } catch (error: any) {
      logger.error({ error }, 'Cache clearing failed');
      res.status(500).json({ 
        error: 'Failed to clear cache',
        details: error.message
      });
    }
  });

  // ✨ CLEAN ARCHITECTURE POLICY ROUTES (Phase 5)
  // Feature-flagged endpoints for refactored policy enforcement

  /**
   * POST /api/policies
   * Create a new policy rule (Clean Architecture)
   * Requires: Authentication + Health System role
   */
  app.post(
    '/api/policies',
    requireHealthSystemAuth,
    requireFeature('useCleanArchitecturePolicies'),
    (req, res) => policyController.createPolicy(req, res)
  );

  /**
   * POST /api/ai-systems/:id/evaluate-policies
   * Evaluate AI system against all applicable policies (Clean Architecture)
   * Requires: Authentication + Health System role
   */
  app.post(
    '/api/ai-systems/:id/evaluate-policies',
    requireHealthSystemAuth,
    requireFeature('useCleanArchitecturePolicies'),
    (req, res) => policyController.evaluatePolicies(req, res)
  );
}
