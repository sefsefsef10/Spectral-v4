/**
 * APPLICATION LAYER USE CASE: Execute Health Check
 */

import { Deployment } from '../../domain/entities/Deployment';
import type { IDeploymentRepository } from '../../domain/repositories/IDeploymentRepository';

export interface HealthCheckExecutor {
  execute(endpoint: string, expectedStatus: number, timeout: number): Promise<{ success: boolean; error?: string }>;
}

export interface RollbackExecutor {
  execute(deploymentId: string, reason: string): Promise<void>;
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
    private healthCheckExecutor: HealthCheckExecutor,
    private rollbackExecutor?: RollbackExecutor
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

    const shouldRollback = deployment.shouldTriggerAutoRollback();
    
    // Trigger auto-rollback if threshold exceeded
    if (shouldRollback && this.rollbackExecutor) {
      deployment.rollback('Auto-rollback triggered due to health check failures');
      await this.rollbackExecutor.execute(deployment.id!, 'Auto-rollback triggered due to health check failures');
    }
    
    await this.deploymentRepository.save(deployment);

    return {
      deploymentId: deployment.id!,
      allHealthy: deployment.areAllHealthChecksPassing(),
      unhealthyCount: deployment.getUnhealthyCheckCount(),
      shouldRollback,
    };
  }
}
