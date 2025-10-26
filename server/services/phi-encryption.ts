/**
 * PHI Encryption Service - HIPAA-compliant field-level encryption
 * 
 * Addresses CRITICAL gap: PHI stored in plaintext in aiTelemetryEvents/complianceViolations
 * 
 * Features:
 * - Automated PHI redaction before storage
 * - Field-level encryption for sensitive telemetry payloads
 * - Audit logging for all PHI access
 * - Tokenization for searchability
 */

import { encrypt, decrypt } from './encryption';
import { logger } from '../logger';

interface PHIRedactionResult {
  redactedText: string;
  detectedEntities: Array<{
    type: string;
    start: number;
    end: number;
    originalValue: string;
  }>;
  encrypted: boolean;
}

// PHI entity types based on HIPAA §164.514(b)(2)
const PHI_PATTERNS = {
  // Names - any person name
  NAME: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,
  
  // Email addresses
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // Phone numbers (US format)
  PHONE: /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  
  // SSN (xxx-xx-xxxx)
  SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
  
  // Medical Record Numbers (common formats)
  MRN: /\b(MRN|mrn|Medical Record|Patient ID)[:\s]*[A-Z0-9-]{6,12}\b/gi,
  
  // IP Addresses
  IP_ADDRESS: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  
  // US ZIP codes (5 or 9 digit)
  ZIP: /\b\d{5}(-\d{4})?\b/g,
  
  // Dates (various formats) - if combined with other PHI
  DATE: /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g,
};

/**
 * Redact PHI from text using regex patterns
 * This is a lightweight fallback when Presidio ML service is unavailable
 */
export function redactPHI(text: string): PHIRedactionResult {
  let redactedText = text;
  const detectedEntities: PHIRedactionResult['detectedEntities'] = [];
  
  // Apply each pattern and replace with [REDACTED_<TYPE>]
  for (const [type, pattern] of Object.entries(PHI_PATTERNS)) {
    const matches = Array.from(text.matchAll(pattern));
    
    for (const match of matches) {
      if (match.index !== undefined && match[0]) {
        detectedEntities.push({
          type,
          start: match.index,
          end: match.index + match[0].length,
          originalValue: match[0],
        });
        
        // Replace with redaction marker
        redactedText = redactedText.replace(match[0], `[REDACTED_${type}]`);
      }
    }
  }
  
  const uniqueTypes = Array.from(new Set(detectedEntities.map(e => e.type)));
  
  logger.info({
    entitiesDetected: detectedEntities.length,
    types: uniqueTypes,
  }, 'PHI redaction completed');
  
  return {
    redactedText,
    detectedEntities,
    encrypted: false,
  };
}

/**
 * Encrypt telemetry payload with PHI redaction
 * CRITICAL: This is called before storing telemetry in database
 */
export function encryptTelemetryPayload(payload: string | object): {
  encryptedPayload: string;
  phiRedacted: boolean;
  entitiesDetected: number;
} {
  try {
    // Convert to string if object
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    
    // First: Redact PHI
    const redactionResult = redactPHI(payloadString);
    
    // Second: Encrypt the redacted payload
    const encryptedPayload = encrypt(redactionResult.redactedText);
    
    // Log PHI detection for audit trail
    if (redactionResult.detectedEntities.length > 0) {
      const uniqueTypes = Array.from(new Set(redactionResult.detectedEntities.map(e => e.type)));
      logger.warn({
        entitiesDetected: redactionResult.detectedEntities.length,
        types: uniqueTypes,
      }, 'PHI detected in telemetry payload - redacted before encryption');
    }
    
    return {
      encryptedPayload,
      phiRedacted: redactionResult.detectedEntities.length > 0,
      entitiesDetected: redactionResult.detectedEntities.length,
    };
  } catch (error) {
    logger.error({ err: error }, 'Failed to encrypt telemetry payload');
    throw new Error('PHI encryption failed - cannot store telemetry');
  }
}

/**
 * Decrypt telemetry payload
 * CRITICAL: Audit log every decryption for HIPAA compliance
 */
export function decryptTelemetryPayload(
  encryptedPayload: string,
  context: { userId?: string; purpose: string }
): string {
  try {
    const decrypted = decrypt(encryptedPayload);
    
    // Audit log for PHI access tracking
    logger.info({
      userId: context.userId,
      purpose: context.purpose,
      timestamp: new Date().toISOString(),
    }, 'PHI-encrypted telemetry accessed');
    
    return decrypted;
  } catch (error) {
    logger.error({ err: error }, 'Failed to decrypt telemetry payload');
    throw new Error('PHI decryption failed');
  }
}

/**
 * Encrypt violation description (may contain sensitive details)
 */
export function encryptViolationDescription(description: string): string {
  try {
    // Redact any PHI in violation descriptions
    const { redactedText } = redactPHI(description);
    
    // Encrypt the redacted description
    return encrypt(redactedText);
  } catch (error) {
    logger.error({ err: error }, 'Failed to encrypt violation description');
    throw new Error('Violation description encryption failed');
  }
}

/**
 * Decrypt violation description
 */
export function decryptViolationDescription(
  encryptedDescription: string,
  context: { userId?: string; purpose: string }
): string {
  try {
    const decrypted = decrypt(encryptedDescription);
    
    // Audit log for compliance tracking
    logger.info({
      userId: context.userId,
      purpose: context.purpose,
      timestamp: new Date().toISOString(),
    }, 'Violation description accessed');
    
    return decrypted;
  } catch (error) {
    logger.error({ err: error }, 'Failed to decrypt violation description');
    throw new Error('Violation description decryption failed');
  }
}

/**
 * Create searchable token from PHI (one-way hash for lookup)
 * Allows searching encrypted data without decrypting
 */
export function createPHIToken(value: string): string {
  const crypto = require('crypto');
  return crypto
    .createHash('sha256')
    .update(value + (process.env.ENCRYPTION_KEY || ''))
    .digest('hex')
    .substring(0, 16); // Use first 16 chars as token
}

/**
 * Batch encrypt telemetry payloads for performance
 */
export function batchEncryptTelemetry(
  payloads: Array<{ id: string; payload: string | object }>
): Array<{
  id: string;
  encryptedPayload: string;
  phiRedacted: boolean;
  entitiesDetected: number;
}> {
  return payloads.map(({ id, payload }) => ({
    id,
    ...encryptTelemetryPayload(payload),
  }));
}
