import { logger } from '../logger';
import type { DiscoveredAISystem } from './ai-discovery-crawler';

interface AthenaDHIRConfig {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  fhirBaseUrl: string;
  practiceId: string;
}

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
  /**
   * Discover AI systems from athenahealth FHIR Device API
   * Athenahealth FHIR R4 Device resource: https://docs.athenahealth.com/api/fhir/device
   */
  async discoverAISystems(config: AthenahealthFHIRConfig): Promise<DiscoveredAISystem[]> {
    try {
      logger.info({ fhirBaseUrl: config.fhirBaseUrl }, 'Athenahealth FHIR AI discovery started');

      // Step 1: Authenticate using Athenahealth OAuth 2.0
      const accessToken = await this.authenticate(config);

      // Step 2: Query Device resources
      const devices = await this.queryDevices(config.fhirBaseUrl, accessToken, config.practiceId);

      // Step 3: Transform Athenahealth Device resources to DiscoveredAISystem format
      const aiSystems = this.transformDevicesToAISystems(devices);

      logger.info({ count: aiSystems.length }, 'Athenahealth FHIR AI discovery complete');
      return aiSystems;
    } catch (error) {
      logger.error({ err: error }, 'Athenahealth FHIR discovery failed');
      throw error;
    }
  }

  /**
   * Authenticate with Athenahealth using OAuth 2.0 Client Credentials
   * Athenahealth OAuth: https://docs.athenahealth.com/api/guides/authentication
   */
  private async authenticate(config: AthenahealthFHIRConfig): Promise<string> {
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
      const error = await response.text();
      throw new Error(`Athenahealth authentication failed: ${error}`);
    }

    const tokenData = await response.json();
    return tokenData.access_token;
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
      const error = await response.text();
      throw new Error(`Athenahealth Device query failed: ${error}`);
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
        source: 'athenahealth_fhir',
        confidence: 0.87, // High confidence for Athenahealth FHIR-registered devices
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
