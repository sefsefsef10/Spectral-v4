/**
 * APPLICATION LAYER USE CASE: Execute Health Check
 */

import { Deployment } from '../../domain/entities/Deployment';
import type { IDeploymentRepository } from '../../domain/repositories/IDeploymentRepository';

export interface HealthCheckExecutor {
  execute(endpoint: string, expectedStatus: number, timeout: number): Promise<{ success: boolean; error?: string }>;
}

export interface ExecuteHealthCheckInput {
  deploymentId: string;
}

export interface ExecuteHealthCheckResult {
  deploymentId: string;
  allHealthy: boolean;
  unhealthyCount: number;
  shouldRollback: boolean;
}

export class ExecuteHealthCheckUseCase {
  constructor(
    private deploymentRepository: IDeploymentRepository,
    private healthCheckExecutor: HealthCheckExecutor
  ) {}

  async execute(input: ExecuteHealthCheckInput): Promise<ExecuteHealthCheckResult> {
    const deployment = await this.deploymentRepository.findById(input.deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${input.deploymentId}`);
    }

    for (const check of deployment.healthChecks) {
      const result = await this.healthCheckExecutor.execute(
        check.endpoint,
        check.expectedStatus,
        check.timeout
      );
      deployment.recordHealthCheckResult(check.endpoint, result.success, result.error);
    }

    await this.deploymentRepository.save(deployment);

    return {
      deploymentId: deployment.id!,
      allHealthy: deployment.areAllHealthChecksPassing(),
      unhealthyCount: deployment.getUnhealthyCheckCount(),
      shouldRollback: deployment.shouldTriggerAutoRollback(),
    };
  }
}
