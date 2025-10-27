/**
 * APPLICATION LAYER USE CASE: Rollback Deployment
 */

import { Deployment } from '../../domain/entities/Deployment';

export interface DeploymentRepository {
  findById(id: string): Promise<Deployment | null>;
  save(deployment: Deployment): Promise<void>;
}

export interface RollbackExecutor {
  execute(aiSystemId: string, toPreviousVersion: boolean): Promise<void>;
}

export interface RollbackDeploymentInput {
  deploymentId: string;
  reason: string;
}

export interface RollbackDeploymentResult {
  deploymentId: string;
  status: string;
  rolledBackAt: Date;
}

export class RollbackDeploymentUseCase {
  constructor(
    private deploymentRepository: DeploymentRepository,
    private rollbackExecutor: RollbackExecutor
  ) {}

  async execute(input: RollbackDeploymentInput): Promise<RollbackDeploymentResult> {
    const deployment = await this.deploymentRepository.findById(input.deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${input.deploymentId}`);
    }

    deployment.rollback(input.reason);
    await this.rollbackExecutor.execute(deployment.aiSystemId, true);
    await this.deploymentRepository.save(deployment);

    return {
      deploymentId: deployment.id!,
      status: deployment.status,
      rolledBackAt: deployment.rolledBackAt!,
    };
  }
}
