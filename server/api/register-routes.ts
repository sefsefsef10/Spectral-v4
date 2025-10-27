/**
 * Clean Architecture: Route Registration
 */

import type { Express } from 'express';
import userRoutes from './routes/users';
import deploymentRoutes from './routes/deployments';
import alertRoutes from './routes/alerts';
import { logger } from '../logger';

export function registerCleanArchitectureRoutes(app: Express): void {
  // User Management Routes
  app.use('/api/users', userRoutes);
  
  // Deployment Management Routes
  app.use('/api/deployments', deploymentRoutes);
  
  // Alert Management Routes
  app.use('/api/alerts', alertRoutes);
  
  logger.info('Clean Architecture routes registered', {
    routes: ['/api/users', '/api/deployments', '/api/alerts'],
  });
}
