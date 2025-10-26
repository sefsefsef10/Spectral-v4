/**
 * CSRF Protection Middleware
 * 
 * Implements Double-Submit Cookie pattern with session binding
 * - Generates CSRF token stored in session
 * - Validates token on state-changing requests (POST, PUT, DELETE, PATCH)
 * - Provides /api/csrf-token endpoint for frontend to fetch token
 */

import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../logger';

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware to ensure CSRF token exists in session
 */
export function ensureCsrfToken(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  next();
}

/**
 * Middleware to validate CSRF token on state-changing requests
 */
export function validateCsrfToken(req: Request, res: Response, next: NextFunction): Response | void {
  const method = req.method.toUpperCase();
  
  // Skip CSRF validation for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return next();
  }
  
  // Skip CSRF validation for unauthenticated requests (no session = no CSRF risk)
  if (!req.session.userId) {
    return next();
  }
  
  // Skip CSRF validation for API webhooks (authenticated via other means)
  if (req.path.startsWith('/api/webhooks/')) {
    return next();
  }
  
  // Get token from header (preferred) or body
  const tokenFromRequest = req.get('X-CSRF-Token') || req.body?.csrfToken;
  const tokenFromSession = req.session.csrfToken;
  
  if (!tokenFromRequest || !tokenFromSession) {
    logger.warn({
      path: req.path,
      method: req.method,
      hasRequestToken: !!tokenFromRequest,
      hasSessionToken: !!tokenFromSession,
    }, 'CSRF validation failed: Missing token');
    return res.status(403).json({ error: 'CSRF token missing' });
  }
  
  // Use constant-time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(tokenFromRequest), Buffer.from(tokenFromSession))) {
    logger.warn({
      path: req.path,
      method: req.method,
    }, 'CSRF validation failed: Token mismatch');
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
}

/**
 * Route handler to get CSRF token
 */
export function getCsrfToken(req: Request, res: Response): Response {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  
  return res.json({ csrfToken: req.session.csrfToken });
}
