/**
 * Webhook Signature Verification Middleware
 * 
 * Validates incoming webhook requests using HMAC-SHA256 signatures.
 * Logs all verification attempts for security monitoring.
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { webhookSecrets, webhookDeliveryLogs } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { 
  verifyHMACSignature, 
  verifyTimestamp, 
  SIGNATURE_HEADERS, 
  TIMESTAMP_HEADERS 
} from '../utils/webhook-signatures';
import { decryptFields } from '../services/encryption';
import { logger } from '../logger';

/**
 * Middleware to verify webhook signatures
 * 
 * Usage: app.post('/api/webhooks/:service', verifyWebhookSignature('service'), handler)
 */
export function verifyWebhookSignature(serviceName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const endpoint = req.path;
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    try {
      // Get signature header for this service
      const signatureHeader = SIGNATURE_HEADERS[serviceName];
      if (!signatureHeader) {
        logger.error({ serviceName }, 'No signature header mapping for service');
        await logWebhookDelivery(
          serviceName,
          endpoint,
          false,
          null,
          400,
          'No signature header configured',
          ipAddress,
          req.headers
        );
        return res.status(400).json({ error: 'Webhook signature verification not configured' });
      }

      // Extract signature from headers
      const signature = req.headers[signatureHeader] as string;
      if (!signature) {
        logger.warn({ serviceName, signatureHeader }, 'Missing webhook signature');
        await logWebhookDelivery(
          serviceName,
          endpoint,
          false,
          null,
          401,
          'Missing signature header',
          ipAddress,
          req.headers
        );
        return res.status(401).json({ error: 'Missing webhook signature' });
      }

      // Get secret from database
      const secretRecord = await db
        .select()
        .from(webhookSecrets)
        .where(
          and(
            eq(webhookSecrets.serviceName, serviceName),
            eq(webhookSecrets.active, true)
          )
        )
        .limit(1);

      if (!secretRecord || secretRecord.length === 0) {
        logger.error({ serviceName }, 'No active webhook secret found');
        await logWebhookDelivery(
          serviceName,
          endpoint,
          false,
          null,
          500,
          'Webhook secret not configured',
          ipAddress,
          req.headers
        );
        return res.status(500).json({ error: 'Webhook secret not configured' });
      }

      // Decrypt secret key
      const { secretKey, algorithm } = secretRecord[0];
      const decryptedSecret = decryptFields({
        secretKey,
      }, ['secretKey']).secretKey;

      // Verify timestamp (if service supports it)
      const timestampHeader = TIMESTAMP_HEADERS[serviceName];
      if (timestampHeader) {
        const timestamp = parseInt(req.headers[timestampHeader] as string);
        if (!isNaN(timestamp) && !verifyTimestamp(timestamp)) {
          logger.warn({ serviceName, timestamp }, 'Webhook timestamp verification failed');
          await logWebhookDelivery(
            serviceName,
            endpoint,
            false,
            null,
            401,
            'Timestamp too old (potential replay attack)',
            ipAddress,
            req.headers
          );
          return res.status(401).json({ error: 'Webhook timestamp too old' });
        }
      }

      // Get raw body for signature verification
      // NOTE: This requires express.raw() middleware for this route
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);

      // Verify signature
      const verificationResult = verifyHMACSignature(
        rawBody,
        signature,
        decryptedSecret,
        algorithm === 'hmac-sha256' ? 'sha256' : algorithm.replace('hmac-', '')
      );

      if (!verificationResult.valid) {
        logger.warn({ serviceName, error: verificationResult.error }, 'Webhook signature verification failed');
        await logWebhookDelivery(
          serviceName,
          endpoint,
          false,
          null,
          401,
          `Signature verification failed: ${verificationResult.error || 'Invalid signature'}`,
          ipAddress,
          req.headers
        );
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      // Success - log and continue
      logger.info({ serviceName, endpoint, duration: Date.now() - startTime }, 'Webhook signature verified');
      await logWebhookDelivery(
        serviceName,
        endpoint,
        true,
        true,
        200,
        null,
        ipAddress,
        req.headers
      );

      next();
    } catch (error) {
      logger.error({ error, serviceName }, 'Error in webhook signature verification');
      await logWebhookDelivery(
        serviceName,
        endpoint,
        false,
        null,
        500,
        error instanceof Error ? error.message : 'Unknown error',
        ipAddress,
        req.headers
      );
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Log webhook delivery attempt for security monitoring
 */
async function logWebhookDelivery(
  serviceName: string,
  endpoint: string,
  signatureValid: boolean | null,
  payloadValid: boolean | null,
  statusCode: number,
  errorMessage: string | null,
  ipAddress: string,
  requestHeaders: any
) {
  try {
    await db.insert(webhookDeliveryLogs).values({
      serviceName,
      endpoint,
      signatureValid,
      payloadValid,
      statusCode,
      errorMessage,
      ipAddress,
      requestHeaders: JSON.parse(JSON.stringify(requestHeaders)), // Sanitize headers
    });
  } catch (error) {
    logger.error({ error }, 'Failed to log webhook delivery');
  }
}

/**
 * Middleware to capture raw request body for signature verification
 * Must be applied BEFORE express.json() middleware
 */
export function captureRawBody() {
  return (req: Request, res: Response, next: NextFunction) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      (req as any).rawBody = data;
      next();
    });
  };
}
