import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../logger';

/**
 * Webhook Signature Verification Middleware
 *
 * Verifies HMAC signatures on incoming webhooks to prevent spoofing attacks.
 * Uses timing-safe comparison to prevent timing attacks.
 */

interface WebhookConfig {
  provider: string;
  headerName: string;
  secretEnvVar: string;
  algorithm: 'sha256' | 'sha1' | 'sha512';
  includeTimestamp?: boolean;
}

const WEBHOOK_CONFIGS: Record<string, WebhookConfig> = {
  langsmith: {
    provider: 'langsmith',
    headerName: 'x-langsmith-signature',
    secretEnvVar: 'LANGSMITH_WEBHOOK_SECRET',
    algorithm: 'sha256',
    includeTimestamp: true,
  },
  arize: {
    provider: 'arize',
    headerName: 'x-arize-signature',
    secretEnvVar: 'ARIZE_WEBHOOK_SECRET',
    algorithm: 'sha256',
    includeTimestamp: true,
  },
  langfuse: {
    provider: 'langfuse',
    headerName: 'x-langfuse-signature',
    secretEnvVar: 'LANGFUSE_WEBHOOK_SECRET',
    algorithm: 'sha256',
    includeTimestamp: true,
  },
  wandb: {
    provider: 'wandb',
    headerName: 'x-wandb-signature',
    secretEnvVar: 'WANDB_WEBHOOK_SECRET',
    algorithm: 'sha256',
    includeTimestamp: true,
  },
  epic: {
    provider: 'epic',
    headerName: 'x-epic-signature',
    secretEnvVar: 'EPIC_WEBHOOK_SECRET',
    algorithm: 'sha256',
    includeTimestamp: true,
  },
  cerner: {
    provider: 'cerner',
    headerName: 'x-cerner-signature',
    secretEnvVar: 'CERNER_WEBHOOK_SECRET',
    algorithm: 'sha256',
    includeTimestamp: true,
  },
  athenahealth: {
    provider: 'athenahealth',
    headerName: 'x-athena-signature',
    secretEnvVar: 'ATHENA_WEBHOOK_SECRET',
    algorithm: 'sha256',
    includeTimestamp: true,
  },
  pagerduty: {
    provider: 'pagerduty',
    headerName: 'x-pagerduty-signature',
    secretEnvVar: 'PAGERDUTY_WEBHOOK_SECRET',
    algorithm: 'sha256',
    includeTimestamp: false,
  },
  datadog: {
    provider: 'datadog',
    headerName: 'x-datadog-signature',
    secretEnvVar: 'DATADOG_WEBHOOK_SECRET',
    algorithm: 'sha256',
    includeTimestamp: false,
  },
  slack: {
    provider: 'slack',
    headerName: 'x-slack-signature',
    secretEnvVar: 'SLACK_WEBHOOK_SECRET',
    algorithm: 'sha256',
    includeTimestamp: true,
  },
  twilio: {
    provider: 'twilio',
    headerName: 'x-twilio-signature',
    secretEnvVar: 'TWILIO_WEBHOOK_SECRET',
    algorithm: 'sha1', // Twilio uses SHA1
    includeTimestamp: false,
  },
};

/**
 * Verify webhook signature using HMAC
 */
function verifySignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm: 'sha256' | 'sha1' | 'sha512',
  timestamp?: string
): boolean {
  try {
    // Construct the signed payload
    let signedPayload = payload;
    if (timestamp) {
      signedPayload = `${timestamp}.${payload}`;
    }

    // Generate expected signature
    const expectedSignature = crypto
      .createHmac(algorithm, secret)
      .update(signedPayload)
      .digest('hex');

    // Timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    logger.error({ error }, 'Error verifying webhook signature');
    return false;
  }
}

/**
 * Middleware factory for webhook signature verification
 */
export function verifyWebhookSignature(provider: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const config = WEBHOOK_CONFIGS[provider];

    if (!config) {
      logger.error({ provider }, 'Unknown webhook provider');
      return res.status(500).json({ error: 'Invalid webhook configuration' });
    }

    // Get signature from headers
    const signature = req.headers[config.headerName] as string;
    const timestamp = req.headers['x-timestamp'] as string;

    if (!signature) {
      logger.warn(
        { provider, headers: req.headers },
        'Missing webhook signature'
      );
      return res.status(401).json({ error: 'Missing signature' });
    }

    // Get webhook secret from environment
    const secret = process.env[config.secretEnvVar];

    if (!secret) {
      logger.error(
        { provider, envVar: config.secretEnvVar },
        'Webhook secret not configured'
      );
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    // Check timestamp (prevent replay attacks)
    if (config.includeTimestamp) {
      if (!timestamp) {
        logger.warn({ provider }, 'Missing timestamp for time-checked webhook');
        return res.status(401).json({ error: 'Missing timestamp' });
      }

      const now = Date.now();
      const requestTime = parseInt(timestamp, 10);

      if (isNaN(requestTime)) {
        logger.warn({ provider, timestamp }, 'Invalid timestamp format');
        return res.status(401).json({ error: 'Invalid timestamp' });
      }

      // Reject requests older than 5 minutes (prevent replay attacks)
      const ageInMs = Math.abs(now - requestTime);
      if (ageInMs > 5 * 60 * 1000) {
        logger.warn(
          { provider, ageInMs, timestamp },
          'Webhook request too old (possible replay attack)'
        );
        return res.status(401).json({ error: 'Request too old' });
      }
    }

    // Get raw body for signature verification
    const rawBody = req.rawBody;
    if (!rawBody) {
      logger.error({ provider }, 'Missing raw body for signature verification');
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const payload = rawBody.toString();

    // Verify signature
    const isValid = verifySignature(
      payload,
      signature,
      secret,
      config.algorithm,
      timestamp
    );

    if (!isValid) {
      logger.warn(
        {
          provider,
          signature,
          timestamp,
          payloadLength: payload.length,
          aiSystemId: req.params.aiSystemId,
        },
        'Invalid webhook signature (possible attack)'
      );
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Signature valid - log and continue
    logger.info(
      {
        provider,
        aiSystemId: req.params.aiSystemId,
        timestamp,
      },
      'Webhook signature verified'
    );

    next();
  };
}

/**
 * Generate webhook secret for configuration
 * Use this to generate secrets for .env file
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}
