/**
 * API LAYER: User Routes
 * RESTful endpoints with Clean Architecture integration
 */

import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware';

const router = Router();

// Apply rate limiting to all user routes
router.use(rateLimitMiddleware);

/**
 * @route   POST /api/users/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', UserController.register);

/**
 * @route   PUT /api/users/:id/role
 * @desc    Update user role
 * @access  Protected (Admin only)
 */
router.put('/:id/role', UserController.updateRole);

/**
 * @route   DELETE /api/users/:id
 * @desc    Deactivate user
 * @access  Protected (Admin only)
 */
router.delete('/:id', UserController.deactivate);

/**
 * @route   POST /api/users/validate-permissions
 * @desc    Validate user permissions
 * @access  Protected
 */
router.post('/validate-permissions', UserController.validatePermissions);

export default router;
