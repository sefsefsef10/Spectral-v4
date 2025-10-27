/**
 * APPLICATION LAYER: Advance Canary Use Case
 */

import { Deployment } from '../../domain/entities/Deployment';
import type { IDeploymentRepository } from '../../domain/repositories/IDeploymentRepository';

interface AdvanceCanaryRequest {
  deploymentId: string;
}

export class AdvanceCanaryUseCase {
  constructor(private deploymentRepository: IDeploymentRepository) {}

  async execute(request: AdvanceCanaryRequest): Promise<Deployment> {
    const { deploymentId } = request;

    const deployment = await this.deploymentRepository.findById(deploymentId);

    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    deployment.advanceCanary();
    await this.deploymentRepository.save(deployment);

    return deployment;
  }
}
