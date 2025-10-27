/**
 * APPLICATION LAYER: List Deployments Use Case
 */

import { Deployment } from '../../domain/entities/Deployment';

export interface DeploymentRepository {
  findByAiSystemId(aiSystemId: string): Promise<Deployment[]>;
  findAll(): Promise<Deployment[]>;
}

interface ListDeploymentsRequest {
  aiSystemId?: string;
  status?: string;
}

export class ListDeploymentsUseCase {
  constructor(private deploymentRepository: DeploymentRepository) {}

  async execute(request: ListDeploymentsRequest): Promise<Deployment[]> {
    const { aiSystemId, status } = request;

    // Fetch deployments by AI system ID or all deployments if not specified
    const deployments = aiSystemId 
      ? await this.deploymentRepository.findByAiSystemId(aiSystemId)
      : await this.deploymentRepository.findAll();

    // Apply status filtering if provided
    if (status) {
      return deployments.filter(d => d.status === status);
    }

    return deployments;
  }
}
