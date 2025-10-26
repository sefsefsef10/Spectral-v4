/**
 * Rate Limiting Middleware
 * 
 * Protects API endpoints from abuse and brute force attacks
 */

import rateLimit from 'express-rate-limit';
import { logger } from '../logger';

/**
 * Strict rate limit for authentication endpoints (login, register)
 * 5 requests per 15 minutes per IP
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({ 
      ip: req.ip, 
      path: req.path 
    }, 'Authentication rate limit exceeded');
    res.status(429).json({ 
      error: 'Too many authentication attempts. Please try again in 15 minutes.' 
    });
  },
});

/**
 * Moderate rate limit for general API endpoints
 * 100 requests per 15 minutes per IP
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({ 
      ip: req.ip, 
      path: req.path 
    }, 'API rate limit exceeded');
    res.status(429).json({ 
      error: 'Too many requests. Please try again later.' 
    });
  },
});

/**
 * Very strict rate limit for MFA verification
 * 10 attempts per hour to prevent brute force
 */
export const mfaRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 attempts per hour
  message: 'Too many MFA verification attempts. Please try again in 1 hour.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({ 
      ip: req.ip, 
      path: req.path 
    }, 'MFA verification rate limit exceeded');
    res.status(429).json({ 
      error: 'Too many MFA verification attempts. Please try again in 1 hour.' 
    });
  },
});

/**
 * Webhook rate limit - higher limit for legitimate webhook traffic
 * 1000 requests per 15 minutes per IP
 */
export const webhookRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  message: 'Webhook rate limit exceeded.',
  standardHeaders: true,
  legacyHeaders: false,
});
