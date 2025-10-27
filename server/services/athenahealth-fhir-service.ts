import { logger } from '../logger';
import type { DiscoveredAISystem } from './ai-discovery-crawler';

interface AthenahealthFHIRConfig {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  fhirBaseUrl: string;
  practiceId: string;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

// Rate limiting
const RATE_LIMIT = {
  requestsPerSecond: 10,
  lastRequestTime: 0,
};

interface AthenaDevice {
  resourceType: 'Device';
  id: string;
  deviceName?: Array<{ name: string; type: string }>;
  manufacturer?: string;
  type?: { coding: Array<{ system: string; code: string; display: string }> };
  version?: Array<{ type: { text: string }; value: string }>;
  owner?: { reference: string; display: string };
  patient?: { reference: string };
  modelNumber?: string;
}

export class AthenahealthFHIRService {
  private tokenCache: Map<string, TokenCache> = new Map();

  /**
   * Discover AI systems from athenahealth FHIR Device API with retry logic
   * Athenahealth FHIR R4 Device resource: https://docs.athenahealth.com/api/fhir/device
   */
  async discoverAISystems(config: AthenahealthFHIRConfig): Promise<DiscoveredAISystem[]> {
    try {
      logger.info({ fhirBaseUrl: config.fhirBaseUrl }, 'Athenahealth FHIR AI discovery started');

      // Step 1: Authenticate using Athenahealth OAuth 2.0 (with token caching)
      const accessToken = await this.getValidToken(config);

      // Step 2: Query Device resources with retry logic
      const devices = await this.queryDevicesWithRetry(config.fhirBaseUrl, accessToken, config.practiceId);

      // Step 3: Transform Athenahealth Device resources to DiscoveredAISystem format
      const aiSystems = this.transformDevicesToAISystems(devices);

      logger.info({ count: aiSystems.length }, 'Athenahealth FHIR AI discovery complete');
      return aiSystems;
    } catch (error) {
      logger.error({ err: error }, 'Athenahealth FHIR discovery failed - returning empty array');
      // Graceful degradation: return empty array instead of crashing discovery job
      return [];
    }
  }

  /**
   * Get valid access token (from cache or authenticate)
   */
  private async getValidToken(config: AthenahealthFHIRConfig): Promise<string> {
    const cacheKey = `${config.clientId}:${config.tokenUrl}`;
    const cached = this.tokenCache.get(cacheKey);

    // Check if cached token is still valid (with 5 minute buffer)
    if (cached && Date.now() < cached.expiresAt - 5 * 60 * 1000) {
      logger.debug('Using cached Athenahealth access token');
      return cached.accessToken;
    }

    // Authenticate and cache new token
    const { accessToken, expiresIn } = await this.authenticate(config);
    this.tokenCache.set(cacheKey, {
      accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
    });

    return accessToken;
  }

  /**
   * Rate limit API requests
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - RATE_LIMIT.lastRequestTime;
    const minInterval = 1000 / RATE_LIMIT.requestsPerSecond;

    if (timeSinceLastRequest < minInterval) {
      const delay = minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    RATE_LIMIT.lastRequestTime = Date.now();
  }

  /**
   * Query devices with exponential backoff retry
   */
  private async queryDevicesWithRetry(fhirBaseUrl: string, accessToken: string, practiceId: string): Promise<AthenaDevice[]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = Math.min(
            RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1),
            RETRY_CONFIG.maxDelayMs
          );
          logger.info({ attempt, delayMs: delay }, 'Retrying Athenahealth FHIR request');
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        await this.rateLimit();
        return await this.queryDevices(fhirBaseUrl, accessToken, practiceId);
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on authentication errors (4xx), but invalidate cached token on 401
        if (error.status >= 400 && error.status < 500) {
          if (error.status === 401) {
            // Invalidate cached token on auth failure
            const cacheKey = Object.keys(Object.fromEntries(this.tokenCache))[0];
            if (cacheKey) this.tokenCache.delete(cacheKey);
            logger.warn('Athenahealth FHIR 401 - invalidated cached token');
          }
          logger.warn({ status: error.status }, 'Athenahealth FHIR client error - not retrying');
          throw error;
        }

        // Retry on 5xx and network errors
        logger.warn({ attempt, error: error.message }, 'Athenahealth FHIR request failed');
      }
    }

    throw lastError || new Error('Athenahealth FHIR request failed after retries');
  }

  /**
   * Authenticate with Athenahealth using OAuth 2.0 Client Credentials
   * Athenahealth OAuth: https://docs.athenahealth.com/api/guides/authentication
   */
  private async authenticate(config: AthenahealthFHIRConfig): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          scope: 'system/Device.read',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw Object.assign(
          new Error(`Athenahealth OAuth failed: ${response.status} ${response.statusText}`),
          { status: response.status, body: errorText }
        );
      }

      const tokenData = await response.json();
      return {
        accessToken: tokenData.access_token,
        expiresIn: tokenData.expires_in || 3600, // Default to 1 hour if not provided
      };
    } catch (error: any) {
      logger.error({ err: error }, 'Athenahealth authentication failed');
      throw error;
    }
  }

  /**
   * Query Athenahealth FHIR Device resources
   * Search for medical devices including AI/ML systems
   */
  private async queryDevices(fhirBaseUrl: string, accessToken: string, practiceId: string): Promise<AthenaDevice[]> {
    // Athenahealth requires practiceId in URL path
    const deviceUrl = `${fhirBaseUrl}/${practiceId}/Device?type=http://snomed.info/sct|706687001`;
    
    const response = await fetch(deviceUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/fhir+json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw Object.assign(
        new Error(`Athenahealth Device query failed: ${response.status} ${response.statusText}`),
        { status: response.status, body: errorText }
      );
    }

    const bundle = await response.json();
    
    if (bundle.resourceType !== 'Bundle' || !bundle.entry) {
      return [];
    }

    return bundle.entry.map((entry: any) => entry.resource).filter((r: any) => r.resourceType === 'Device');
  }

  /**
   * Transform Athenahealth Device resources to Spectral DiscoveredAISystem format
   */
  private transformDevicesToAISystems(devices: AthenaDevice[]): DiscoveredAISystem[] {
    return devices.map((device) => {
      const deviceName = device.deviceName?.[0]?.name || device.modelNumber || device.id;
      const vendor = device.manufacturer || 'Unknown Vendor';
      const department = device.owner?.display || 'Unknown Department';

      const category = this.categorizeDevice(device);

      return {
        name: deviceName,
        department,
        vendor,
        category,
        discoverySource: 'Athenahealth FHIR Device API',
        confidence: 0.87,
        metadata: {
          fhirId: device.id,
          deviceType: device.type?.coding?.[0]?.display,
          version: device.version?.[0]?.value,
          modelNumber: device.modelNumber,
          resourceType: device.resourceType,
        },
      };
    });
  }

  /**
   * Categorize AI device based on Athenahealth FHIR metadata
   */
  private categorizeDevice(device: AthenaDevice): string {
    const typeCode = device.type?.coding?.[0]?.code;
    const typeName = device.type?.coding?.[0]?.display?.toLowerCase() || '';

    // Map SNOMED CT codes to Spectral categories
    const categoryMap: Record<string, string> = {
      '706687001': 'Clinical Decision Support',
      '304263003': 'Medical Imaging',
      '706685003': 'Pathology',
      '706686002': 'Natural Language Processing',
    };

    if (typeCode && categoryMap[typeCode]) {
      return categoryMap[typeCode];
    }

    // Fallback to keyword matching
    if (typeName.includes('radiology') || typeName.includes('imaging')) {
      return 'Medical Imaging';
    }
    if (typeName.includes('pathology')) {
      return 'Pathology';
    }
    if (typeName.includes('nlp') || typeName.includes('natural language')) {
      return 'Natural Language Processing';
    }
    if (typeName.includes('clinical decision') || typeName.includes('support')) {
      return 'Clinical Decision Support';
    }

    return 'Other AI System';
  }

  /**
   * Sync AI system metadata from Athenahealth FHIR
   */
  async syncAISystemMetadata(fhirId: string, config: AthenahealthFHIRConfig): Promise<any> {
    try {
      const accessToken = await this.authenticate(config);
      const deviceUrl = `${config.fhirBaseUrl}/${config.practiceId}/Device/${fhirId}`;

      const response = await fetch(deviceUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/fhir+json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch Device/${fhirId}`);
      }

      const device = await response.json();
      return this.transformDevicesToAISystems([device])[0];
    } catch (error) {
      logger.error({ err: error, fhirId }, 'Athenahealth FHIR metadata sync failed');
      throw error;
    }
  }

  /**
   * Test connection to Athenahealth FHIR endpoint
   */
  async testConnection(config: AthenahealthFHIRConfig): Promise<boolean> {
    try {
      const accessToken = await this.authenticate(config);
      const response = await fetch(`${config.fhirBaseUrl}/${config.practiceId}/metadata`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/fhir+json',
        },
      });
      return response.ok;
    } catch (error) {
      logger.error({ err: error }, 'Athenahealth FHIR connection test failed');
      return false;
    }
  }

  /**
   * List available practices for this Athenahealth account
   */
  async listPractices(config: Omit<AthenahealthFHIRConfig, 'practiceId'>): Promise<Array<{ id: string; name: string }>> {
    try {
      const accessToken = await this.authenticate({...config, practiceId: ''});
      const response = await fetch(`${config.fhirBaseUrl}/Organization`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/fhir+json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to list practices');
      }

      const bundle = await response.json();
      
      if (bundle.resourceType !== 'Bundle' || !bundle.entry) {
        return [];
      }

      return bundle.entry.map((entry: any) => ({
        id: entry.resource.id,
        name: entry.resource.name || entry.resource.id,
      }));
    } catch (error) {
      logger.error({ err: error }, 'Athenahealth practice listing failed');
      return [];
    }
  }
}

export const athenahealthFHIRService = new AthenahealthFHIRService();
