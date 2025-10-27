/**
 * INFRASTRUCTURE LAYER: Deployment Repository
 */

import { eq } from 'drizzle-orm';
import { Deployment, type DeploymentStrategy } from '../../domain/entities/Deployment';
import type { IDeploymentRepository } from '../../domain/repositories/IDeploymentRepository';
import { db } from '../../db';
import { aiSystemDeployments } from '../../../shared/schema';

export class DrizzleDeploymentRepository implements IDeploymentRepository {
  async save(deployment: Deployment): Promise<void> {
    const data = this.toDatabase(deployment);
    
    if (await this.findById(deployment.id!)) {
      await db
        .update(aiSystemDeployments)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(aiSystemDeployments.id, deployment.id!));
    } else {
      await db.insert(aiSystemDeployments).values(data);
    }
  }

  async findById(id: string): Promise<Deployment | null> {
    const [row] = await db
      .select()
      .from(aiSystemDeployments)
      .where(eq(aiSystemDeployments.id, id))
      .limit(1);

    return row ? this.toDomain(row) : null;
  }

  async findByAiSystemId(aiSystemId: string): Promise<Deployment[]> {
    const rows = await db
      .select()
      .from(aiSystemDeployments)
      .where(eq(aiSystemDeployments.aiSystemId, aiSystemId));

    return rows.map(row => this.toDomain(row));
  }

  async findAll(): Promise<Deployment[]> {
    const rows = await db
      .select()
      .from(aiSystemDeployments);

    return rows.map(row => this.toDomain(row));
  }

  async exists(id: string): Promise<boolean> {
    const deployment = await this.findById(id);
    return deployment !== null;
  }

  private toDatabase(deployment: Deployment): any {
    return {
      id: deployment.id,
      aiSystemId: deployment.aiSystemId,
      version: deployment.version,
      strategy: deployment.strategy,
      status: deployment.status,
      canaryPercentage: deployment.canaryPercentage,
      healthChecks: deployment.healthChecks,
      healthCheckResults: deployment.healthCheckResults,
      consecutiveHealthCheckFailures: deployment.consecutiveHealthCheckFailures,
      rollbackPolicy: deployment.rollbackPolicy,
      errorRate: deployment.errorRate,
      deployedAt: deployment.deployedAt,
      completedAt: deployment.completedAt,
      rolledBackAt: deployment.rolledBackAt,
      rollbackReason: deployment.rollbackReason,
      createdBy: deployment.createdBy,
      createdAt: deployment.createdAt,
    };
  }

  private toDomain(row: any): Deployment {
    return Deployment.fromPersistence({
      id: row.id,
      aiSystemId: row.aiSystemId,
      version: row.version,
      strategy: row.strategy as DeploymentStrategy,
      status: row.status,
      canaryPercentage: row.canaryPercentage,
      healthChecks: row.healthChecks,
      healthCheckResults: row.healthCheckResults,
      consecutiveHealthCheckFailures: row.consecutiveHealthCheckFailures,
      rollbackPolicy: row.rollbackPolicy,
      errorRate: row.errorRate,
      deployedAt: row.deployedAt,
      completedAt: row.completedAt,
      rolledBackAt: row.rolledBackAt,
      rollbackReason: row.rollbackReason,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    });
  }
}
