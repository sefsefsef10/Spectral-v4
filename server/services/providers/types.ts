/**
 * Provider Adapter Types
 * 
 * Abstracts differences between EHR systems (Epic, Cerner, Athenahealth)
 * and AI monitoring platforms (LangSmith, LangFuse, Arize, W&B)
 */

export type ProviderType = 
  | 'epic'
  | 'cerner' 
  | 'athenahealth'
  | 'langsmith'
  | 'langfuse'
  | 'arize'
  | 'wandb';

export type ProviderCategory = 'ehr' | 'ai_monitoring';

/**
 * Normalized AI system data from any provider
 */
export interface ProviderAISystem {
  // Provider metadata
  providerType: ProviderType;
  providerSystemId: string; // ID in provider's system
  
  // System information
  name: string;
  description?: string;
  vendor?: string;
  version?: string;
  
  // Clinical context (EHR providers)
  clinicalUseCase?: string;
  departmentId?: string;
  departmentName?: string;
  
  // Technical details
  modelType?: string;
  deploymentStatus?: 'active' | 'inactive' | 'testing' | 'deprecated';
  
  // Compliance & Risk
  phiAccess?: boolean;
  fdaClassification?: string;
  
  // Timestamps
  lastModified?: Date;
  firstDeployed?: Date;
}

/**
 * Provider connection configuration
 */
export interface ProviderConnection {
  id: string;
  healthSystemId: string;
  providerType: ProviderType;
  
  // Connection details
  baseUrl: string;
  credentials: ProviderCredentials;
  
  // Status
  status: 'active' | 'inactive' | 'error';
  lastSyncAt?: Date;
  lastError?: string;
  
  // Configuration
  syncEnabled: boolean;
  syncIntervalMinutes: number;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Provider-specific credentials (encrypted in database)
 */
export type ProviderCredentials = 
  | EpicCredentials
  | CernerCredentials
  | LangSmithCredentials;

export interface EpicCredentials {
  type: 'epic';
  clientId: string;
  clientSecret: string;
  tenantId?: string;
}

export interface CernerCredentials {
  type: 'cerner';
  clientId: string;
  clientSecret: string;
}

export interface LangSmithCredentials {
  type: 'langsmith';
  apiKey: string;
}

/**
 * Sync result from provider
 */
export interface ProviderSyncResult {
  providerType: ProviderType;
  systemsDiscovered: number;
  systemsCreated: number;
  systemsUpdated: number;
  errors: string[];
  syncedAt: Date;
  durationMs: number;
}

/**
 * Base provider adapter interface
 */
export interface IProviderAdapter {
  readonly providerType: ProviderType;
  readonly category: ProviderCategory;
  
  /**
   * Test connection to provider
   */
  testConnection(connection: ProviderConnection): Promise<boolean>;
  
  /**
   * Fetch AI systems from provider
   */
  fetchAISystems(connection: ProviderConnection): Promise<ProviderAISystem[]>;
  
  /**
   * Validate credentials format
   */
  validateCredentials(credentials: ProviderCredentials): boolean;
}
