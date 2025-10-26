/**
 * Webhook Secret Manager
 * 
 * Manages webhook signing secrets including:
 * - Initial secret generation
 * - Secret rotation
 * - Secret retrieval
 */

import { db } from '../db';
import { webhookSecrets } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { generateWebhookSecret } from '../utils/webhook-signatures';
import { encryptFields } from './encryption';
import { logger } from '../logger';

export class WebhookSecretManager {
  /**
   * Initialize webhook secrets for all services
   * Creates secrets if they don't exist
   */
  async initializeSecrets(): Promise<void> {
    const services = [
      'langsmith',
      'arize',
      'langfuse',
      'wandb',
      'pagerduty',
      'datadog',
      'twilio',
      'slack',
      'epic',
      'cerner',
      'athenahealth',
      'stripe', // For future use
    ];

    logger.info({ services }, 'Initializing webhook secrets');

    for (const serviceName of services) {
      await this.ensureSecretExists(serviceName);
    }

    logger.info('Webhook secrets initialized successfully');
  }

  /**
   * Ensure a secret exists for a service (create if missing)
   */
  async ensureSecretExists(serviceName: string): Promise<void> {
    const existing = await db
      .select()
      .from(webhookSecrets)
      .where(eq(webhookSecrets.serviceName, serviceName))
      .limit(1);

    if (existing.length > 0) {
      logger.debug({ serviceName }, 'Webhook secret already exists');
      return;
    }

    // Generate new secret
    const rawSecret = generateWebhookSecret(32); // 32 bytes = 256 bits

    // Encrypt secret before storing
    const encrypted = encryptFields(
      { secretKey: rawSecret },
      ['secretKey']
    );

    // Store in database
    await db.insert(webhookSecrets).values({
      serviceName,
      secretKey: encrypted.secretKey,
      algorithm: 'hmac-sha256',
      active: true,
    });

    logger.info({ serviceName }, 'Created new webhook secret');
    
    // Log the secret to console for developer use (in development only)
    if (process.env.NODE_ENV !== 'production') {
      logger.warn({
        serviceName,
        secret: rawSecret,
        warning: 'COPY THIS SECRET - It will not be shown again'
      }, 'NEW WEBHOOK SECRET GENERATED');
    }
  }

  /**
   * Rotate a webhook secret (generate new one, mark old as inactive)
   */
  async rotateSecret(serviceName: string): Promise<string> {
    logger.info({ serviceName }, 'Rotating webhook secret');

    // Mark existing secret as inactive
    await db
      .update(webhookSecrets)
      .set({ 
        active: false,
        rotatedAt: new Date()
      })
      .where(eq(webhookSecrets.serviceName, serviceName));

    // Generate new secret
    const rawSecret = generateWebhookSecret(32);
    const encrypted = encryptFields(
      { secretKey: rawSecret },
      ['secretKey']
    );

    // Create new active secret
    await db.insert(webhookSecrets).values({
      serviceName,
      secretKey: encrypted.secretKey,
      algorithm: 'hmac-sha256',
      active: true,
    });

    logger.info({ serviceName }, 'Webhook secret rotated successfully');

    return rawSecret;
  }

  /**
   * Get active secret for a service (for testing/debugging only)
   * WARNING: This returns the decrypted secret - use with caution
   */
  async getActiveSecret(serviceName: string): Promise<string | null> {
    const result = await db
      .select()
      .from(webhookSecrets)
      .where(
        and(
          eq(webhookSecrets.serviceName, serviceName),
          eq(webhookSecrets.active, true)
        )
      )
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    // Decrypt and return
    const decrypted = encryptFields(
      { secretKey: result[0].secretKey },
      ['secretKey']
    );

    return decrypted.secretKey;
  }

  /**
   * List all services with their secret status
   */
  async listSecretStatus(): Promise<Array<{
    serviceName: string;
    hasActiveSecret: boolean;
    createdAt: Date;
    rotatedAt: Date | null;
  }>> {
    const allSecrets = await db
      .select()
      .from(webhookSecrets)
      .where(eq(webhookSecrets.active, true));

    return allSecrets.map(secret => ({
      serviceName: secret.serviceName,
      hasActiveSecret: true,
      createdAt: secret.createdAt,
      rotatedAt: secret.rotatedAt,
    }));
  }
}

// Export singleton instance
export const webhookSecretManager = new WebhookSecretManager();
