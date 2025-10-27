/**
 * API LAYER: Rate Limiting Middleware
 * Uses Clean Architecture CheckRateLimitUseCase
 */

import { Request, Response, NextFunction } from 'express';
import { CheckRateLimitUseCase } from '../../application/rate-limiting/CheckRateLimitUseCase';
import { DrizzleRateLimitPolicyRepository } from '../../infrastructure/repositories/DrizzleRateLimitPolicyRepository';

export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Determine client ID (user ID, API key, or IP address)
    const clientId = req.user?.id || req.headers['x-api-key'] as string || req.ip || 'anonymous';

    // Initialize use case
    const repository = new DrizzleRateLimitPolicyRepository();
    const checkRateLimit = new CheckRateLimitUseCase(repository);

    // Check rate limit
    const result = await checkRateLimit.execute({ clientId });

    if (!result.allowed) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: result.retryAfter,
        tier: result.tier,
        reason: result.blockedUntil 
          ? `Blocked until ${result.blockedUntil.toISOString()}` 
          : 'Quota exceeded',
      });
      return;
    }

    // Add rate limit info to response headers
    res.setHeader('X-RateLimit-Limit-Hourly', result.hourlyLimit.toString());
    res.setHeader('X-RateLimit-Remaining-Hourly', result.hourlyRemaining.toString());
    res.setHeader('X-RateLimit-Limit-Daily', result.dailyLimit.toString());
    res.setHeader('X-RateLimit-Remaining-Daily', result.dailyRemaining.toString());

    next();
  } catch (error) {
    console.error('Rate limit middleware error:', error);
    // Fail open - don't block requests on rate limiter errors
    next();
  }
}
