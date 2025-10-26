import { logger } from "../logger";

interface EnvValidationConfig {
  required: string[];
  optional: string[];
  validators?: Record<string, (value: string) => boolean>;
  messages?: Record<string, string>;
}

/**
 * Validates environment variables on startup
 * Throws error if required variables are missing in dev/prod
 * Warns if optional variables are missing
 */
export function validateEnv(config: EnvValidationConfig): void {
  // Skip validation in test environment
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  // Check required environment variables
  for (const key of config.required) {
    const value = process.env[key];
    
    if (!value) {
      errors.push(`${key} is required but not set`);
      continue;
    }

    // Run custom validator if provided
    if (config.validators?.[key]) {
      try {
        if (!config.validators[key](value)) {
          const message = config.messages?.[key] || `${key} validation failed`;
          errors.push(message);
        }
      } catch (error) {
        errors.push(`${key} validation error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  // Check optional environment variables (warn only)
  for (const key of config.optional) {
    const value = process.env[key];
    
    if (!value) {
      warnings.push(`${key} is not set - related features will be disabled`);
    } else if (config.validators?.[key]) {
      try {
        if (!config.validators[key](value)) {
          const message = config.messages?.[key] || `${key} validation failed`;
          warnings.push(message);
        }
      } catch (error) {
        warnings.push(`${key} validation error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  // Log warnings
  if (warnings.length > 0) {
    logger.warn({ warnings, count: warnings.length }, 'Environment validation warnings');
  }

  // Throw on errors
  if (errors.length > 0) {
    const errorMessage = `Environment validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`;
    logger.error({ errors, count: errors.length }, errorMessage);
    throw new Error(errorMessage);
  }

  logger.info({ 
    env: process.env.NODE_ENV,
    requiredCount: config.required.length,
    optionalCount: config.optional.length,
    warningCount: warnings.length
  }, 'Environment validation passed');
}

/**
 * Spectral-specific environment validation configuration
 */
export function validateSpectralEnv(): void {
  validateEnv({
    required: [
      'DATABASE_URL',
      'SESSION_SECRET',
      'ENCRYPTION_KEY',
    ],
    optional: [
      // Caching
      'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN',
      
      // Object Storage
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_REGION',
      'AWS_S3_BUCKET',
      
      // Notifications
      'SENDGRID_API_KEY',
      'FROM_EMAIL',
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'TWILIO_PHONE_NUMBER',
      'SLACK_WEBHOOK_URL',
      
      // Webhook Verification
      'LANGSMITH_WEBHOOK_SECRET',
      'ARIZE_WEBHOOK_SECRET',
      'WANDB_WEBHOOK_SECRET',
      
      // Configuration
      'LOG_LEVEL',
      'ENABLE_BACKGROUND_WORKERS',
    ],
    validators: {
      SESSION_SECRET: (value) => value.length >= 32,
      ENCRYPTION_KEY: (value) => {
        try {
          const keyBuffer = Buffer.from(value, 'base64');
          return keyBuffer.length === 32;
        } catch {
          return false;
        }
      },
      DATABASE_URL: (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
      UPSTASH_REDIS_REST_URL: (value) => value.startsWith('https://'),
      AWS_S3_BUCKET: (value) => value.length > 0 && !value.includes(' '),
      SENDGRID_API_KEY: (value) => value.startsWith('SG.'),
      FROM_EMAIL: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      TWILIO_PHONE_NUMBER: (value) => /^\+[1-9]\d{1,14}$/.test(value),
      SLACK_WEBHOOK_URL: (value) => value.startsWith('https://hooks.slack.com/'),
    },
    messages: {
      SESSION_SECRET: 'SESSION_SECRET must be at least 32 characters long',
      ENCRYPTION_KEY: 'ENCRYPTION_KEY must be a base64-encoded 32-byte (256-bit) key',
      DATABASE_URL: 'DATABASE_URL must be a valid PostgreSQL connection string',
      UPSTASH_REDIS_REST_URL: 'UPSTASH_REDIS_REST_URL must be a valid HTTPS URL',
      AWS_S3_BUCKET: 'AWS_S3_BUCKET must be a valid bucket name',
      SENDGRID_API_KEY: 'SENDGRID_API_KEY must start with "SG."',
      FROM_EMAIL: 'FROM_EMAIL must be a valid email address',
      TWILIO_PHONE_NUMBER: 'TWILIO_PHONE_NUMBER must be in E.164 format (e.g., +14155551234)',
      SLACK_WEBHOOK_URL: 'SLACK_WEBHOOK_URL must be a valid Slack webhook URL',
    }
  });
}
