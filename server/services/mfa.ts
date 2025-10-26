/**
 * Multi-Factor Authentication (MFA) Service
 * 
 * Provides TOTP-based 2FA using speakeasy
 * Generates QR codes for authenticator app setup
 * Supports backup codes for account recovery
 */

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { hashPassword, verifyPassword } from '../auth';
import { logger } from '../logger';

/**
 * Generate MFA secret and QR code for user setup
 */
export async function generateMFASecret(email: string): Promise<{
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}> {
  // Generate TOTP secret
  const secret = speakeasy.generateSecret({
    name: `Spectral (${email})`,
    issuer: 'Spectral Healthcare AI',
    length: 32,
  });

  // Generate QR code as data URL
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');

  // Generate 10 cryptographically secure backup codes (8 characters each)
  const backupCodes = Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );

  logger.info({ email }, 'Generated MFA secret and backup codes');

  return {
    secret: secret.base32,
    qrCodeUrl,
    backupCodes,
  };
}

/**
 * Verify TOTP token from authenticator app
 */
export function verifyMFAToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2, // Allow 2 time steps before/after (±60 seconds)
  });
}

/**
 * Verify backup code
 */
export async function verifyBackupCode(
  hashedBackupCodes: string[],
  inputCode: string
): Promise<{ valid: boolean; remainingCodes: string[] }> {
  // Check each hashed backup code
  for (let i = 0; i < hashedBackupCodes.length; i++) {
    const isValid = await verifyPassword(inputCode, hashedBackupCodes[i]);
    if (isValid) {
      // Remove used backup code
      const remainingCodes = [
        ...hashedBackupCodes.slice(0, i),
        ...hashedBackupCodes.slice(i + 1),
      ];
      return { valid: true, remainingCodes };
    }
  }
  
  return { valid: false, remainingCodes: hashedBackupCodes };
}

/**
 * Hash backup codes for secure storage
 */
export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map(code => hashPassword(code)));
}
