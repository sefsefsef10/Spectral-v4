/**
 * INFRASTRUCTURE LAYER: Alert Repository
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import { Alert, type Severity, type AlertChannel } from '../../domain/entities/Alert';
import type { IAlertRepository } from '../../domain/repositories/IAlertRepository';
import { db } from '../../db';
import { monitoringAlerts } from '../../../shared/schema';

export class DrizzleAlertRepository implements IAlertRepository {
  private constructor(private database: typeof db) {}

  private static instance: DrizzleAlertRepository;

  static getInstance(database: typeof db): DrizzleAlertRepository {
    if (!DrizzleAlertRepository.instance) {
      DrizzleAlertRepository.instance = new DrizzleAlertRepository(database);
    }
    return DrizzleAlertRepository.instance;
  }

  async save(alert: Alert): Promise<void> {
    const data = this.toDatabase(alert);
    
    if (await this.findById(alert.id!)) {
      await this.database
        .update(monitoringAlerts)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(monitoringAlerts.id, alert.id!));
    } else {
      await this.database.insert(monitoringAlerts).values(data);
    }
  }

  async findById(id: string): Promise<Alert | null> {
    const [row] = await this.database
      .select()
      .from(monitoringAlerts)
      .where(eq(monitoringAlerts.id, id))
      .limit(1);

    return row ? this.toDomain(row) : null;
  }

  async findByAiSystemId(aiSystemId: string): Promise<Alert[]> {
    const rows = await this.database
      .select()
      .from(monitoringAlerts)
      .where(eq(monitoringAlerts.aiSystemId, aiSystemId))
      .orderBy(desc(monitoringAlerts.createdAt));

    return rows.map(row => this.toDomain(row));
  }

  async findDuplicates(alert: Alert): Promise<Alert[]> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const rows = await this.database
      .select()
      .from(monitoringAlerts)
      .where(
        and(
          eq(monitoringAlerts.aiSystemId, alert.aiSystemId),
          eq(monitoringAlerts.type, alert.type),
          eq(monitoringAlerts.severity, alert.severity)
        )
      );

    return rows
      .map(row => this.toDomain(row))
      .filter(a => a.createdAt >= oneHourAgo && a.status === 'open');
  }

  async findByDeduplicationKey(key: string, withinHours: number): Promise<Alert | null> {
    const timeThreshold = new Date(Date.now() - withinHours * 60 * 60 * 1000);
    
    // Parse the deduplication key: "aiSystemId:type:severity"
    const [aiSystemId, type, severity] = key.split(':');
    
    const rows = await this.database
      .select()
      .from(monitoringAlerts)
      .where(
        and(
          eq(monitoringAlerts.aiSystemId, aiSystemId),
          eq(monitoringAlerts.type, type),
          eq(monitoringAlerts.severity, severity),
          sql`${monitoringAlerts.createdAt} >= ${timeThreshold}`
        )
      )
      .orderBy(desc(monitoringAlerts.createdAt))
      .limit(1);

    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async exists(id: string): Promise<boolean> {
    const alert = await this.findById(id);
    return alert !== null;
  }

  private toDatabase(alert: Alert): any {
    return {
      id: alert.id,
      aiSystemId: alert.aiSystemId,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      details: alert.details,
      status: alert.status,
      acknowledgedAt: alert.acknowledgedAt,
      acknowledgedBy: alert.acknowledgedBy,
      resolvedAt: alert.resolvedAt,
      resolvedBy: alert.resolvedBy,
      slaDeadline: alert.slaDeadline,
      escalatedAt: alert.escalatedAt,
      notificationsSent: alert.notificationsSent,
      createdAt: alert.createdAt,
    };
  }

  private toDomain(row: any): Alert {
    return Alert.fromPersistence({
      id: row.id,
      aiSystemId: row.aiSystemId,
      type: row.type,
      severity: row.severity as Severity,
      message: row.message,
      details: row.details,
      status: row.status,
      acknowledgedAt: row.acknowledgedAt,
      acknowledgedBy: row.acknowledgedBy,
      resolvedAt: row.resolvedAt,
      resolvedBy: row.resolvedBy,
      slaDeadline: row.slaDeadline,
      escalatedAt: row.escalatedAt,
      notificationsSent: row.notificationsSent as AlertChannel[],
      createdAt: row.createdAt,
    });
  }
}
