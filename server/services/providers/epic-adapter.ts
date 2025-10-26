/**
 * Epic EHR Provider Adapter
 * 
 * Connects to Epic FHIR API to discover AI systems via Device resource
 * Epic's Interconnect APIs expose medical devices and software as FHIR Device resources
 * 
 * @see https://fhir.epic.com/Documentation?docId=device
 */

import { logger } from '../../logger';
import type { 
  IProviderAdapter, 
  ProviderConnection, 
  ProviderAISystem,
  ProviderCredentials,
  EpicCredentials,
} from './types';

interface EpicOAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface EpicFHIRDevice {
  resourceType: 'Device';
  id: string;
  identifier?: Array<{
    system?: string;
    value?: string;
  }>;
  displayName?: string;
  manufacturer?: string;
  modelNumber?: string;
  version?: Array<{
    value?: string;
  }>;
  status?: 'active' | 'inactive' | 'entered-in-error' | 'unknown';
  type?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  note?: Array<{
    text?: string;
  }>;
  meta?: {
    lastUpdated?: string;
  };
}

interface EpicDeviceBundle {
  resourceType: 'Bundle';
  type: string;
  total?: number;
  entry?: Array<{
    resource: EpicFHIRDevice;
  }>;
  link?: Array<{
    relation: string;
    url: string;
  }>;
}

export class EpicAdapter implements IProviderAdapter {
  readonly providerType = 'epic' as const;
  readonly category = 'ehr' as const;
  
  private accessTokenCache: Map<string, { token: string; expiresAt: number }> = new Map();
  
  /**
   * Test Epic FHIR connection
   */
  async testConnection(connection: ProviderConnection): Promise<boolean> {
    try {
      const token = await this.getAccessToken(connection);
      
      // Test metadata endpoint
      const response = await fetch(`${connection.baseUrl}/metadata`, {
        headers: {
          'Accept': 'application/fhir+json',
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        logger.error({ status: response.status }, 'Epic metadata endpoint failed');
        return false;
      }
      
      const metadata = await response.json();
      logger.info({ fhirVersion: metadata.fhirVersion }, 'Epic connection successful');
      return true;
      
    } catch (error) {
      logger.error({ err: error }, 'Epic connection test failed');
      return false;
    }
  }
  
  /**
   * Fetch AI systems from Epic via FHIR Device API
   */
  async fetchAISystems(connection: ProviderConnection): Promise<ProviderAISystem[]> {
    const startTime = Date.now();
    const systems: ProviderAISystem[] = [];
    
    try {
      const token = await this.getAccessToken(connection);
      
      // Search for AI/ML devices
      // Epic classifies software as devices with specific type codes
      let nextUrl: string | null = `${connection.baseUrl}/Device?type=software&_count=50`;
      
      while (nextUrl) {
        const response = await fetch(nextUrl, {
          headers: {
            'Accept': 'application/fhir+json',
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          throw new Error(`Epic Device API error: ${response.status} ${response.statusText}`);
        }
        
        const bundle: EpicDeviceBundle = await response.json();
        
        // Process devices
        if (bundle.entry) {
          for (const entry of bundle.entry) {
            const device = entry.resource;
            
            // Filter for AI/ML systems
            if (this.isAISystem(device)) {
              systems.push(this.normalizeDevice(device));
            }
          }
        }
        
        // Check for pagination
        const nextLink = bundle.link?.find(link => link.relation === 'next');
        nextUrl = nextLink?.url || null;
      }
      
      logger.info({ 
        systems: systems.length, 
        durationMs: Date.now() - startTime,
      }, 'Epic AI systems fetched');
      
      return systems;
      
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch Epic AI systems');
      throw error;
    }
  }
  
  /**
   * Validate Epic credentials
   */
  validateCredentials(credentials: ProviderCredentials): boolean {
    if (credentials.type !== 'epic') return false;
    
    const epicCreds = credentials as EpicCredentials;
    return !!(epicCreds.clientId && epicCreds.clientSecret);
  }
  
  /**
   * Get OAuth access token (with caching)
   */
  private async getAccessToken(connection: ProviderConnection): Promise<string> {
    const cacheKey = connection.id;
    const cached = this.accessTokenCache.get(cacheKey);
    
    // Return cached token if still valid
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }
    
    // Request new token
    const credentials = connection.credentials as EpicCredentials;
    const tokenUrl = `${connection.baseUrl}/oauth2/token`;
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Epic OAuth failed: ${response.status} ${response.statusText}`);
    }
    
    const tokenData: EpicOAuthToken = await response.json();
    
    // Cache token (expires 5 minutes early for safety)
    const expiresAt = Date.now() + (tokenData.expires_in - 300) * 1000;
    this.accessTokenCache.set(cacheKey, {
      token: tokenData.access_token,
      expiresAt,
    });
    
    return tokenData.access_token;
  }
  
  /**
   * Determine if device is an AI/ML system
   */
  private isAISystem(device: EpicFHIRDevice): boolean {
    const deviceText = JSON.stringify(device).toLowerCase();
    
    // Keywords indicating AI/ML
    const aiKeywords = [
      'artificial intelligence',
      'machine learning',
      'deep learning',
      'neural network',
      'ai',
      'ml',
      'predictive',
      'algorithm',
      'clinical decision support',
      'cds',
    ];
    
    return aiKeywords.some(keyword => deviceText.includes(keyword));
  }
  
  /**
   * Normalize Epic device to provider system format
   */
  private normalizeDevice(device: EpicFHIRDevice): ProviderAISystem {
    return {
      providerType: 'epic',
      providerSystemId: device.id,
      
      name: device.displayName || device.type?.text || `Epic Device ${device.id}`,
      description: device.note?.[0]?.text,
      vendor: device.manufacturer,
      version: device.version?.[0]?.value,
      
      clinicalUseCase: device.type?.text,
      
      modelType: this.inferModelType(device),
      deploymentStatus: this.mapStatus(device.status),
      
      // Epic devices don't expose PHI access directly - assume true for healthcare context
      phiAccess: true,
      
      lastModified: device.meta?.lastUpdated ? new Date(device.meta.lastUpdated) : undefined,
    };
  }
  
  /**
   * Infer model type from device data
   */
  private inferModelType(device: EpicFHIRDevice): string | undefined {
    const text = JSON.stringify(device).toLowerCase();
    
    if (text.includes('nlp') || text.includes('natural language')) {
      return 'NLP';
    }
    if (text.includes('image') || text.includes('radiology') || text.includes('vision')) {
      return 'Computer Vision';
    }
    if (text.includes('predict')) {
      return 'Predictive Analytics';
    }
    if (text.includes('decision support') || text.includes('cds')) {
      return 'Clinical Decision Support';
    }
    
    return 'AI/ML System';
  }
  
  /**
   * Map Epic device status to our deployment status
   */
  private mapStatus(status?: string): 'active' | 'inactive' | 'testing' | 'deprecated' {
    switch (status) {
      case 'active':
        return 'active';
      case 'inactive':
      case 'entered-in-error':
        return 'inactive';
      default:
        return 'inactive';
    }
  }
}
