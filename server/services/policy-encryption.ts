/**
 * 🔒 POLICY ENCRYPTION SERVICE - Translation Engine IP Moat
 * 
 * Encrypts compliance mapping policy logic to protect core intellectual property.
 * Uses AES-256-GCM encryption + SHA-256 integrity hashing.
 * 
 * CRITICAL FOR M&A: Prevents reverse-engineering of $300M+ valuation IP moat.
 */

import crypto from 'crypto';
import { logger } from '../logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Get encryption key from environment (ENCRYPTION_KEY must be 32+ bytes)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY not found in environment');
  }
  
  // Derive 32-byte key from the provided encryption key using SHA-256
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt policy rule logic (compliance mapping logic)
 */
export function encryptPolicyLogic(ruleLogic: object): string {
  try {
    const plaintext = JSON.stringify(ruleLogic);
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:encrypted
    const result = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    
    logger.info({
      action: 'encrypt_policy_logic',
      plaintextLength: plaintext.length,
      encryptedLength: result.length,
    }, 'Policy logic encrypted');
    
    return result;
  } catch (error) {
    logger.error({ error }, 'Failed to encrypt policy logic');
    throw new Error('Policy encryption failed');
  }
}

/**
 * Decrypt policy rule logic (for runtime use)
 */
export function decryptPolicyLogic(encrypted: string): object {
  try {
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted policy format');
    }
    
    const [ivHex, authTagHex, encryptedData] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    logger.info({
      action: 'decrypt_policy_logic',
      decryptedLength: decrypted.length,
    }, 'Policy logic decrypted');
    
    return JSON.parse(decrypted);
  } catch (error) {
    logger.error({ error }, 'Failed to decrypt policy logic');
    throw new Error('Policy decryption failed - possible tampering detected');
  }
}

/**
 * Generate SHA-256 hash of policy logic for integrity verification
 */
export function generatePolicyHash(ruleLogic: object): string {
  const plaintext = JSON.stringify(ruleLogic);
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

/**
 * Verify policy integrity by comparing hash
 */
export function verifyPolicyIntegrity(ruleLogic: object, expectedHash: string): boolean {
  const actualHash = generatePolicyHash(ruleLogic);
  return actualHash === expectedHash;
}
