/**
 * API LAYER: Alert Routes
 * RESTful endpoints for alert management with Clean Architecture integration
 */

import { Router } from 'express';
import { AlertController } from '../controllers/AlertController';
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware';
import { requireAuth } from '../../routes';

const router = Router();

// Apply rate limiting to all alert routes
router.use(rateLimitMiddleware);

// Apply authentication to all alert routes
router.use(requireAuth);

/**
 * @route   POST /api/alerts
 * @desc    Create a new alert
 * @access  Protected
 */
router.post('/', AlertController.createAlert);

/**
 * @route   GET /api/alerts
 * @desc    List all alerts (with optional filters)
 * @access  Protected
 */
router.get('/', AlertController.listAlerts);

/**
 * @route   GET /api/alerts/:id
 * @desc    Get alert details
 * @access  Protected
 */
router.get('/:id', AlertController.getAlert);

/**
 * @route   PUT /api/alerts/:id/acknowledge
 * @desc    Acknowledge an alert
 * @access  Protected
 */
router.put('/:id/acknowledge', AlertController.acknowledgeAlert);

/**
 * @route   PUT /api/alerts/:id/resolve
 * @desc    Resolve an alert
 * @access  Protected
 */
router.put('/:id/resolve', AlertController.resolveAlert);

export default router;
