/**
 * Delete AI System Use Case
 * 
 * Orchestrates AI system deletion with:
 * - Ownership validation
 * - Cascade delete handling (via database constraints)
 * 
 * This is the application layer - it coordinates without business logic.
 */

import { AISystemRepository } from '../../domain/repositories/AISystemRepository';

// Request/Response DTOs

export interface DeleteAISystemRequest {
  aiSystemId: string;
  requestingHealthSystemId: string; // For ownership validation
}

export interface DeleteAISystemResponse {
  success: boolean;
  error?: string;
}

export class DeleteAISystemUseCase {
  constructor(
    private readonly aiSystemRepository: AISystemRepository
  ) {}

  async execute(request: DeleteAISystemRequest): Promise<DeleteAISystemResponse> {
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

      // 3. Delete from database (cascade deletes handled by DB constraints)
      await this.aiSystemRepository.delete(request.aiSystemId);

      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete AI system'
      };
    }
  }
}
