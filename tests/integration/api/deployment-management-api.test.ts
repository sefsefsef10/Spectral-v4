/**
 * INTEGRATION TESTS: Deployment Management API
 * Tests the full deployment lifecycle including canary deployments and rollbacks
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CreateDeploymentUseCase } from '../../../server/application/deployment/CreateDeploymentUseCase';
import { GetDeploymentStatusUseCase } from '../../../server/application/deployment/GetDeploymentStatusUseCase';
import { ListDeploymentsUseCase } from '../../../server/application/deployment/ListDeploymentsUseCase';
import { AdvanceCanaryUseCase } from '../../../server/application/deployment/AdvanceCanaryUseCase';
import { RollbackDeploymentUseCase } from '../../../server/application/deployment/RollbackDeploymentUseCase';
import { ExecuteHealthCheckUseCase } from '../../../server/application/deployment/ExecuteHealthCheckUseCase';
import { Deployment, type DeploymentStrategy } from '../../../server/domain/entities/Deployment';

// Mock repository
class InMemoryDeploymentRepository {
  private deployments: Map<string, Deployment> = new Map();

  async save(deployment: Deployment): Promise<void> {
    this.deployments.set(deployment.id!, deployment);
  }

  async findById(id: string): Promise<Deployment | null> {
    return this.deployments.get(id) || null;
  }

  async findByAiSystemId(aiSystemId: string): Promise<Deployment[]> {
    return Array.from(this.deployments.values()).filter(
      (d) => d.aiSystemId === aiSystemId
    );
  }

  async findAll(): Promise<Deployment[]> {
    return Array.from(this.deployments.values());
  }

  clear() {
    this.deployments.clear();
  }
}

describe('Deployment Management API Integration Tests', () => {
  let deploymentRepository: InMemoryDeploymentRepository;

  beforeEach(() => {
    deploymentRepository = new InMemoryDeploymentRepository();
  });

  afterEach(() => {
    deploymentRepository.clear();
  });

  describe('POST /api/deployments', () => {
    it('should create blue-green deployment successfully', async () => {
      const createUseCase = new CreateDeploymentUseCase(deploymentRepository);

      const result = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        version: 'v2.0.0',
        strategy: 'blue_green',
        healthChecks: [
          { endpoint: '/health', expectedStatus: 200, timeout: 5000 },
          { endpoint: '/ready', expectedStatus: 200, timeout: 3000 },
        ],
        rollbackPolicy: {
          autoRollback: true,
          errorThreshold: 0.05,
          healthCheckFailureThreshold: 3,
        },
        createdBy: 'admin-user-123',
      });

      expect(result.aiSystemId).toBe('ai-system-123');
      expect(result.version).toBe('v2.0.0');
      expect(result.strategy).toBe('blue_green');
      expect(result.status).toBe('pending');
      expect(result.healthChecks).toHaveLength(2);
    });

    it('should create canary deployment with correct initial percentage', async () => {
      const createUseCase = new CreateDeploymentUseCase(deploymentRepository);

      const result = await createUseCase.execute({
        aiSystemId: 'ai-system-456',
        version: 'v1.5.0',
        strategy: 'canary',
        healthChecks: [{ endpoint: '/health', expectedStatus: 200, timeout: 5000 }],
        rollbackPolicy: {
          autoRollback: true,
          errorThreshold: 0.05,
          healthCheckFailureThreshold: 3,
        },
        canaryPercentage: 10,
        createdBy: 'admin-user-123',
      });

      expect(result.strategy).toBe('canary');
      expect(result.canaryPercentage).toBe(10);
    });

    it('should reject deployment without health checks', async () => {
      const createUseCase = new CreateDeploymentUseCase(deploymentRepository);

      await expect(
        createUseCase.execute({
          aiSystemId: 'ai-system-789',
          version: 'v3.0.0',
          strategy: 'rolling',
          healthChecks: [],
          rollbackPolicy: {
            autoRollback: true,
            errorThreshold: 0.05,
            healthCheckFailureThreshold: 3,
          },
          createdBy: 'admin-user-123',
        })
      ).rejects.toThrow('At least one health check is required');
    });
  });

  describe('GET /api/deployments/:id/status', () => {
    it('should retrieve deployment status', async () => {
      const createUseCase = new CreateDeploymentUseCase(deploymentRepository);
      const getStatusUseCase = new GetDeploymentStatusUseCase(deploymentRepository);

      const created = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        version: 'v2.0.0',
        strategy: 'blue_green',
        healthChecks: [{ endpoint: '/health', expectedStatus: 200, timeout: 5000 }],
        rollbackPolicy: {
          autoRollback: true,
          errorThreshold: 0.05,
          healthCheckFailureThreshold: 3,
        },
        createdBy: 'admin-user-123',
      });

      const result = await getStatusUseCase.execute({ deploymentId: created.id! });

      expect(result.id).toBe(created.id);
      expect(result.status).toBe('pending');
      expect(result.version).toBe('v2.0.0');
    });

    it('should throw error for non-existent deployment', async () => {
      const getStatusUseCase = new GetDeploymentStatusUseCase(deploymentRepository);

      await expect(
        getStatusUseCase.execute({ deploymentId: 'non-existent-id' })
      ).rejects.toThrow('Deployment not found');
    });
  });

  describe('GET /api/deployments', () => {
    it('should list all deployments when no filter provided', async () => {
      const createUseCase = new CreateDeploymentUseCase(deploymentRepository);
      const listUseCase = new ListDeploymentsUseCase(deploymentRepository);

      // Create multiple deployments
      await createUseCase.execute({
        aiSystemId: 'ai-system-1',
        version: 'v1.0.0',
        strategy: 'blue_green',
        healthChecks: [{ endpoint: '/health', expectedStatus: 200, timeout: 5000 }],
        rollbackPolicy: { autoRollback: true, errorThreshold: 0.05, healthCheckFailureThreshold: 3 },
        createdBy: 'admin',
      });

      await createUseCase.execute({
        aiSystemId: 'ai-system-2',
        version: 'v2.0.0',
        strategy: 'canary',
        healthChecks: [{ endpoint: '/health', expectedStatus: 200, timeout: 5000 }],
        rollbackPolicy: { autoRollback: true, errorThreshold: 0.05, healthCheckFailureThreshold: 3 },
        createdBy: 'admin',
      });

      const result = await listUseCase.execute({});

      expect(result).toHaveLength(2);
    });

    it('should filter deployments by aiSystemId', async () => {
      const createUseCase = new CreateDeploymentUseCase(deploymentRepository);
      const listUseCase = new ListDeploymentsUseCase(deploymentRepository);

      await createUseCase.execute({
        aiSystemId: 'ai-system-1',
        version: 'v1.0.0',
        strategy: 'blue_green',
        healthChecks: [{ endpoint: '/health', expectedStatus: 200, timeout: 5000 }],
        rollbackPolicy: { autoRollback: true, errorThreshold: 0.05, healthCheckFailureThreshold: 3 },
        createdBy: 'admin',
      });

      await createUseCase.execute({
        aiSystemId: 'ai-system-2',
        version: 'v2.0.0',
        strategy: 'canary',
        healthChecks: [{ endpoint: '/health', expectedStatus: 200, timeout: 5000 }],
        rollbackPolicy: { autoRollback: true, errorThreshold: 0.05, healthCheckFailureThreshold: 3 },
        createdBy: 'admin',
      });

      const result = await listUseCase.execute({ aiSystemId: 'ai-system-1' });

      expect(result).toHaveLength(1);
      expect(result[0].aiSystemId).toBe('ai-system-1');
    });

    it('should filter deployments by status', async () => {
      const createUseCase = new CreateDeploymentUseCase(deploymentRepository);
      const listUseCase = new ListDeploymentsUseCase(deploymentRepository);

      const deployment1 = await createUseCase.execute({
        aiSystemId: 'ai-system-1',
        version: 'v1.0.0',
        strategy: 'blue_green',
        healthChecks: [{ endpoint: '/health', expectedStatus: 200, timeout: 5000 }],
        rollbackPolicy: { autoRollback: true, errorThreshold: 0.05, healthCheckFailureThreshold: 3 },
        createdBy: 'admin',
      });

      // Simulate deployment completion
      deployment1.complete();
      await deploymentRepository.save(deployment1);

      await createUseCase.execute({
        aiSystemId: 'ai-system-2',
        version: 'v2.0.0',
        strategy: 'canary',
        healthChecks: [{ endpoint: '/health', expectedStatus: 200, timeout: 5000 }],
        rollbackPolicy: { autoRollback: true, errorThreshold: 0.05, healthCheckFailureThreshold: 3 },
        createdBy: 'admin',
      });

      const result = await listUseCase.execute({ status: 'deployed' });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('deployed');
    });
  });

  describe('POST /api/deployments/:id/advance-canary', () => {
    it('should advance canary deployment by 10%', async () => {
      const createUseCase = new CreateDeploymentUseCase(deploymentRepository);
      const advanceUseCase = new AdvanceCanaryUseCase(deploymentRepository);

      const deployment = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        version: 'v1.0.0',
        strategy: 'canary',
        healthChecks: [{ endpoint: '/health', expectedStatus: 200, timeout: 5000 }],
        rollbackPolicy: { autoRollback: true, errorThreshold: 0.05, healthCheckFailureThreshold: 3 },
        canaryPercentage: 10,
        createdBy: 'admin',
      });

      const result = await advanceUseCase.execute({ deploymentId: deployment.id! });

      expect(result.canaryPercentage).toBe(20);
    });

    it('should complete canary at 100%', async () => {
      const createUseCase = new CreateDeploymentUseCase(deploymentRepository);
      const advanceUseCase = new AdvanceCanaryUseCase(deploymentRepository);

      const deployment = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        version: 'v1.0.0',
        strategy: 'canary',
        healthChecks: [{ endpoint: '/health', expectedStatus: 200, timeout: 5000 }],
        rollbackPolicy: { autoRollback: true, errorThreshold: 0.05, healthCheckFailureThreshold: 3 },
        canaryPercentage: 90,
        createdBy: 'admin',
      });

      const result = await advanceUseCase.execute({ deploymentId: deployment.id! });

      expect(result.canaryPercentage).toBe(100);
      expect(result.status).toBe('deployed');
    });

    it('should reject advancing non-canary deployment', async () => {
      const createUseCase = new CreateDeploymentUseCase(deploymentRepository);
      const advanceUseCase = new AdvanceCanaryUseCase(deploymentRepository);

      const deployment = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        version: 'v1.0.0',
        strategy: 'blue_green',
        healthChecks: [{ endpoint: '/health', expectedStatus: 200, timeout: 5000 }],
        rollbackPolicy: { autoRollback: true, errorThreshold: 0.05, healthCheckFailureThreshold: 3 },
        createdBy: 'admin',
      });

      await expect(
        advanceUseCase.execute({ deploymentId: deployment.id! })
      ).rejects.toThrow('not a canary deployment');
    });
  });

  describe('POST /api/deployments/:id/rollback', () => {
    it('should rollback deployment successfully', async () => {
      const createUseCase = new CreateDeploymentUseCase(deploymentRepository);
      const rollbackUseCase = new RollbackDeploymentUseCase(deploymentRepository);

      const deployment = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        version: 'v2.0.0',
        strategy: 'blue_green',
        healthChecks: [{ endpoint: '/health', expectedStatus: 200, timeout: 5000 }],
        rollbackPolicy: { autoRollback: true, errorThreshold: 0.05, healthCheckFailureThreshold: 3 },
        createdBy: 'admin',
      });

      const result = await rollbackUseCase.execute({
        deploymentId: deployment.id!,
        reason: 'Critical error detected',
        initiatedBy: 'admin-user-123',
      });

      expect(result.status).toBe('rolled_back');
      expect(result.rollbackReason).toBe('Critical error detected');
      expect(result.rolledBackAt).toBeInstanceOf(Date);
    });
  });

  describe('POST /api/deployments/:id/health-check', () => {
    it('should execute health checks and update status', async () => {
      const createUseCase = new CreateDeploymentUseCase(deploymentRepository);
      const healthCheckUseCase = new ExecuteHealthCheckUseCase(deploymentRepository);

      const deployment = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        version: 'v2.0.0',
        strategy: 'blue_green',
        healthChecks: [
          { endpoint: '/health', expectedStatus: 200, timeout: 5000 },
          { endpoint: '/ready', expectedStatus: 200, timeout: 3000 },
        ],
        rollbackPolicy: { autoRollback: true, errorThreshold: 0.05, healthCheckFailureThreshold: 3 },
        createdBy: 'admin',
      });

      const result = await healthCheckUseCase.execute({
        deploymentId: deployment.id!,
        mockResults: [
          { endpoint: '/health', success: true, responseTime: 150 },
          { endpoint: '/ready', success: true, responseTime: 100 },
        ],
      });

      expect(result.healthChecks.every((hc) => hc.isHealthy === true)).toBe(true);
    });

    it('should trigger auto-rollback on health check failures', async () => {
      const createUseCase = new CreateDeploymentUseCase(deploymentRepository);
      const healthCheckUseCase = new ExecuteHealthCheckUseCase(deploymentRepository);

      const deployment = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        version: 'v2.0.0',
        strategy: 'blue_green',
        healthChecks: [{ endpoint: '/health', expectedStatus: 200, timeout: 5000 }],
        rollbackPolicy: { autoRollback: true, errorThreshold: 0.05, healthCheckFailureThreshold: 3 },
        createdBy: 'admin',
      });

      // Fail health checks 3 times
      for (let i = 0; i < 3; i++) {
        await healthCheckUseCase.execute({
          deploymentId: deployment.id!,
          mockResults: [{ endpoint: '/health', success: false, responseTime: 0 }],
        });
      }

      const rolledBack = await deploymentRepository.findById(deployment.id!);
      expect(rolledBack!.status).toBe('rolled_back');
      expect(rolledBack!.rollbackReason).toContain('Auto-rollback triggered');
    });
  });
});
