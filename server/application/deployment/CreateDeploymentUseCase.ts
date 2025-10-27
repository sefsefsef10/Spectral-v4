/**
 * APPLICATION LAYER: Create Deployment Use Case
 */

import { Deployment, type DeploymentStrategy, type HealthCheck, type RollbackPolicy } from '../../domain/entities/Deployment';

export interface DeploymentRepository {
  save(deployment: Deployment): Promise<void>;
}

interface CreateDeploymentRequest {
  aiSystemId: string;
  version: string;
  strategy: DeploymentStrategy;
  healthChecks: HealthCheck[];
  rollbackPolicy: RollbackPolicy;
  canaryPercentage?: number;
  createdBy: string;
}

export class CreateDeploymentUseCase {
  constructor(private deploymentRepository: DeploymentRepository) {}

  async execute(request: CreateDeploymentRequest): Promise<Deployment> {
    const deployment = Deployment.create({
      aiSystemId: request.aiSystemId,
      version: request.version,
      strategy: request.strategy,
      healthChecks: request.healthChecks,
      rollbackPolicy: request.rollbackPolicy,
      canaryPercentage: request.canaryPercentage,
      createdBy: request.createdBy
    });

    await this.deploymentRepository.save(deployment);

    return deployment;
  }
}
