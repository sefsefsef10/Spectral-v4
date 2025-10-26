/**
 * Per-Vendor Webhook Rate Limiting
 * 
 * Prevents individual vendors from overwhelming the system while
 * allowing legitimate high-volume telemetry ingestion.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

interface VendorRateLimit {
  count: number;
  resetAt: number;
}

const vendorRateLimits = new Map<string, VendorRateLimit>();

const VENDOR_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const VENDOR_MAX_REQUESTS = 1000; // 1000 requests per vendor per 15 minutes

function cleanupExpiredLimits() {
  const now = Date.now();
  for (const [vendorId, limit] of vendorRateLimits.entries()) {
    if (now > limit.resetAt) {
      vendorRateLimits.delete(vendorId);
    }
  }
}

setInterval(cleanupExpiredLimits, 60000); // Cleanup every minute

export function perVendorWebhookRateLimit(req: Request, res: Response, next: NextFunction) {
  const vendorId = (req as any).vendorId;
  
  if (!vendorId) {
    return next();
  }
  
  const now = Date.now();
  const limit = vendorRateLimits.get(vendorId);
  
  if (!limit || now > limit.resetAt) {
    vendorRateLimits.set(vendorId, {
      count: 1,
      resetAt: now + VENDOR_WINDOW_MS,
    });
    return next();
  }
  
  if (limit.count >= VENDOR_MAX_REQUESTS) {
    logger.warn({ 
      vendorId, 
      count: limit.count,
      resetIn: Math.ceil((limit.resetAt - now) / 1000) 
    }, 'Vendor webhook rate limit exceeded');
    
    return res.status(429).json({ 
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((limit.resetAt - now) / 1000)
    });
  }
  
  limit.count++;
  next();
}
