/**
 * APPLICATION LAYER: Get Deployment Status Use Case
 */

import { Deployment } from '../../domain/entities/Deployment';

export interface DeploymentRepository {
  findById(id: string): Promise<Deployment | null>;
}

interface GetDeploymentStatusRequest {
  deploymentId: string;
}

export class GetDeploymentStatusUseCase {
  constructor(private deploymentRepository: DeploymentRepository) {}

  async execute(request: GetDeploymentStatusRequest): Promise<Deployment> {
    const { deploymentId } = request;

    const deployment = await this.deploymentRepository.findById(deploymentId);

    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    return deployment;
  }
}
