import { logger } from '../logger';
import type { DiscoveredAISystem } from './ai-discovery-crawler';

interface CernerFHIRConfig {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  fhirBaseUrl: string;
}

interface CernerDevice {
  resourceType: 'Device';
  id: string;
  deviceName?: Array<{ name: string; type: string }>;
  manufacturer?: string;
  type?: { coding: Array<{ system: string; code: string; display: string }> };
  version?: Array<{ type: { text: string }; value: string }>;
  owner?: { reference: string; display: string };
  location?: { reference: string; display: string };
  modelNumber?: string;
}

class CernerFHIRService {
  /**
   * Discover AI systems from Cerner FHIR Device API
   * Cerner FHIR R4 Device resource: https://fhir.cerner.com/millennium/r4/devices/device/
   */
  async discoverAISystems(config: CernerFHIRConfig): Promise<DiscoveredAISystem[]> {
    try {
      logger.info({ fhirBaseUrl: config.fhirBaseUrl }, 'Cerner FHIR AI discovery started');

      // Step 1: Authenticate using Cerner OAuth 2.0
      const accessToken = await this.authenticate(config);

      // Step 2: Query Device resources
      const devices = await this.queryDevices(config.fhirBaseUrl, accessToken);

      // Step 3: Transform Cerner Device resources to DiscoveredAISystem format
      const aiSystems = this.transformDevicesToAISystems(devices);

      logger.info({ count: aiSystems.length }, 'Cerner FHIR AI discovery complete');
      return aiSystems;
    } catch (error) {
      logger.error({ err: error }, 'Cerner FHIR discovery failed');
      throw error;
    }
  }

  /**
   * Authenticate with Cerner using OAuth 2.0 Client Credentials
   * Cerner OAuth: https://fhir.cerner.com/authorization/
   */
  private async authenticate(config: CernerFHIRConfig): Promise<string> {
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'system/Device.read',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cerner authentication failed: ${error}`);
    }

    const tokenData = await response.json();
    return tokenData.access_token;
  }

  /**
   * Query Cerner FHIR Device resources
   * Search for medical devices including AI/ML systems
   */
  private async queryDevices(fhirBaseUrl: string, accessToken: string): Promise<CernerDevice[]> {
    // Query for AI/decision support devices
    const deviceUrl = `${fhirBaseUrl}/Device?type=http://snomed.info/sct|706687001`;
    
    const response = await fetch(deviceUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/fhir+json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cerner Device query failed: ${error}`);
    }

    const bundle = await response.json();
    
    if (bundle.resourceType !== 'Bundle' || !bundle.entry) {
      return [];
    }

    return bundle.entry.map((entry: any) => entry.resource).filter((r: any) => r.resourceType === 'Device');
  }

  /**
   * Transform Cerner Device resources to Spectral DiscoveredAISystem format
   */
  private transformDevicesToAISystems(devices: CernerDevice[]): DiscoveredAISystem[] {
    return devices.map((device) => {
      const deviceName = device.deviceName?.[0]?.name || device.modelNumber || device.id;
      const vendor = device.manufacturer || 'Unknown Vendor';
      const department = device.location?.display || device.owner?.display || 'Unknown Department';

      const category = this.categorizeDevice(device);

      return {
        name: deviceName,
        department,
        vendor,
        category,
        discoverySource: 'Cerner FHIR Device API',
        confidence: 0.88,
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
   * Categorize AI device based on Cerner FHIR metadata
   */
  private categorizeDevice(device: CernerDevice): string {
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
   * Sync AI system metadata from Cerner FHIR
   */
  async syncAISystemMetadata(fhirId: string, config: CernerFHIRConfig): Promise<any> {
    try {
      const accessToken = await this.authenticate(config);
      const deviceUrl = `${config.fhirBaseUrl}/Device/${fhirId}`;

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
      logger.error({ err: error, fhirId }, 'Cerner FHIR metadata sync failed');
      throw error;
    }
  }

  /**
   * Test connection to Cerner FHIR endpoint
   */
  async testConnection(config: CernerFHIRConfig): Promise<boolean> {
    try {
      const accessToken = await this.authenticate(config);
      const response = await fetch(`${config.fhirBaseUrl}/metadata`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/fhir+json',
        },
      });
      return response.ok;
    } catch (error) {
      logger.error({ err: error }, 'Cerner FHIR connection test failed');
      return false;
    }
  }
}

export const cernerFHIRService = new CernerFHIRService();
