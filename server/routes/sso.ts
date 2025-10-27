/**
 * Enterprise SSO Routes
 * 
 * WorkOS SAML/OAuth integration with auto-provisioning
 * Supports enterprise SSO, organization sync, and role mapping
 */

import { Router } from 'express';
import { getWorkOSClient, getWorkOSConfig, isWorkOSConfigured } from '../services/workos';
import { ssoAutoProvisioning } from '../services/sso-auto-provisioning';
import { storage } from '../storage';
import { logger } from '../logger';

const router = Router();

/**
 * Initiate SSO login
 * POST /api/sso/login
 */
router.post('/login', async (req, res) => {
  try {
    if (!isWorkOSConfigured()) {
      return res.status(501).json({ error: 'SSO not configured' });
    }

    const workos = getWorkOSClient();
    if (!workos) {
      return res.status(500).json({ error: 'SSO client initialization failed' });
    }

    const config = getWorkOSConfig();
    const { organizationId, provider } = req.body;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    // Generate authorization URL
    const authorizationUrl = workos.userManagement.getAuthorizationUrl({
      provider: provider || 'authkit',
      clientId: config.clientId,
      redirectUri: config.redirectUri || `${req.protocol}://${req.get('host')}/api/sso/callback`,
      state: JSON.stringify({ organizationId }),
    });

    logger.info({
      organizationId,
      provider,
    }, 'SSO login initiated');

    res.json({ authorizationUrl });
  } catch (error) {
    logger.error({ err: error }, 'Failed to initiate SSO login');
    res.status(500).json({ error: 'Failed to initiate SSO' });
  }
});

/**
 * Handle SSO callback
 * GET /api/sso/callback
 */
router.get('/callback', async (req, res) => {
  try {
    if (!isWorkOSConfigured()) {
      return res.redirect('/login?error=sso_not_configured');
    }

    const workos = getWorkOSClient();
    if (!workos) {
      return res.redirect('/login?error=sso_failed');
    }

    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      return res.redirect('/login?error=missing_code');
    }

    const config = getWorkOSConfig();

    // Exchange code for profile
    const { user, organizationId } = await workos.userManagement.authenticateWithCode({
      clientId: config.clientId,
      code,
    });

    // Auto-provision user and organization
    const provisioningResult = await ssoAutoProvisioning.provisionFromSSO({
      id: user.id,
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      organizationId: organizationId ?? undefined,
      organizationName: organizationId ?? undefined,
    });

    if (!provisioningResult.success) {
      logger.error({ error: provisioningResult.error }, 'Auto-provisioning failed');
      return res.redirect('/login?error=provisioning_failed');
    }

    // Create session
    const sessionUser = await storage.getUserById(provisioningResult.userId);
    
    if (!sessionUser) {
      return res.redirect('/login?error=user_not_found');
    }

    // Set session (assuming express-session is configured)
    req.session.userId = sessionUser.id;
    req.session.role = sessionUser.role;

    logger.info({
      userId: sessionUser.id,
      email: sessionUser.email,
      created: provisioningResult.created,
    }, 'SSO login successful');

    res.redirect('/dashboard');
  } catch (error) {
    logger.error({ err: error }, 'SSO callback failed');
    res.redirect('/login?error=sso_failed');
  }
});

/**
 * Get SSO connection status
 * GET /api/sso/status
 */
router.get('/status', async (req, res) => {
  try {
    const configured = isWorkOSConfigured();
    
    res.json({
      configured,
      provider: configured ? 'workos' : null,
      features: {
        saml: configured,
        oauth: configured,
        autoProvisioning: configured,
        orgSync: configured,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get SSO status');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Disconnect SSO (logout)
 * POST /api/sso/disconnect
 */
router.post('/disconnect', async (req, res) => {
  try {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          logger.error({ err }, 'Failed to destroy session');
          return res.status(500).json({ error: 'Logout failed' });
        }

        logger.info('SSO session disconnected');
        res.json({ message: 'Successfully logged out' });
      });
    } else {
      res.json({ message: 'No active session' });
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to disconnect SSO');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
