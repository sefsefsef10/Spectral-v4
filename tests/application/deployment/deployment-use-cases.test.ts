/**
 * APPLICATION LAYER TESTS: Deployment Use Cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ValidateDeploymentUseCase, type DeploymentRepository as ValidateDeploymentRepository } from '../../../server/application/deployment/ValidateDeploymentUseCase';
import { ExecuteHealthCheckUseCase, type DeploymentRepository as ExecuteHealthCheckRepository, type HealthCheckExecutor } from '../../../server/application/deployment/ExecuteHealthCheckUseCase';
import { RollbackDeploymentUseCase, type DeploymentRepository as RollbackDeploymentRepository, type RollbackExecutor } from '../../../server/application/deployment/RollbackDeploymentUseCase';
import { Deployment } from '../../../server/domain/entities/Deployment';

describe('ValidateDeploymentUseCase', () => {
  let mockRepository: ValidateDeploymentRepository;
  let useCase: ValidateDeploymentUseCase;

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn(),
      save: vi.fn(),
    };
    useCase = new ValidateDeploymentUseCase(mockRepository);
  });

  it('should validate deployment successfully', async () => {
    const deployment = Deployment.create({
      aiSystemId: 'ai-123',
      version: 'v1.0.0',
      strategy: 'rolling',
      healthChecks: [{ endpoint: '/health', expectedStatus: 200, timeout: 5000 }],
      rollbackPolicy: { autoRollback: true, errorThreshold: 5, healthCheckFailures: 3, timeWindow: 10 },
      createdBy: 'user-456',
    });
    deployment._setId('deploy-123');

    vi.mocked(mockRepository.findById).mockResolvedValue(deployment);

    const result = await useCase.execute({ deploymentId: 'deploy-123' });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('ExecuteHealthCheckUseCase', () => {
  let mockRepository: ExecuteHealthCheckRepository;
  let mockExecutor: HealthCheckExecutor;
  let useCase: ExecuteHealthCheckUseCase;

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn(),
      save: vi.fn(),
    };
    mockExecutor = {
      execute: vi.fn().mockResolvedValue({ success: true }),
    };
    useCase = new ExecuteHealthCheckUseCase(mockRepository, mockExecutor);
  });

  it('should execute health checks successfully', async () => {
    const deployment = Deployment.create({
      aiSystemId: 'ai-123',
      version: 'v1.0.0',
      strategy: 'rolling',
      healthChecks: [{ endpoint: '/health', expectedStatus: 200, timeout: 5000 }],
      rollbackPolicy: { autoRollback: true, errorThreshold: 5, healthCheckFailures: 3, timeWindow: 10 },
      createdBy: 'user-456',
    });
    deployment._setId('deploy-123');
    deployment.start();

    vi.mocked(mockRepository.findById).mockResolvedValue(deployment);

    const result = await useCase.execute({ deploymentId: 'deploy-123' });

    expect(result.allHealthy).toBe(true);
    expect(result.unhealthyCount).toBe(0);
    expect(mockExecutor.execute).toHaveBeenCalled();
  });

  it('should detect unhealthy checks', async () => {
    const deployment = Deployment.create({
      aiSystemId: 'ai-123',
      version: 'v1.0.0',
      strategy: 'rolling',
      healthChecks: [{ endpoint: '/health', expectedStatus: 200, timeout: 5000 }],
      rollbackPolicy: { autoRollback: true, errorThreshold: 5, healthCheckFailures: 3, timeWindow: 10 },
      createdBy: 'user-456',
    });
    deployment._setId('deploy-123');
    deployment.start();

    vi.mocked(mockRepository.findById).mockResolvedValue(deployment);
    vi.mocked(mockExecutor.execute).mockResolvedValue({ success: false, error: 'Timeout' });

    const result = await useCase.execute({ deploymentId: 'deploy-123' });

    expect(result.allHealthy).toBe(false);
    expect(result.unhealthyCount).toBe(1);
  });
});

describe('RollbackDeploymentUseCase', () => {
  let mockRepository: RollbackDeploymentRepository;
  let mockExecutor: RollbackExecutor;
  let useCase: RollbackDeploymentUseCase;

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn(),
      save: vi.fn(),
    };
    mockExecutor = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
    useCase = new RollbackDeploymentUseCase(mockRepository, mockExecutor);
  });

  it('should rollback deployment successfully', async () => {
    const deployment = Deployment.create({
      aiSystemId: 'ai-123',
      version: 'v1.0.0',
      strategy: 'rolling',
      healthChecks: [{ endpoint: '/health', expectedStatus: 200, timeout: 5000 }],
      rollbackPolicy: { autoRollback: true, errorThreshold: 5, healthCheckFailures: 3, timeWindow: 10 },
      createdBy: 'user-456',
    });
    deployment._setId('deploy-123');
    deployment.start();

    vi.mocked(mockRepository.findById).mockResolvedValue(deployment);

    const result = await useCase.execute({ 
      deploymentId: 'deploy-123',
      reason: 'High error rate detected',
    });

    expect(result.status).toBe('rolled_back');
    expect(result.rolledBackAt).toBeInstanceOf(Date);
    expect(mockExecutor.execute).toHaveBeenCalledWith('ai-123', true);
  });
});
