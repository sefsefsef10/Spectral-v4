/**
 * APPLICATION LAYER: Get Deployment Status Use Case
 */

import { Deployment } from '../../domain/entities/Deployment';
import type { IDeploymentRepository } from '../../domain/repositories/IDeploymentRepository';

interface GetDeploymentStatusRequest{
  deploymentId: string;
}

export class GetDeploymentStatusUseCase {
  constructor(private deploymentRepository: IDeploymentRepository) {}

  async execute(request: GetDeploymentStatusRequest): Promise<Deployment> {
    const { deploymentId } = request;

    const deployment = await this.deploymentRepository.findById(deploymentId);

    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    return deployment;
  }
}
