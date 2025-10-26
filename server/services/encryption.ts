/**
 * Encryption Service for HIPAA-compliant data protection
 * 
 * Uses AES-256-GCM for encrypting sensitive data like API keys
 * stored in the database.
 */

import crypto from 'crypto';
import { logger } from '../logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

/**
 * Get or validate encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required for data encryption');
  }
  
  // Key should be base64-encoded 32-byte key
  const keyBuffer = Buffer.from(key, 'base64');
  
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 8}-bit), got ${keyBuffer.length} bytes`);
  }
  
  return keyBuffer;
}

/**
 * Generate a random encryption key (for setup)
 * Returns a base64-encoded key that should be stored in ENCRYPTION_KEY env var
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('base64');
}

/**
 * Encrypt a string value
 */
export function encrypt(plaintext: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:ciphertext (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  } catch (error) {
    logger.error({ err: error }, 'Encryption failed');
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt a string value
 */
export function decrypt(ciphertext: string): string {
  try {
    const key = getEncryptionKey();
    const parts = ciphertext.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error({ err: error }, 'Decryption failed');
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Encrypt sensitive fields in an object (e.g., API keys in integration_config)
 * @param obj - Object containing sensitive fields
 * @param fieldsToEncrypt - Array of field names to encrypt
 */
export function encryptFields(obj: Record<string, any>, fieldsToEncrypt: string[]): Record<string, any> {
  const result = { ...obj };
  
  for (const field of fieldsToEncrypt) {
    if (result[field] && typeof result[field] === 'string') {
      // Mark encrypted fields with a prefix to identify them
      result[field] = `encrypted:${encrypt(result[field])}`;
    }
  }
  
  return result;
}

/**
 * Decrypt sensitive fields in an object
 * @param obj - Object containing encrypted fields
 * @param fieldsToDecrypt - Array of field names to decrypt
 */
export function decryptFields(obj: Record<string, any>, fieldsToDecrypt: string[]): Record<string, any> {
  const result = { ...obj };
  
  for (const field of fieldsToDecrypt) {
    if (result[field] && typeof result[field] === 'string') {
      // Check if field is encrypted (has our prefix)
      if (result[field].startsWith('encrypted:')) {
        result[field] = decrypt(result[field].substring('encrypted:'.length));
      }
      // If no prefix, it's either plaintext (legacy) or already decrypted - leave as-is
    }
  }
  
  return result;
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith('encrypted:');
}
