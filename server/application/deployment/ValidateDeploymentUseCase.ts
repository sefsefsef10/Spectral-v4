/**
 * APPLICATION LAYER USE CASE: Validate Deployment
 */

import { Deployment } from '../../domain/entities/Deployment';

export interface DeploymentRepository {
  findById(id: string): Promise<Deployment | null>;
  save(deployment: Deployment): Promise<void>;
}

export interface ValidateDeploymentInput {
  deploymentId: string;
}

export interface ValidateDeploymentResult {
  valid: boolean;
  errors: string[];
  deploymentId: string;
}

export class ValidateDeploymentUseCase {
  constructor(private deploymentRepository: DeploymentRepository) {}

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
