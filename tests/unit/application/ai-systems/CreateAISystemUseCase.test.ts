/**
 * CreateAISystemUseCase Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CreateAISystemUseCase } from '../../../../server/application/ai-systems/CreateAISystemUseCase';
import { AISystem, RiskLevel, SystemStatus } from '../../../../server/domain/entities/AISystem';
import { AISystemRepository } from '../../../../server/domain/repositories/AISystemRepository';
import { UsageLimitGateway, UsageLimitCheckResult } from '../../../../server/domain/gateways/UsageLimitGateway';

// In-memory test implementations
class InMemoryAISystemRepository implements AISystemRepository {
  private systems: AISystem[] = [];

  async findById(id: string): Promise<AISystem | null> {
    return this.systems.find(s => s.id === id) || null;
  }

  async findByHealthSystemId(healthSystemId: string): Promise<AISystem[]> {
    return this.systems.filter(s => s.healthSystemId === healthSystemId);
  }

  async countByHealthSystemId(healthSystemId: string): Promise<number> {
    return this.systems.filter(s => s.healthSystemId === healthSystemId).length;
  }

  async save(aiSystem: AISystem): Promise<AISystem> {
    const snapshot = aiSystem.toSnapshot();
    snapshot.id = `ai-${Date.now()}`; // Simulate DB ID generation
    const savedSystem = AISystem.fromPersistence(snapshot);
    this.systems.push(savedSystem);
    return savedSystem;
  }

  async update(aiSystem: AISystem): Promise<AISystem> {
    const index = this.systems.findIndex(s => s.id === aiSystem.id);
    if (index >= 0) {
      this.systems[index] = aiSystem;
    }
    return aiSystem;
  }

  async delete(id: string): Promise<void> {
    this.systems = this.systems.filter(s => s.id !== id);
  }
}

class MockUsageLimitGateway implements UsageLimitGateway {
  private limitReached = false;
  private currentCount = 0;
  private limit = 10;

  setLimitReached(reached: boolean, current = 10, limit = 10): void {
    this.limitReached = reached;
    this.currentCount = current;
    this.limit = limit;
  }

  async canAddAISystem(healthSystemId: string): Promise<UsageLimitCheckResult> {
    if (this.limitReached) {
      return {
        allowed: false,
        message: `Tier limit reached: ${this.currentCount}/${this.limit} AI systems`,
        current: this.currentCount,
        limit: this.limit
      };
    }

    return {
      allowed: true,
      message: 'Within tier limits',
      current: this.currentCount,
      limit: this.limit
    };
  }
}

describe('CreateAISystemUseCase', () => {
  let useCase: CreateAISystemUseCase;
  let repository: InMemoryAISystemRepository;
  let usageLimitGateway: MockUsageLimitGateway;

  beforeEach(() => {
    repository = new InMemoryAISystemRepository();
    usageLimitGateway = new MockUsageLimitGateway();
    useCase = new CreateAISystemUseCase(repository, usageLimitGateway);
  });

  describe('successful creation', () => {
    it('should create AI system with minimum required fields', async () => {
      const request = {
        healthSystemId: 'hs-123',
        name: 'Clinical AI Assistant'
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(true);
      expect(response.aiSystem).toBeDefined();
      expect(response.aiSystem?.name).toBe('Clinical AI Assistant');
      expect(response.aiSystem?.healthSystemId).toBe('hs-123');
      expect(response.aiSystem?.riskLevel).toBe(RiskLevel.MEDIUM); // Default
      expect(response.aiSystem?.status).toBe(SystemStatus.TESTING); // Default
    });

    it('should create AI system with all optional fields', async () => {
      const request = {
        healthSystemId: 'hs-123',
        name: 'Radiology AI',
        description: 'Chest X-ray analysis',
        riskLevel: RiskLevel.HIGH,
        status: SystemStatus.ACTIVE,
        usesPHI: true,
        fdaClassification: 'Class II',
        category: 'Medical Imaging',
        clinicalUseCase: 'Diagnostic Support',
        department: 'Radiology',
        monitoringEnabled: true,
        vendorId: 'vendor-456'
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(true);
      expect(response.aiSystem?.description).toBe('Chest X-ray analysis');
      expect(response.aiSystem?.riskLevel).toBe(RiskLevel.HIGH);
      expect(response.aiSystem?.status).toBe(SystemStatus.ACTIVE);
      expect(response.aiSystem?.usesPHI).toBe(true);
      expect(response.aiSystem?.fdaClassification).toBe('Class II');
      expect(response.aiSystem?.monitoringEnabled).toBe(true);
    });

    it('should persist AI system to repository', async () => {
      const request = {
        healthSystemId: 'hs-123',
        name: 'Test System'
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(true);
      expect(response.aiSystem?.id).toBeTruthy(); // DB generated ID

      // Verify it's in repository
      const found = await repository.findById(response.aiSystem!.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe('Test System');
    });
  });

  describe('tier limit enforcement', () => {
    it('should reject creation if tier limit reached', async () => {
      usageLimitGateway.setLimitReached(true, 3, 3);

      const request = {
        healthSystemId: 'hs-123',
        name: 'New System'
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Tier limit reached');
      expect(response.usageLimitError).toBeDefined();
      expect(response.usageLimitError?.current).toBe(3);
      expect(response.usageLimitError?.limit).toBe(3);
      expect(response.usageLimitError?.upgradeRequired).toBe(true);
    });

    it('should check tier limits BEFORE domain validation', async () => {
      usageLimitGateway.setLimitReached(true, 10, 10);

      // This request has invalid name (too short), but tier limit check should fail first
      const request = {
        healthSystemId: 'hs-123',
        name: 'AI' // Invalid: too short
      };

      const response = await useCase.execute(request);

      // Should fail on tier limit, not domain validation
      expect(response.success).toBe(false);
      expect(response.error).toBe('Tier limit reached');
    });

    it('should allow creation if within tier limits', async () => {
      usageLimitGateway.setLimitReached(false, 2, 10);

      const request = {
        healthSystemId: 'hs-123',
        name: 'New System'
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(true);
      expect(response.aiSystem).toBeDefined();
    });
  });

  describe('domain validation', () => {
    it('should reject if name is too short', async () => {
      const request = {
        healthSystemId: 'hs-123',
        name: 'AI' // Too short
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(false);
      expect(response.error).toContain('at least 3 characters');
    });

    it('should reject if high risk system without monitoring', async () => {
      const request = {
        healthSystemId: 'hs-123',
        name: 'High Risk System',
        riskLevel: RiskLevel.HIGH,
        monitoringEnabled: false
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(false);
      expect(response.error).toContain('must have monitoring enabled');
    });

    it('should reject if provider metadata incomplete', async () => {
      const request: any = {
        healthSystemId: 'hs-123',
        name: 'Epic System',
        providerType: 'epic'
        // Missing providerSystemId
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(false);
      expect(response.error).toContain('both providerType and providerSystemId');
    });
  });

  describe('multi-tenant security', () => {
    it('should enforce healthSystemId from request', async () => {
      const request = {
        healthSystemId: 'hs-123',
        name: 'Test System'
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(true);
      expect(response.aiSystem?.healthSystemId).toBe('hs-123');
    });

    it('should isolate systems by health system ID', async () => {
      // Create system for hs-123
      await useCase.execute({
        healthSystemId: 'hs-123',
        name: 'System A'
      });

      // Create system for hs-456
      await useCase.execute({
        healthSystemId: 'hs-456',
        name: 'System B'
      });

      // Verify isolation
      const hs123Systems = await repository.findByHealthSystemId('hs-123');
      const hs456Systems = await repository.findByHealthSystemId('hs-456');

      expect(hs123Systems.length).toBe(1);
      expect(hs456Systems.length).toBe(1);
      expect(hs123Systems[0].name).toBe('System A');
      expect(hs456Systems[0].name).toBe('System B');
    });
  });
});
