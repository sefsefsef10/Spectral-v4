/**
 * Webhook Signature Verification Utilities
 * 
 * Provides HMAC-SHA256 signature verification for securing webhook endpoints.
 * Prevents unauthorized webhook events from being processed.
 */

import crypto from 'crypto';
import { logger } from '../logger';

export interface SignatureVerificationResult {
  valid: boolean;
  error?: string;
}

/**
 * Verify HMAC-SHA256 signature from webhook request
 * 
 * @param payload - Raw request body (string or Buffer)
 * @param signature - Signature from request header
 * @param secret - Webhook secret key for this service
 * @param algorithm - Signature algorithm (default: 'sha256')
 * @returns Verification result with validity and error if any
 */
export function verifyHMACSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
  algorithm: string = 'sha256'
): SignatureVerificationResult {
  try {
    // Handle different signature formats
    // Format 1: "sha256=xxxxx" (GitHub, Stripe style)
    // Format 2: "xxxxx" (raw hex)
    let expectedSignature = signature;
    if (signature.includes('=')) {
      const parts = signature.split('=');
      if (parts.length === 2) {
        expectedSignature = parts[1];
      }
    }

    // Compute expected signature
    const hmac = crypto.createHmac(algorithm, secret);
    const payloadBuffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf-8');
    hmac.update(payloadBuffer);
    const computedSignature = hmac.digest('hex');

    // Constant-time comparison to prevent timing attacks
    const valid = crypto.timingSafeEqual(
      Buffer.from(computedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    if (!valid) {
      logger.warn({
        expected: computedSignature.substring(0, 10) + '...',
        received: expectedSignature.substring(0, 10) + '...'
      }, 'Webhook signature mismatch');
    }

    return { valid };
  } catch (error) {
    logger.error({ error }, 'Error verifying webhook signature');
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generate HMAC-SHA256 signature for testing
 * 
 * @param payload - Request body to sign
 * @param secret - Secret key
 * @param algorithm - Hash algorithm (default: 'sha256')
 * @returns Signature in hex format
 */
export function generateHMACSignature(
  payload: string | Buffer,
  secret: string,
  algorithm: string = 'sha256'
): string {
  const hmac = crypto.createHmac(algorithm, secret);
  const payloadBuffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf-8');
  hmac.update(payloadBuffer);
  return hmac.digest('hex');
}

/**
 * Generate a secure random secret key for webhook signing
 * 
 * @param length - Length of secret in bytes (default: 32)
 * @returns Hex-encoded secret key
 */
export function generateWebhookSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Verify timestamp to prevent replay attacks
 * 
 * @param timestamp - Timestamp from webhook header (seconds)
 * @param maxAge - Maximum age in seconds (default: 5 minutes)
 * @returns True if timestamp is within valid range
 */
export function verifyTimestamp(
  timestamp: number,
  maxAge: number = 300
): boolean {
  const now = Math.floor(Date.now() / 1000);
  const age = Math.abs(now - timestamp);
  
  if (age > maxAge) {
    logger.warn({
      timestamp,
      age,
      maxAge
    }, 'Webhook timestamp too old (potential replay attack)');
    return false;
  }
  
  return true;
}

/**
 * Service-specific signature header mappings
 * Different services use different header names for signatures
 */
export const SIGNATURE_HEADERS: Record<string, string> = {
  langsmith: 'x-langsmith-signature',
  arize: 'x-arize-signature',
  langfuse: 'x-langfuse-signature',
  wandb: 'x-wandb-signature',
  pagerduty: 'x-pagerduty-signature',
  datadog: 'x-datadog-signature',
  twilio: 'x-twilio-signature',
  slack: 'x-slack-signature',
  epic: 'x-epic-signature',
  cerner: 'x-cerner-signature',
  athenahealth: 'x-athenahealth-signature',
  stripe: 'stripe-signature', // For future Stripe webhooks
};

/**
 * Service-specific timestamp header mappings
 */
export const TIMESTAMP_HEADERS: Record<string, string> = {
  slack: 'x-slack-request-timestamp',
  stripe: 'x-stripe-timestamp',
  // Add more as needed
};
