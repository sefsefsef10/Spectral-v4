/**
 * UpdateAISystemUseCase Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UpdateAISystemUseCase } from '../../../../server/application/ai-systems/UpdateAISystemUseCase';
import { AISystem, RiskLevel, SystemStatus } from '../../../../server/domain/entities/AISystem';
import { AISystemRepository } from '../../../../server/domain/repositories/AISystemRepository';

// In-memory test repository
class InMemoryAISystemRepository implements AISystemRepository {
  private systems: Map<string, AISystem> = new Map();

  async findById(id: string): Promise<AISystem | null> {
    return this.systems.get(id) || null;
  }

  async findByHealthSystemId(healthSystemId: string): Promise<AISystem[]> {
    return Array.from(this.systems.values()).filter(
      s => s.healthSystemId === healthSystemId
    );
  }

  async countByHealthSystemId(healthSystemId: string): Promise<number> {
    return this.findByHealthSystemId(healthSystemId).then(systems => systems.length);
  }

  async save(aiSystem: AISystem): Promise<AISystem> {
    const snapshot = aiSystem.toSnapshot();
    snapshot.id = `ai-${this.systems.size + 1}`;
    const saved = AISystem.fromPersistence(snapshot);
    this.systems.set(saved.id, saved);
    return saved;
  }

  async update(aiSystem: AISystem): Promise<AISystem> {
    this.systems.set(aiSystem.id, aiSystem);
    return aiSystem;
  }

  async delete(id: string): Promise<void> {
    this.systems.delete(id);
  }
}

describe('UpdateAISystemUseCase', () => {
  let useCase: UpdateAISystemUseCase;
  let repository: InMemoryAISystemRepository;

  beforeEach(() => {
    repository = new InMemoryAISystemRepository();
    useCase = new UpdateAISystemUseCase(repository);
  });

  describe('successful updates', () => {
    it('should update AI system properties', async () => {
      // Create initial system
      const system = await repository.save(
        AISystem.create('hs-123', 'Original Name')
      );

      const response = await useCase.execute({
        aiSystemId: system.id,
        requestingHealthSystemId: 'hs-123',
        updates: {
          name: 'Updated Name',
          description: 'New description'
        }
      });

      expect(response.success).toBe(true);
      expect(response.aiSystem?.name).toBe('Updated Name');
      expect(response.aiSystem?.description).toBe('New description');
    });

    it('should update risk level', async () => {
      const system = await repository.save(
        AISystem.create('hs-123', 'Test System', {
          riskLevel: RiskLevel.LOW
        })
      );

      const response = await useCase.execute({
        aiSystemId: system.id,
        requestingHealthSystemId: 'hs-123',
        updates: {
          riskLevel: RiskLevel.MEDIUM
        }
      });

      expect(response.success).toBe(true);
      expect(response.aiSystem?.riskLevel).toBe(RiskLevel.MEDIUM);
    });

    it('should update status with valid transition', async () => {
      const system = await repository.save(
        AISystem.create('hs-123', 'Test System', {
          status: SystemStatus.TESTING
        })
      );

      const response = await useCase.execute({
        aiSystemId: system.id,
        requestingHealthSystemId: 'hs-123',
        updates: {
          status: SystemStatus.ACTIVE
        }
      });

      expect(response.success).toBe(true);
      expect(response.aiSystem?.status).toBe(SystemStatus.ACTIVE);
    });

    it('should update multiple fields at once', async () => {
      const system = await repository.save(
        AISystem.create('hs-123', 'Original', {
          riskLevel: RiskLevel.LOW,
          monitoringEnabled: false
        })
      );

      const response = await useCase.execute({
        aiSystemId: system.id,
        requestingHealthSystemId: 'hs-123',
        updates: {
          name: 'Updated',
          description: 'Updated description',
          riskLevel: RiskLevel.MEDIUM,
          category: 'Diagnostics',
          department: 'Radiology'
        }
      });

      expect(response.success).toBe(true);
      expect(response.aiSystem?.name).toBe('Updated');
      expect(response.aiSystem?.description).toBe('Updated description');
      expect(response.aiSystem?.riskLevel).toBe(RiskLevel.MEDIUM);
      expect(response.aiSystem?.category).toBe('Diagnostics');
      expect(response.aiSystem?.department).toBe('Radiology');
    });

    it('should auto-enable monitoring when upgrading to high risk', async () => {
      const system = await repository.save(
        AISystem.create('hs-123', 'Test System', {
          riskLevel: RiskLevel.MEDIUM,
          monitoringEnabled: false
        })
      );

      const response = await useCase.execute({
        aiSystemId: system.id,
        requestingHealthSystemId: 'hs-123',
        updates: {
          riskLevel: RiskLevel.HIGH
        }
      });

      expect(response.success).toBe(true);
      expect(response.aiSystem?.riskLevel).toBe(RiskLevel.HIGH);
      expect(response.aiSystem?.monitoringEnabled).toBe(true); // Auto-enabled
    });
  });

  describe('ownership validation', () => {
    it('should reject update if AI system not found', async () => {
      const response = await useCase.execute({
        aiSystemId: 'nonexistent',
        requestingHealthSystemId: 'hs-123',
        updates: { name: 'New Name' }
      });

      expect(response.success).toBe(false);
      expect(response.error).toBe('AI system not found');
    });

    it('should reject update if requesting health system does not own the AI system', async () => {
      // Create system owned by hs-123
      const system = await repository.save(
        AISystem.create('hs-123', 'Test System')
      );

      // Try to update from hs-456
      const response = await useCase.execute({
        aiSystemId: system.id,
        requestingHealthSystemId: 'hs-456',
        updates: { name: 'Hacked Name' }
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Access denied');
    });

    it('should allow update if requesting health system owns the AI system', async () => {
      const system = await repository.save(
        AISystem.create('hs-123', 'Test System')
      );

      const response = await useCase.execute({
        aiSystemId: system.id,
        requestingHealthSystemId: 'hs-123',
        updates: { name: 'Updated Name' }
      });

      expect(response.success).toBe(true);
      expect(response.aiSystem?.name).toBe('Updated Name');
    });
  });

  describe('domain validation', () => {
    it('should reject if updated name is too short', async () => {
      const system = await repository.save(
        AISystem.create('hs-123', 'Valid Name')
      );

      const response = await useCase.execute({
        aiSystemId: system.id,
        requestingHealthSystemId: 'hs-123',
        updates: { name: 'AI' } // Too short
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('at least 3 characters');
    });

    it('should reject invalid status transition', async () => {
      const system = await repository.save(
        AISystem.create('hs-123', 'Test System', {
          status: SystemStatus.TESTING
        })
      );

      // Testing → Paused is not allowed
      const response = await useCase.execute({
        aiSystemId: system.id,
        requestingHealthSystemId: 'hs-123',
        updates: { status: SystemStatus.PAUSED }
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Invalid status transition');
    });

    it('should reject if deprecated system tries to transition', async () => {
      const system = await repository.save(
        AISystem.create('hs-123', 'Deprecated System', {
          status: SystemStatus.DEPRECATED
        })
      );

      const response = await useCase.execute({
        aiSystemId: system.id,
        requestingHealthSystemId: 'hs-123',
        updates: { status: SystemStatus.ACTIVE }
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Invalid status transition');
    });
  });

  describe('partial updates', () => {
    it('should only update specified fields', async () => {
      const system = await repository.save(
        AISystem.create('hs-123', 'Original Name', {
          description: 'Original description',
          category: 'Original category'
        })
      );

      const response = await useCase.execute({
        aiSystemId: system.id,
        requestingHealthSystemId: 'hs-123',
        updates: {
          name: 'Updated Name'
          // description and category NOT included
        }
      });

      expect(response.success).toBe(true);
      expect(response.aiSystem?.name).toBe('Updated Name');
      expect(response.aiSystem?.description).toBe('Original description'); // Unchanged
      expect(response.aiSystem?.category).toBe('Original category'); // Unchanged
    });

    it('should allow clearing optional fields', async () => {
      const system = await repository.save(
        AISystem.create('hs-123', 'Test System', {
          description: 'Has description'
        })
      );

      const response = await useCase.execute({
        aiSystemId: system.id,
        requestingHealthSystemId: 'hs-123',
        updates: {
          description: null // Clear description
        }
      });

      expect(response.success).toBe(true);
      expect(response.aiSystem?.description).toBeNull();
    });
  });
});
