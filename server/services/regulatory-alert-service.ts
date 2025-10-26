/**
 * 🚨 REGULATORY ALERT SERVICE - Phase 3 Executive Reporting
 * 
 * Monitors regulatory changes and notifies health systems
 * Tracks FDA, HHS, state regulations, and framework updates
 */

import { db } from "../db";
import {
  regulatoryAlerts,
  healthSystems,
  users,
} from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../logger";

export interface RegulatoryAlertRequest {
  framework: 'HIPAA' | 'NIST_AI_RMF' | 'FDA_SaMD' | 'ISO_27001' | 'State_Law' | 'Joint_Commission';
  alertType: 'new_regulation' | 'guidance_update' | 'enforcement_action' | 'deadline_change' | 'interpretation';
  title: string;
  summary: string;
  impactLevel: 'critical' | 'high' | 'medium' | 'low';
  affectedControls?: string[];
  affectedHealthSystems?: string[]; // By state or specific IDs, or 'all'
  actionRequired?: string;
  deadline?: Date;
  sourceUrl?: string;
  publishedDate: Date;
}

export interface RegulatoryAlert {
  id: string;
  framework: string;
  alertType: string;
  title: string;
  summary: string;
  impactLevel: string;
  affectedControls?: string[];
  affectedHealthSystems?: string[];
  actionRequired?: string;
  deadline?: Date | null;
  sourceUrl?: string | null;
  publishedDate: Date;
  acknowledgedBy: string[];
  status: string;
  createdAt: Date;
}

export class RegulatoryAlertService {
  /**
   * Create a new regulatory alert
   */
  async createAlert(request: RegulatoryAlertRequest): Promise<RegulatoryAlert> {
    logger.info({
      framework: request.framework,
      alertType: request.alertType,
      impactLevel: request.impactLevel,
    }, "Creating regulatory alert");

    const created = await db
      .insert(regulatoryAlerts)
      .values({
        framework: request.framework,
        alertType: request.alertType,
        title: request.title,
        summary: request.summary,
        impactLevel: request.impactLevel,
        affectedControls: request.affectedControls ? JSON.stringify(request.affectedControls) : null,
        affectedHealthSystems: request.affectedHealthSystems ? JSON.stringify(request.affectedHealthSystems) : null,
        actionRequired: request.actionRequired,
        deadline: request.deadline,
        sourceUrl: request.sourceUrl,
        publishedDate: request.publishedDate,
        acknowledgedBy: JSON.stringify([]),
        status: 'active',
      })
      .returning();

    logger.info({
      alertId: created[0].id,
      framework: request.framework,
    }, "Regulatory alert created");

    // TODO: Send notifications to affected health systems
    // This would integrate with email/Slack notification services

    return {
      id: created[0].id,
      framework: created[0].framework,
      alertType: created[0].alertType,
      title: created[0].title,
      summary: created[0].summary,
      impactLevel: created[0].impactLevel,
      affectedControls: typeof created[0].affectedControls === 'string' 
        ? JSON.parse(created[0].affectedControls) 
        : (created[0].affectedControls as any[] || []),
      affectedHealthSystems: typeof created[0].affectedHealthSystems === 'string'
        ? JSON.parse(created[0].affectedHealthSystems)
        : (created[0].affectedHealthSystems as any[] || []),
      actionRequired: created[0].actionRequired || undefined,
      deadline: created[0].deadline,
      sourceUrl: created[0].sourceUrl,
      publishedDate: created[0].publishedDate,
      acknowledgedBy: [],
      status: created[0].status,
      createdAt: created[0].createdAt,
    };
  }

  /**
   * Get all active alerts for a health system
   */
  async getAlertsForHealthSystem(healthSystemId: string): Promise<RegulatoryAlert[]> {
    // Get health system details
    const healthSystem = await db
      .select()
      .from(healthSystems)
      .where(eq(healthSystems.id, healthSystemId))
      .limit(1);

    if (healthSystem.length === 0) {
      return [];
    }

    // Get all active alerts
    const allAlerts = await db
      .select()
      .from(regulatoryAlerts)
      .where(eq(regulatoryAlerts.status, 'active'))
      .orderBy(desc(regulatoryAlerts.publishedDate));

    // Filter to alerts relevant to this health system
    const relevantAlerts = allAlerts.filter(alert => {
      // Parse JSON string to array
      const affectedSystemsRaw = alert.affectedHealthSystems;
      const affectedSystems: string[] = typeof affectedSystemsRaw === 'string'
        ? JSON.parse(affectedSystemsRaw)
        : (Array.isArray(affectedSystemsRaw) ? affectedSystemsRaw : []);

      // If no specific systems listed, alert applies to all
      if (affectedSystems.length === 0) {
        return true;
      }

      // Check if 'all' is listed
      if (affectedSystems.includes('all')) {
        return true;
      }

      // Check if this health system is explicitly listed (exact match only)
      if (affectedSystems.some(sys => sys === healthSystemId)) {
        return true;
      }

      // Check if health system's state is listed (exact match only)
      if (healthSystem[0].state && affectedSystems.some(sys => sys === healthSystem[0].state)) {
        return true;
      }

      return false;
    });

    return relevantAlerts.map(alert => ({
      id: alert.id,
      framework: alert.framework,
      alertType: alert.alertType,
      title: alert.title,
      summary: alert.summary,
      impactLevel: alert.impactLevel,
      affectedControls: typeof alert.affectedControls === 'string'
        ? JSON.parse(alert.affectedControls)
        : (Array.isArray(alert.affectedControls) ? alert.affectedControls : []),
      affectedHealthSystems: typeof alert.affectedHealthSystems === 'string'
        ? JSON.parse(alert.affectedHealthSystems)
        : (Array.isArray(alert.affectedHealthSystems) ? alert.affectedHealthSystems : []),
      actionRequired: alert.actionRequired || undefined,
      deadline: alert.deadline,
      sourceUrl: alert.sourceUrl,
      publishedDate: alert.publishedDate,
      acknowledgedBy: typeof alert.acknowledgedBy === 'string'
        ? JSON.parse(alert.acknowledgedBy)
        : (Array.isArray(alert.acknowledgedBy) ? alert.acknowledgedBy : []),
      status: alert.status,
      createdAt: alert.createdAt,
    }));
  }

  /**
   * Get all alerts (admin view)
   */
  async getAllAlerts(filter?: {
    framework?: string;
    status?: string;
    impactLevel?: string;
  }): Promise<RegulatoryAlert[]> {
    let query = db.select().from(regulatoryAlerts);

    // Apply filters if provided
    const conditions = [];
    if (filter?.framework) {
      conditions.push(eq(regulatoryAlerts.framework, filter.framework));
    }
    if (filter?.status) {
      conditions.push(eq(regulatoryAlerts.status, filter.status));
    }
    if (filter?.impactLevel) {
      conditions.push(eq(regulatoryAlerts.impactLevel, filter.impactLevel));
    }

    const results = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(regulatoryAlerts.publishedDate))
      : await query.orderBy(desc(regulatoryAlerts.publishedDate));

    return results.map(alert => ({
      id: alert.id,
      framework: alert.framework,
      alertType: alert.alertType,
      title: alert.title,
      summary: alert.summary,
      impactLevel: alert.impactLevel,
      affectedControls: typeof alert.affectedControls === 'string'
        ? JSON.parse(alert.affectedControls)
        : (Array.isArray(alert.affectedControls) ? alert.affectedControls : []),
      affectedHealthSystems: typeof alert.affectedHealthSystems === 'string'
        ? JSON.parse(alert.affectedHealthSystems)
        : (Array.isArray(alert.affectedHealthSystems) ? alert.affectedHealthSystems : []),
      actionRequired: alert.actionRequired || undefined,
      deadline: alert.deadline,
      sourceUrl: alert.sourceUrl,
      publishedDate: alert.publishedDate,
      acknowledgedBy: typeof alert.acknowledgedBy === 'string'
        ? JSON.parse(alert.acknowledgedBy)
        : (Array.isArray(alert.acknowledgedBy) ? alert.acknowledgedBy : []),
      status: alert.status,
      createdAt: alert.createdAt,
    }));
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    const alert = await db
      .select()
      .from(regulatoryAlerts)
      .where(eq(regulatoryAlerts.id, alertId))
      .limit(1);

    if (alert.length === 0) {
      throw new Error("Alert not found");
    }

    // Parse JSON string to array
    const acknowledgedByRaw = alert[0].acknowledgedBy;
    const acknowledgedBy: string[] = typeof acknowledgedByRaw === 'string'
      ? JSON.parse(acknowledgedByRaw)
      : (Array.isArray(acknowledgedByRaw) ? acknowledgedByRaw : []);

    // Add user if not already acknowledged
    if (!acknowledgedBy.includes(userId)) {
      acknowledgedBy.push(userId);

      await db
        .update(regulatoryAlerts)
        .set({
          acknowledgedBy: JSON.stringify(acknowledgedBy),
        })
        .where(eq(regulatoryAlerts.id, alertId));

      logger.info({
        alertId,
        userId,
      }, "Regulatory alert acknowledged");
    }
  }

  /**
   * Resolve alert (mark as addressed)
   */
  async resolveAlert(alertId: string, userId: string): Promise<void> {
    await db
      .update(regulatoryAlerts)
      .set({
        status: 'resolved',
      })
      .where(eq(regulatoryAlerts.id, alertId));

    // Also acknowledge
    await this.acknowledgeAlert(alertId, userId);

    logger.info({
      alertId,
      userId,
    }, "Regulatory alert resolved");
  }

  /**
   * Get unacknowledged alerts for a user's health system
   */
  async getUnacknowledgedAlerts(
    healthSystemId: string,
    userId: string
  ): Promise<RegulatoryAlert[]> {
    const allAlerts = await this.getAlertsForHealthSystem(healthSystemId);

    // Filter to alerts not yet acknowledged by this user
    return allAlerts.filter(alert => 
      !alert.acknowledgedBy.includes(userId)
    );
  }

  /**
   * Get critical alerts requiring immediate action
   */
  async getCriticalAlerts(healthSystemId: string): Promise<RegulatoryAlert[]> {
    const allAlerts = await this.getAlertsForHealthSystem(healthSystemId);

    return allAlerts.filter(alert => 
      alert.impactLevel === 'critical' && alert.status === 'active'
    );
  }

  /**
   * Get alerts with upcoming deadlines
   */
  async getAlertsWithDeadlines(
    healthSystemId: string,
    daysAhead: number = 30
  ): Promise<RegulatoryAlert[]> {
    const allAlerts = await this.getAlertsForHealthSystem(healthSystemId);

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return allAlerts.filter(alert => {
      if (!alert.deadline) return false;
      const deadline = new Date(alert.deadline);
      return deadline >= now && deadline <= futureDate;
    });
  }

  /**
   * Get alert statistics for a health system
   */
  async getAlertStats(healthSystemId: string): Promise<{
    total: number;
    active: number;
    resolved: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    unacknowledged: number;
  }> {
    const allAlerts = await this.getAlertsForHealthSystem(healthSystemId);

    return {
      total: allAlerts.length,
      active: allAlerts.filter(a => a.status === 'active').length,
      resolved: allAlerts.filter(a => a.status === 'resolved').length,
      critical: allAlerts.filter(a => a.impactLevel === 'critical').length,
      high: allAlerts.filter(a => a.impactLevel === 'high').length,
      medium: allAlerts.filter(a => a.impactLevel === 'medium').length,
      low: allAlerts.filter(a => a.impactLevel === 'low').length,
      unacknowledged: allAlerts.filter(a => a.acknowledgedBy.length === 0).length,
    };
  }

  /**
   * Seed initial regulatory alerts (for demonstration)
   */
  async seedInitialAlerts(): Promise<void> {
    logger.info("Seeding initial regulatory alerts");

    const alerts: RegulatoryAlertRequest[] = [
      {
        framework: 'FDA_SaMD',
        alertType: 'guidance_update',
        title: 'FDA Updates AI/ML-Based SaMD Action Plan',
        summary: 'FDA has released updated guidance on the regulatory framework for modifications to AI/ML-based Software as a Medical Device, including new requirements for predetermined change control plans.',
        impactLevel: 'high',
        affectedControls: ['CV-1', 'AV-1', 'PM-1'],
        actionRequired: 'Review and update predetermined change control plans for all AI/ML-based medical devices',
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        sourceUrl: 'https://www.fda.gov/medical-devices/software-medical-device-samd/artificial-intelligence-and-machine-learning-aiml-enabled-medical-devices',
        publishedDate: new Date(),
      },
      {
        framework: 'HIPAA',
        alertType: 'enforcement_action',
        title: 'HHS Announces New HIPAA Enforcement Initiative for AI Systems',
        summary: 'Office for Civil Rights (OCR) announces new enforcement priorities targeting AI systems that process protected health information, with focus on algorithmic fairness and privacy safeguards.',
        impactLevel: 'critical',
        affectedControls: ['164.308(a)(1)(i)', '164.308(a)(4)', '164.312(a)(1)'],
        actionRequired: 'Conduct comprehensive HIPAA risk assessment for all AI systems processing PHI',
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        sourceUrl: 'https://www.hhs.gov/hipaa/index.html',
        publishedDate: new Date(),
      },
      {
        framework: 'State_Law',
        alertType: 'new_regulation',
        title: 'California SB 1047 - Safe and Secure Innovation for Frontier AI Models',
        summary: 'New California law requires developers of frontier AI models to implement safety testing, incident reporting, and cybersecurity measures. Effective January 1, 2026.',
        impactLevel: 'high',
        affectedHealthSystems: ['CA'], // California only
        affectedControls: ['CA-SB1047-1', 'CA-SB1047-2'],
        actionRequired: 'Assess which AI models meet frontier model thresholds and implement required safety protocols',
        deadline: new Date('2026-01-01'),
        sourceUrl: 'https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240SB1047',
        publishedDate: new Date(),
      },
      {
        framework: 'NIST_AI_RMF',
        alertType: 'guidance_update',
        title: 'NIST Publishes AI Risk Management Framework Playbook',
        summary: 'NIST has released a comprehensive playbook for implementing the AI Risk Management Framework, including sector-specific guidance for healthcare organizations.',
        impactLevel: 'medium',
        affectedControls: ['GOVERN-1.1', 'MAP-1.1', 'MEASURE-1.1', 'MANAGE-1.1'],
        actionRequired: 'Review NIST playbook and update AI governance framework to align with latest recommendations',
        sourceUrl: 'https://www.nist.gov/itl/ai-risk-management-framework',
        publishedDate: new Date(),
      },
    ];

    // Check if alerts already exist
    const existingAlerts = await db.select().from(regulatoryAlerts);
    if (existingAlerts.length > 0) {
      logger.info("Regulatory alerts already seeded, skipping");
      return;
    }

    // Create alerts
    for (const alert of alerts) {
      await this.createAlert(alert);
    }

    logger.info({ count: alerts.length }, "Initial regulatory alerts seeded");
  }
}

export const regulatoryAlertService = new RegulatoryAlertService();
