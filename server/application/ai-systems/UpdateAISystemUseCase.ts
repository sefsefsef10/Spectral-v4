/**
 * Update AI System Use Case
 * 
 * Orchestrates AI system updates with:
 * - Ownership validation
 * - Partial update support
 * - Domain validation
 * 
 * This is the application layer - it coordinates without business logic.
 */

import { AISystem, RiskLevel, SystemStatus, IntegrationConfig } from '../../domain/entities/AISystem';
import { AISystemRepository } from '../../domain/repositories/AISystemRepository';

// Request/Response DTOs

export interface UpdateAISystemRequest {
  aiSystemId: string;
  requestingHealthSystemId: string; // For ownership validation
  updates: {
    name?: string;
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
    vendorId?: string | null;
  };
}

export interface UpdateAISystemResponse {
  success: boolean;
  aiSystem?: AISystem;
  error?: string;
}

export class UpdateAISystemUseCase {
  constructor(
    private readonly aiSystemRepository: AISystemRepository
  ) {}

  async execute(request: UpdateAISystemRequest): Promise<UpdateAISystemResponse> {
    try {
      // 1. Load existing AI system
      const existingSystem = await this.aiSystemRepository.findById(request.aiSystemId);

      if (!existingSystem) {
        return {
          success: false,
          error: 'AI system not found'
        };
      }

      // 2. Validate ownership (multi-tenant security)
      if (existingSystem.healthSystemId !== request.requestingHealthSystemId) {
        return {
          success: false,
          error: 'Access denied: you do not own this AI system'
        };
      }

      // 3. Apply updates using domain methods
      const { updates } = request;

      // Handle status updates separately (domain validates transitions)
      if (updates.status !== undefined && updates.status !== existingSystem.status) {
        existingSystem.updateStatus(updates.status);
      }

      // Handle risk level updates separately (domain enforces monitoring)
      if (updates.riskLevel !== undefined && updates.riskLevel !== existingSystem.riskLevel) {
        existingSystem.updateRiskLevel(updates.riskLevel);
      }

      // Handle other property updates
      const propertyUpdates: any = {};
      if (updates.name !== undefined) propertyUpdates.name = updates.name;
      if (updates.description !== undefined) propertyUpdates.description = updates.description;
      if (updates.usesPHI !== undefined) propertyUpdates.usesPHI = updates.usesPHI;
      if (updates.fdaClassification !== undefined) propertyUpdates.fdaClassification = updates.fdaClassification;
      if (updates.category !== undefined) propertyUpdates.category = updates.category;
      if (updates.clinicalUseCase !== undefined) propertyUpdates.clinicalUseCase = updates.clinicalUseCase;
      if (updates.department !== undefined) propertyUpdates.department = updates.department;
      if (updates.monitoringEnabled !== undefined) propertyUpdates.monitoringEnabled = updates.monitoringEnabled;
      if (updates.integrationConfig !== undefined) propertyUpdates.integrationConfig = updates.integrationConfig;
      if (updates.vendorId !== undefined) propertyUpdates.vendorId = updates.vendorId;

      if (Object.keys(propertyUpdates).length > 0) {
        existingSystem.updateProperties(propertyUpdates);
      }

      // 4. Persist updates
      const updatedSystem = await this.aiSystemRepository.update(existingSystem);

      return {
        success: true,
        aiSystem: updatedSystem
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update AI system'
      };
    }
  }
}
