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

export interface VerifySignatureOptions {
  payload: string | Buffer;
  signature: string;
  secret: string;
  algorithm?: string;
  serviceName?: string;
  timestamp?: string;
  requestUrl?: string;
}

/**
 * Verify HMAC-SHA256 signature from webhook request with service-specific logic
 * 
 * @param options - Verification options including service-specific parameters
 * @returns Verification result with validity and error if any
 */
export function verifyHMACSignature(
  options: VerifySignatureOptions
): SignatureVerificationResult {
  try {
    const { payload, signature, secret, algorithm = 'sha256', serviceName, timestamp, requestUrl } = options;
    
    // Handle different signature formats
    // Format 1: "sha256=xxxxx" (GitHub, Stripe style)
    // Format 2: "v0=xxxxx" (Slack style)
    // Format 3: "xxxxx" (raw hex)
    let expectedSignature = signature;
    let signaturePrefix = '';
    
    if (signature.includes('=')) {
      const parts = signature.split('=');
      if (parts.length === 2) {
        signaturePrefix = parts[0];
        expectedSignature = parts[1];
      }
    }

    // Construct canonical string based on service
    let canonicalString: Buffer;
    let signatureEncoding: 'hex' | 'base64' = 'hex'; // Default to hex
    
    if (serviceName === 'slack' && timestamp) {
      // Slack: v0:{timestamp}:{rawBody}
      const baseString = `v0:${timestamp}:${Buffer.isBuffer(payload) ? payload.toString('utf-8') : payload}`;
      canonicalString = Buffer.from(baseString, 'utf-8');
    } else if (serviceName === 'twilio' && requestUrl) {
      // Twilio: {URL}{param1=value1param2=value2...} (sorted params)
      // Note: Twilio uses SHA-1 and Base64 encoding, NOT SHA-256 and hex
      const params = Buffer.isBuffer(payload) ? payload.toString('utf-8') : payload;
      const baseString = `${requestUrl}${params}`;
      canonicalString = Buffer.from(baseString, 'utf-8');
      signatureEncoding = 'base64';
    } else {
      // Standard: just the raw payload
      canonicalString = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf-8');
    }

    // Compute expected signature
    const hmac = crypto.createHmac(algorithm, secret);
    hmac.update(canonicalString);
    const computedSignature = hmac.digest(signatureEncoding);

    // Constant-time comparison to prevent timing attacks
    const valid = crypto.timingSafeEqual(
      Buffer.from(computedSignature, signatureEncoding),
      Buffer.from(expectedSignature, signatureEncoding)
    );

    if (!valid) {
      logger.warn({
        service: serviceName,
        expected: computedSignature.substring(0, 10) + '...',
        received: expectedSignature.substring(0, 10) + '...',
        signaturePrefix
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

/**
 * Normalize Twilio form parameters for signature verification
 * Twilio requires parameters to be sorted alphabetically and concatenated
 * 
 * @param params - Form parameters object
 * @returns Normalized parameter string (e.g., "Param1value1Param2value2")
 */
export function normalizeTwilioParams(params: Record<string, any>): string {
  const sortedKeys = Object.keys(params).sort();
  let result = '';
  for (const key of sortedKeys) {
    result += key + params[key];
  }
  return result;
}
