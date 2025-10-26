/**
 * Retry Utility with Exponential Backoff
 * 
 * Provides resilient retry logic for transient failures in notification systems
 * and external API calls. Uses exponential backoff with jitter to avoid thundering herd.
 */

import { logger } from "../logger";

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
  retryableErrors?: (error: any) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: any;
  attempts: number;
  totalDelayMs: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 30000, // 30 seconds
  backoffMultiplier: 2,
  jitter: true,
  retryableErrors: (error: any) => {
    // Retry on network errors, timeouts, and 5xx server errors
    if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT' || error?.code === 'ENOTFOUND') {
      return true;
    }
    if (error?.response?.status >= 500 && error?.response?.status < 600) {
      return true;
    }
    if (error?.statusCode >= 500 && error?.statusCode < 600) {
      return true;
    }
    // Rate limiting (429) should also be retried
    if (error?.response?.status === 429 || error?.statusCode === 429) {
      return true;
    }
    return false;
  },
};

/**
 * Execute a function with retry logic and exponential backoff
 * 
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns RetryResult with success status, result/error, and metrics
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  let lastError: any;
  let totalDelayMs = 0;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await fn();
      
      if (attempt > 0) {
        logger.info({ 
          attempt: attempt + 1, 
          totalDelayMs,
          maxRetries: opts.maxRetries + 1 
        }, `Retry succeeded after ${attempt} failed attempt(s)`);
      }
      
      return {
        success: true,
        result,
        attempts: attempt + 1,
        totalDelayMs,
      };
    } catch (error) {
      lastError = error;
      
      // Check if we should retry this error
      const shouldRetry = opts.retryableErrors(error);
      
      // If this is the last attempt or error is not retryable, don't retry
      if (attempt >= opts.maxRetries || !shouldRetry) {
        logger.error({ 
          err: error, 
          attempt: attempt + 1,
          shouldRetry,
          maxRetries: opts.maxRetries + 1,
          totalDelayMs
        }, shouldRetry 
          ? `All retry attempts exhausted` 
          : `Error not retryable, giving up`
        );
        
        return {
          success: false,
          error: lastError,
          attempts: attempt + 1,
          totalDelayMs,
        };
      }
      
      // Calculate delay with exponential backoff
      const baseDelay = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelayMs
      );
      
      // Add jitter to prevent thundering herd (random ±25%)
      const jitterFactor = opts.jitter 
        ? 0.75 + Math.random() * 0.5 
        : 1;
      const delayMs = Math.floor(baseDelay * jitterFactor);
      
      totalDelayMs += delayMs;
      
      logger.warn({ 
        err: error,
        attempt: attempt + 1, 
        maxRetries: opts.maxRetries + 1,
        delayMs,
        totalDelayMs,
        nextAttempt: attempt + 2
      }, `Retry attempt ${attempt + 1} failed, retrying after ${delayMs}ms delay`);
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // This should never be reached due to the loop logic, but TypeScript requires it
  return {
    success: false,
    error: lastError,
    attempts: opts.maxRetries + 1,
    totalDelayMs,
  };
}

/**
 * Batch retry helper - retries multiple operations in parallel
 * Returns array of results with success/failure for each
 */
export async function retryBatch<T>(
  operations: Array<() => Promise<T>>,
  options: RetryOptions = {}
): Promise<Array<RetryResult<T>>> {
  const results = await Promise.all(
    operations.map(op => retryWithBackoff(op, options))
  );
  
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  
  logger.info({ 
    total: results.length,
    succeeded: successCount,
    failed: failureCount
  }, `Batch retry complete: ${successCount}/${results.length} succeeded`);
  
  return results;
}
