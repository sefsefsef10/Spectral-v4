/**
 * API LAYER: Deployment Routes
 * RESTful endpoints for deployment management with Clean Architecture integration
 */

import { Router } from 'express';
import { DeploymentController } from '../controllers/DeploymentController';
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware';
import { requireAuth } from '../../routes';

const router = Router();

// Apply rate limiting to all deployment routes
router.use(rateLimitMiddleware);

// Apply authentication to all deployment routes
router.use(requireAuth);

/**
 * @route   POST /api/deployments
 * @desc    Create and execute a new deployment
 * @access  Protected (Admin only)
 */
router.post('/', DeploymentController.createDeployment);

/**
 * @route   GET /api/deployments
 * @desc    List all deployments (with optional filters)
 * @access  Protected
 */
router.get('/', DeploymentController.listDeployments);

/**
 * @route   GET /api/deployments/:id/status
 * @desc    Get deployment status
 * @access  Protected
 */
router.get('/:id/status', DeploymentController.getDeploymentStatus);

/**
 * @route   POST /api/deployments/:id/health-check
 * @desc    Execute health checks for deployment
 * @access  Protected (Admin only)
 */
router.post('/:id/health-check', DeploymentController.executeHealthCheck);

/**
 * @route   POST /api/deployments/:id/rollback
 * @desc    Rollback deployment
 * @access  Protected (Admin only)
 */
router.post('/:id/rollback', DeploymentController.rollbackDeployment);

/**
 * @route   POST /api/deployments/:id/advance-canary
 * @desc    Advance canary deployment progress
 * @access  Protected (Admin only)
 */
router.post('/:id/advance-canary', DeploymentController.advanceCanary);

export default router;
