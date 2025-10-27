/**
 * APPLICATION LAYER USE CASE: Validate Deployment
 */

import { Deployment } from '../../domain/entities/Deployment';
import type { IDeploymentRepository } from '../../domain/repositories/IDeploymentRepository';

export interface ValidateDeploymentInput {
  deploymentId: string;
}

export interface ValidateDeploymentResult {
  valid: boolean;
  errors: string[];
  deploymentId: string;
}

export class ValidateDeploymentUseCase {
  constructor(private deploymentRepository: IDeploymentRepository) {}

  async execute(input: ValidateDeploymentInput): Promise<ValidateDeploymentResult> {
    const deployment = await this.deploymentRepository.findById(input.deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${input.deploymentId}`);
    }

    const validation = deployment.validateReadyToStart();

    return {
      valid: validation.valid,
      errors: validation.errors,
      deploymentId: deployment.id!,
    };
  }
}
