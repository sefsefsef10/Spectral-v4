import { WorkOS } from '@workos-inc/node';
import { logger } from '../logger';

// WorkOS client singleton
let workosClient: WorkOS | null = null;

/**
 * Get WorkOS client instance
 * Returns null if credentials not configured
 */
export function getWorkOSClient(): WorkOS | null {
  if (workosClient) {
    return workosClient;
  }

  const apiKey = process.env.WORKOS_API_KEY;
  
  if (!apiKey) {
    logger.warn('WorkOS not configured - SSO features disabled. Set WORKOS_API_KEY to enable.');
    return null;
  }

  try {
    workosClient = new WorkOS(apiKey);
    logger.info('WorkOS client initialized successfully');
    return workosClient;
  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize WorkOS client');
    return null;
  }
}

/**
 * Get WorkOS configuration
 */
export function getWorkOSConfig() {
  return {
    clientId: process.env.WORKOS_CLIENT_ID || '',
    cookiePassword: process.env.WORKOS_COOKIE_PASSWORD || '',
    redirectUri: process.env.WORKOS_REDIRECT_URI || '',
  };
}

/**
 * Check if WorkOS is properly configured
 */
export function isWorkOSConfigured(): boolean {
  return !!(
    process.env.WORKOS_API_KEY &&
    process.env.WORKOS_CLIENT_ID &&
    process.env.WORKOS_COOKIE_PASSWORD
  );
}

/**
 * WorkOS session data structure
 */
export interface WorkOSSession {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  ssoProvider: string;
  ssoExternalId: string;
  ssoOrganizationId?: string;
}
