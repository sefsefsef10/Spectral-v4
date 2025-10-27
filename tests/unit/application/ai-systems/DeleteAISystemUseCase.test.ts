/**
 * DeleteAISystemUseCase Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DeleteAISystemUseCase } from '../../../../server/application/ai-systems/DeleteAISystemUseCase';
import { AISystem } from '../../../../server/domain/entities/AISystem';
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

describe('DeleteAISystemUseCase', () => {
  let useCase: DeleteAISystemUseCase;
  let repository: InMemoryAISystemRepository;

  beforeEach(() => {
    repository = new InMemoryAISystemRepository();
    useCase = new DeleteAISystemUseCase(repository);
  });

  describe('successful deletion', () => {
    it('should delete AI system if owned by requesting health system', async () => {
      // Create system
      const system = await repository.save(
        AISystem.create('hs-123', 'Test System')
      );

      expect(await repository.findById(system.id)).toBeDefined();

      // Delete it
      const response = await useCase.execute({
        aiSystemId: system.id,
        requestingHealthSystemId: 'hs-123'
      });

      expect(response.success).toBe(true);
      expect(response.error).toBeUndefined();

      // Verify it's deleted
      expect(await repository.findById(system.id)).toBeNull();
    });

    it('should remove system from repository', async () => {
      const system1 = await repository.save(
        AISystem.create('hs-123', 'System 1')
      );
      const system2 = await repository.save(
        AISystem.create('hs-123', 'System 2')
      );

      // Delete system1
      await useCase.execute({
        aiSystemId: system1.id,
        requestingHealthSystemId: 'hs-123'
      });

      // System1 should be gone
      expect(await repository.findById(system1.id)).toBeNull();

      // System2 should still exist
      expect(await repository.findById(system2.id)).toBeDefined();
    });
  });

  describe('ownership validation', () => {
    it('should reject deletion if AI system not found', async () => {
      const response = await useCase.execute({
        aiSystemId: 'nonexistent',
        requestingHealthSystemId: 'hs-123'
      });

      expect(response.success).toBe(false);
      expect(response.error).toBe('AI system not found');
    });

    it('should reject deletion if requesting health system does not own the AI system', async () => {
      // Create system owned by hs-123
      const system = await repository.save(
        AISystem.create('hs-123', 'Test System')
      );

      // Try to delete from hs-456
      const response = await useCase.execute({
        aiSystemId: system.id,
        requestingHealthSystemId: 'hs-456'
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Access denied');

      // Verify system still exists
      expect(await repository.findById(system.id)).toBeDefined();
    });

    it('should allow deletion if requesting health system owns the AI system', async () => {
      const system = await repository.save(
        AISystem.create('hs-123', 'Test System')
      );

      const response = await useCase.execute({
        aiSystemId: system.id,
        requestingHealthSystemId: 'hs-123'
      });

      expect(response.success).toBe(true);
      expect(await repository.findById(system.id)).toBeNull();
    });
  });

  describe('multi-tenant isolation', () => {
    it('should not allow cross-tenant deletion', async () => {
      // Create systems for different health systems
      const systemA = await repository.save(
        AISystem.create('hs-123', 'System A')
      );
      const systemB = await repository.save(
        AISystem.create('hs-456', 'System B')
      );

      // hs-123 tries to delete hs-456's system
      const response = await useCase.execute({
        aiSystemId: systemB.id,
        requestingHealthSystemId: 'hs-123'
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Access denied');

      // Both systems should still exist
      expect(await repository.findById(systemA.id)).toBeDefined();
      expect(await repository.findById(systemB.id)).toBeDefined();
    });

    it('should only delete within tenant boundary', async () => {
      // Create multiple systems for hs-123
      const system1 = await repository.save(
        AISystem.create('hs-123', 'System 1')
      );
      const system2 = await repository.save(
        AISystem.create('hs-123', 'System 2')
      );

      // Create system for hs-456
      const system3 = await repository.save(
        AISystem.create('hs-456', 'System 3')
      );

      // Delete system1
      await useCase.execute({
        aiSystemId: system1.id,
        requestingHealthSystemId: 'hs-123'
      });

      // Verify isolation
      expect(await repository.findById(system1.id)).toBeNull(); // Deleted
      expect(await repository.findById(system2.id)).toBeDefined(); // Still exists
      expect(await repository.findById(system3.id)).toBeDefined(); // Still exists (different tenant)
    });
  });
});
