/**
 * Drizzle AI System Repository
 * 
 * Infrastructure layer implementation of AISystemRepository interface.
 * Maps between AISystem domain entities and database persistence.
 */

import { db } from '../../db';
import { aiSystems } from '../../../shared/schema';
import { eq, count } from 'drizzle-orm';
import { AISystem, RiskLevel, SystemStatus, ProviderType, IntegrationConfig } from '../../domain/entities/AISystem';
import { AISystemRepository } from '../../domain/repositories/AISystemRepository';

export class DrizzleAISystemRepository implements AISystemRepository {
  async findById(id: string): Promise<AISystem | null> {
    const [row] = await db
      .select()
      .from(aiSystems)
      .where(eq(aiSystems.id, id))
      .limit(1);

    if (!row) {
      return null;
    }

    return this.toDomain(row);
  }

  async findByHealthSystemId(healthSystemId: string): Promise<AISystem[]> {
    const rows = await db
      .select()
      .from(aiSystems)
      .where(eq(aiSystems.healthSystemId, healthSystemId));

    return rows.map(row => this.toDomain(row));
  }

  async countByHealthSystemId(healthSystemId: string): Promise<number> {
    // Use SQL aggregation instead of loading entities
    const [result] = await db
      .select({ count: count() })
      .from(aiSystems)
      .where(eq(aiSystems.healthSystemId, healthSystemId));
    
    return Number(result.count);
  }

  async save(aiSystem: AISystem): Promise<AISystem> {
    const snapshot = aiSystem.toSnapshot();

    const [inserted] = await db
      .insert(aiSystems)
      .values({
        healthSystemId: snapshot.healthSystemId,
        name: snapshot.name,
        description: snapshot.description,
        riskLevel: snapshot.riskLevel,
        status: snapshot.status,
        usesPhi: snapshot.usesPHI,
        fdaClassification: snapshot.fdaClassification,
        category: snapshot.category,
        clinicalUseCase: snapshot.clinicalUseCase,
        department: snapshot.department,
        monitoringEnabled: snapshot.monitoringEnabled,
        integrationConfig: snapshot.integrationConfig ? JSON.stringify(snapshot.integrationConfig) : null,
        providerType: snapshot.providerType,
        providerSystemId: snapshot.providerSystemId,
        vendorId: snapshot.vendorId,
        lastCheck: snapshot.lastCheck,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt
      })
      .returning();

    // Set the database-generated ID on the domain entity
    (aiSystem as any)._setId(inserted.id);
    return aiSystem;
  }

  async update(aiSystem: AISystem): Promise<AISystem> {
    const snapshot = aiSystem.toSnapshot();

    const [updated] = await db
      .update(aiSystems)
      .set({
        name: snapshot.name,
        description: snapshot.description,
        riskLevel: snapshot.riskLevel,
        status: snapshot.status,
        usesPhi: snapshot.usesPHI,
        fdaClassification: snapshot.fdaClassification,
        category: snapshot.category,
        clinicalUseCase: snapshot.clinicalUseCase,
        department: snapshot.department,
        monitoringEnabled: snapshot.monitoringEnabled,
        integrationConfig: snapshot.integrationConfig ? JSON.stringify(snapshot.integrationConfig) : null,
        providerType: snapshot.providerType,
        providerSystemId: snapshot.providerSystemId,
        vendorId: snapshot.vendorId,
        lastCheck: snapshot.lastCheck,
        updatedAt: new Date()
      })
      .where(eq(aiSystems.id, snapshot.id))
      .returning();

    return this.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await db
      .delete(aiSystems)
      .where(eq(aiSystems.id, id));
  }

  // Map database row to domain entity
  private toDomain(row: any): AISystem {
    return AISystem.fromPersistence({
      id: row.id,
      healthSystemId: row.healthSystemId,
      name: row.name,
      description: row.description,
      riskLevel: row.riskLevel as RiskLevel,
      status: row.status as SystemStatus,
      usesPHI: row.usesPhi,
      fdaClassification: row.fdaClassification,
      category: row.category,
      clinicalUseCase: row.clinicalUseCase,
      department: row.department,
      monitoringEnabled: row.monitoringEnabled,
      integrationConfig: row.integrationConfig ? JSON.parse(row.integrationConfig) : null,
      providerType: row.providerType as ProviderType | null,
      providerSystemId: row.providerSystemId,
      vendorId: row.vendorId,
      lastCheck: row.lastCheck,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    });
  }
}
