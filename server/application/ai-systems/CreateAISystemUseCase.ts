/**
 * Create AI System Use Case
 * 
 * Orchestrates the creation of a new AI system with:
 * - Tier limit enforcement
 * - Multi-tenant security
 * - Domain validation
 * 
 * This is the application layer - it coordinates domain entities,
 * repositories, and external services WITHOUT containing business logic.
 */

import { AISystem, RiskLevel, SystemStatus, ProviderType, IntegrationConfig } from '../../domain/entities/AISystem';
import { AISystemRepository } from '../../domain/repositories/AISystemRepository';
import { UsageLimitGateway, UsageLimitCheckResult } from '../../domain/gateways/UsageLimitGateway';

// Request/Response DTOs (Data Transfer Objects)

export interface CreateAISystemRequest {
  healthSystemId: string;
  name: string;
  description?: string | null;
  riskLevel?: RiskLevel;
  status?: SystemStatus;
  usesPHI?: boolean;
  fdaClassification?: string | null;
  category?: string | null;
  clinicalUseCase?: string | null;
  department?: string | null;
  monitoringEnabled?: boolean;
  integrationConfig?: IntegrationConfig | null;
  providerType?: ProviderType | null;
  providerSystemId?: string | null;
  vendorId?: string | null;
}

export interface CreateAISystemResponse {
  success: boolean;
  aiSystem?: AISystem;
  error?: string;
  usageLimitError?: {
    message: string;
    current: number;
    limit: number;
    upgradeRequired: boolean;
  };
}

/**
 * Use Case Implementation
 */
export class CreateAISystemUseCase {
  constructor(
    private readonly aiSystemRepository: AISystemRepository,
    private readonly usageLimitGateway: UsageLimitGateway
  ) {}

  async execute(request: CreateAISystemRequest): Promise<CreateAISystemResponse> {
    try {
      // 1. Check tier limits BEFORE creating the system
      const usageCheck = await this.usageLimitGateway.canAddAISystem(request.healthSystemId);

      if (!usageCheck.allowed) {
        return {
          success: false,
          error: 'Tier limit reached',
          usageLimitError: {
            message: usageCheck.message,
            current: usageCheck.current,
            limit: usageCheck.limit,
            upgradeRequired: true
          }
        };
      }

      // 2. Create domain entity (validates business rules)
      const aiSystem = AISystem.create(
        request.healthSystemId,
        request.name,
        {
          description: request.description,
          riskLevel: request.riskLevel,
          status: request.status,
          usesPHI: request.usesPHI,
          fdaClassification: request.fdaClassification,
          category: request.category,
          clinicalUseCase: request.clinicalUseCase,
          department: request.department,
          monitoringEnabled: request.monitoringEnabled,
          integrationConfig: request.integrationConfig,
          providerType: request.providerType,
          providerSystemId: request.providerSystemId,
          vendorId: request.vendorId
        }
      );

      // 3. Persist to database
      const savedSystem = await this.aiSystemRepository.save(aiSystem);

      return {
        success: true,
        aiSystem: savedSystem
      };
    } catch (error) {
      // Domain validation errors or persistence errors
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create AI system'
      };
    }
  }
}
