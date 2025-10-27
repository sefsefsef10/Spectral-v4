/**
 * Epic FHIR Integration Service
 * 
 * Implements actual Epic FHIR API polling for AI system discovery
 * via the Device resource type per Epic FHIR R4 specification.
 * 
 * OAuth 2.0 Backend Services Authorization (client_credentials flow)
 * Device API: GET [base]/Device?[search_params]
 */

import { logger } from "../logger";

interface EpicCredentials {
  clientId: string;
  privateKey: string; // JWT private key for backend auth
  tokenUrl: string; // e.g., https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token
  fhirBaseUrl: string; // e.g., https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
}

interface FHIRDevice {
  resourceType: "Device";
  id: string;
  identifier?: Array<{
    system?: string;
    value?: string;
  }>;
  type?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  manufacturer?: string;
  deviceName?: Array<{
    name: string;
    type: "user-friendly-name" | "model-name" | "patient-reported-name";
  }>;
  modelNumber?: string;
  version?: Array<{
    type?: {
      text?: string;
    };
    value?: string;
  }>;
  specialization?: Array<{
    systemType?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
  }>;
  status?: "active" | "inactive" | "entered-in-error" | "unknown";
}

interface FHIRBundle {
  resourceType: "Bundle";
  type: "searchset";
  total?: number;
  entry?: Array<{
    fullUrl?: string;
    resource: FHIRDevice;
  }>;
}

interface DiscoveredAISystem {
  name: string;
  vendor?: string;
  category?: string;
  description?: string;
  discoverySource: string;
  confidence: number;
  externalId?: string;
  department?: string;
}

export class EpicFHIRService {
  // Cache tokens per client to prevent cross-tenant token reuse (SECURITY CRITICAL)
  private tokenCache: Map<string, { token: string; expiry: Date }> = new Map();

  /**
   * Get OAuth 2.0 access token using Backend Services Authorization
   * https://fhir.epic.com/Documentation?docId=oauth2&section=BackendOAuth2Guide
   */
  private async getAccessToken(credentials: EpicCredentials): Promise<string> {
    // Create cache key from clientId + tokenUrl to ensure tenant isolation
    const cacheKey = `${credentials.clientId}:${credentials.tokenUrl}`;
    
    // Check if cached token for THIS tenant is still valid
    const cached = this.tokenCache.get(cacheKey);
    if (cached && new Date() < cached.expiry) {
      return cached.token;
    }

    try {
      const jwt = await import('jsonwebtoken');
      
      // Create JWT assertion for client authentication
      const jwtPayload = {
        iss: credentials.clientId, // client_id
        sub: credentials.clientId, // client_id (for backend apps)
        aud: credentials.tokenUrl,
        jti: this.generateJTI(), // unique identifier
        exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes
      };

      const jwtToken = jwt.sign(jwtPayload, credentials.privateKey, {
        algorithm: 'RS384', // Epic requires RS384
      });

      // Exchange JWT for access token
      const response = await fetch(credentials.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
          client_assertion: jwtToken,
          scope: 'system/Device.read', // FHIR scope for Device resource
        }).toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Epic OAuth failed (${response.status}): ${error}`);
      }

      const tokenData = await response.json();
      const accessToken = tokenData.access_token;
      
      // Cache token for THIS tenant only (prevent cross-tenant token reuse)
      const expiresIn = tokenData.expires_in || 3600;
      const expiry = new Date(Date.now() + expiresIn * 1000);
      this.tokenCache.set(cacheKey, { token: accessToken, expiry });

      logger.info({ 
        tokenUrl: credentials.tokenUrl,
        clientId: credentials.clientId,
        expiresIn 
      }, "Epic FHIR access token obtained for tenant");

      return accessToken;
    } catch (error) {
      logger.error({ err: error }, "Failed to get Epic access token");
      throw error;
    }
  }

  /**
   * Query Epic FHIR Device API for AI systems
   * Device resources can represent medical devices, software, algorithms
   */
  async discoverAISystems(credentials: EpicCredentials): Promise<DiscoveredAISystem[]> {
    try {
      const accessToken = await this.getAccessToken(credentials);
      const discovered: DiscoveredAISystem[] = [];

      // Search for devices that are likely AI systems
      // Epic may categorize AI/ML as software devices or clinical decision support
      const searchParams = new URLSearchParams({
        // type: 'software', // SNOMED CT code for software device
        status: 'active',
        _count: '100', // Pagination limit
      });

      const response = await fetch(
        `${credentials.fhirBaseUrl}/Device?${searchParams.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/fhir+json',
            'Epic-Client-ID': credentials.clientId,
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Epic FHIR API failed (${response.status}): ${error}`);
      }

      const bundle: FHIRBundle = await response.json();

      if (!bundle.entry || bundle.entry.length === 0) {
        logger.info("No devices found in Epic FHIR");
        return [];
      }

      logger.info({ 
        total: bundle.total,
        returned: bundle.entry.length 
      }, "Devices retrieved from Epic FHIR");

      // Parse Device resources and identify AI systems
      for (const entry of bundle.entry) {
        const device = entry.resource;
        
        // Filter for AI/ML systems based on device characteristics
        if (this.isLikelyAISystem(device)) {
          const aiSystem = this.parseDeviceToAISystem(device);
          discovered.push(aiSystem);
        }
      }

      logger.info({ 
        devicesScanned: bundle.entry.length,
        aiSystemsFound: discovered.length 
      }, "Epic FHIR discovery complete");

      return discovered;
    } catch (error) {
      logger.error({ err: error }, "Epic FHIR discovery failed");
      throw error;
    }
  }

  /**
   * Determine if a FHIR Device is likely an AI/ML system
   * Heuristics:
   * - Device type contains keywords: AI, ML, algorithm, prediction, decision support
   * - Manufacturer is known AI vendor (Epic, Aidoc, Viz.ai, etc.)
   * - Device name contains AI-related terms
   */
  private isLikelyAISystem(device: FHIRDevice): boolean {
    const aiKeywords = [
      'ai', 'artificial intelligence', 'machine learning', 'ml',
      'algorithm', 'prediction', 'predictive', 'decision support',
      'clinical decision', 'sepsis', 'stroke', 'radiology ai',
      'imaging ai', 'diagnostic', 'triage', 'risk score'
    ];

    const knownAIVendors = [
      'epic', 'aidoc', 'viz.ai', 'rad ai', 'enlitic', 'zebra medical',
      'arterys', 'caption health', 'qure.ai', 'paige.ai', 'pathology ai',
      'nuance', 'epic sepsis', 'deterioration index'
    ];

    // Check device type
    const deviceTypeText = device.type?.text?.toLowerCase() || '';
    const deviceTypeCoding = device.type?.coding?.map(c => 
      c.display?.toLowerCase() || ''
    ).join(' ') || '';

    // Check device name
    const deviceNames = device.deviceName?.map(dn => 
      dn.name.toLowerCase()
    ).join(' ') || '';

    // Check manufacturer
    const manufacturer = device.manufacturer?.toLowerCase() || '';

    const searchText = `${deviceTypeText} ${deviceTypeCoding} ${deviceNames} ${manufacturer}`;

    // Match against AI keywords
    const hasAIKeyword = aiKeywords.some(keyword => 
      searchText.includes(keyword)
    );

    // Match against known AI vendors
    const hasAIVendor = knownAIVendors.some(vendor => 
      searchText.includes(vendor)
    );

    return hasAIKeyword || hasAIVendor;
  }

  /**
   * Parse FHIR Device resource to AI system format
   */
  private parseDeviceToAISystem(device: FHIRDevice): DiscoveredAISystem {
    // Extract name (prefer user-friendly name)
    const userFriendlyName = device.deviceName?.find(
      dn => dn.type === 'user-friendly-name'
    )?.name;
    const modelName = device.deviceName?.find(
      dn => dn.type === 'model-name'
    )?.name;
    const firstDeviceName = device.deviceName?.[0]?.name;
    const typeText = device.type?.text;
    
    const name = userFriendlyName || modelName || firstDeviceName || typeText || `Device ${device.id}`;

    // Extract vendor (manufacturer)
    const vendor = device.manufacturer || 'Unknown Vendor';

    // Determine category based on device type
    const category = this.categorizeAISystem(device);

    // Build description
    const description = this.buildDescription(device);

    // Calculate confidence based on information completeness
    const confidence = this.calculateConfidence(device);

    return {
      name,
      vendor,
      category,
      description,
      discoverySource: 'Epic FHIR Device API',
      confidence,
      externalId: device.id,
    };
  }

  /**
   * Categorize AI system based on FHIR Device characteristics
   */
  private categorizeAISystem(device: FHIRDevice): string {
    const typeText = device.type?.text?.toLowerCase() || '';
    const typeDisplay = device.type?.coding?.[0]?.display?.toLowerCase() || '';
    const combinedType = `${typeText} ${typeDisplay}`;

    if (combinedType.includes('sepsis') || combinedType.includes('deterioration')) {
      return 'Clinical Decision Support';
    }
    if (combinedType.includes('radiology') || combinedType.includes('imaging')) {
      return 'Medical Imaging';
    }
    if (combinedType.includes('pathology')) {
      return 'Pathology AI';
    }
    if (combinedType.includes('stroke') || combinedType.includes('neurology')) {
      return 'Neurology AI';
    }
    if (combinedType.includes('cardiology') || combinedType.includes('ecg')) {
      return 'Cardiology AI';
    }
    if (combinedType.includes('documentation') || combinedType.includes('administrative')) {
      return 'Administrative';
    }
    if (combinedType.includes('revenue') || combinedType.includes('billing')) {
      return 'Revenue Cycle';
    }
    
    return 'Clinical Decision Support'; // Default
  }

  /**
   * Build description from Device resource
   */
  private buildDescription(device: FHIRDevice): string {
    const parts: string[] = [];

    if (device.type?.text) {
      parts.push(device.type.text);
    }

    if (device.modelNumber) {
      parts.push(`Model: ${device.modelNumber}`);
    }

    if (device.version && device.version.length > 0) {
      const version = device.version[0];
      if (version.value) {
        parts.push(`Version: ${version.value}`);
      }
    }

    if (device.specialization && device.specialization.length > 0) {
      const spec = device.specialization[0];
      if (spec.systemType?.text) {
        parts.push(`Specialization: ${spec.systemType.text}`);
      }
    }

    return parts.join(' | ') || 'AI/ML system discovered via Epic FHIR';
  }

  /**
   * Calculate confidence score based on completeness of Device data
   */
  private calculateConfidence(device: FHIRDevice): number {
    let score = 0.5; // Base confidence

    if (device.deviceName && device.deviceName.length > 0) {
      score += 0.15;
    }

    if (device.manufacturer) {
      score += 0.15;
    }

    if (device.type?.coding && device.type.coding.length > 0) {
      score += 0.1;
    }

    if (device.modelNumber) {
      score += 0.05;
    }

    if (device.version && device.version.length > 0) {
      score += 0.05;
    }

    return Math.min(score, 0.95); // Cap at 95%
  }

  /**
   * Generate unique JWT ID (jti) for OAuth assertion
   */
  private generateJTI(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Test Epic FHIR connection
   * Returns true if credentials are valid and API is accessible
   */
  async testConnection(credentials: EpicCredentials): Promise<{ 
    success: boolean; 
    message: string; 
  }> {
    try {
      const accessToken = await this.getAccessToken(credentials);
      
      // Test with a minimal Device query
      const response = await fetch(
        `${credentials.fhirBaseUrl}/Device?_count=1`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/fhir+json',
            'Epic-Client-ID': credentials.clientId,
          },
        }
      );

      if (response.ok) {
        return {
          success: true,
          message: 'Epic FHIR connection successful',
        };
      } else {
        const error = await response.text();
        return {
          success: false,
          message: `Epic FHIR API error (${response.status}): ${error}`,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }
}

export const epicFHIRService = new EpicFHIRService();
