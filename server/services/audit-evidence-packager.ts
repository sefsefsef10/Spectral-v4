/**
 * 📦 AUDIT EVIDENCE PACKAGER - Phase 3 Executive Reporting
 * 
 * Automatically collects and packages audit evidence across all compliance controls
 * Generates completeness reports and downloadable evidence packages for auditors
 */

import { db } from "../db";
import {
  auditEvidencePackages,
  monitoringAlerts,
  complianceCertifications,
  aiSystems,
  auditLogs,
  healthSystems,
} from "../../shared/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { logger } from "../logger";

export interface AuditEvidenceRequest {
  healthSystemId: string;
  framework: 'HIPAA' | 'Joint_Commission' | 'SOC2' | 'NIST_AI_RMF' | 'FDA_SaMD';
  packageType: 'annual_audit' | 'spot_check' | 'certification' | 'incident_investigation';
  auditPeriod: string;
  startDate: Date;
  endDate: Date;
  generatedBy: string;
}

export interface EvidenceItem {
  controlId: string;
  controlName: string;
  evidenceType: 'certification' | 'alert_log' | 'audit_log' | 'system_config' | 'test_result';
  description: string;
  timestamp: Date;
  sourceId: string;
  metadata?: any;
}

export interface AuditPackage {
  id: string;
  framework: string;
  packageType: string;
  auditPeriod: string;
  startDate: Date;
  endDate: Date;
  evidenceItems: EvidenceItem[];
  controlsCovered: string[];
  completenessScore: number;
  status: string;
  createdAt: Date;
}

export class AuditEvidencePackager {
  /**
   * Generate comprehensive audit evidence package
   */
  async generatePackage(request: AuditEvidenceRequest): Promise<AuditPackage> {
    logger.info({
      healthSystemId: request.healthSystemId,
      framework: request.framework,
      packageType: request.packageType,
    }, "Generating audit evidence package");

    // 1. Collect evidence from all sources
    const evidenceItems: EvidenceItem[] = [];

    // Evidence from certifications
    const certifications = await this.collectCertificationEvidence(
      request.healthSystemId,
      request.framework,
      request.startDate,
      request.endDate
    );
    evidenceItems.push(...certifications);

    // Evidence from alerts and compliance violations
    const alertEvidence = await this.collectAlertEvidence(
      request.healthSystemId,
      request.framework,
      request.startDate,
      request.endDate
    );
    evidenceItems.push(...alertEvidence);

    // Evidence from audit logs
    const auditEvidence = await this.collectAuditLogEvidence(
      request.healthSystemId,
      request.framework,
      request.startDate,
      request.endDate
    );
    evidenceItems.push(...auditEvidence);

    // Evidence from system configurations
    const configEvidence = await this.collectSystemConfigEvidence(
      request.healthSystemId,
      request.framework
    );
    evidenceItems.push(...configEvidence);

    // 2. Map evidence to controls
    const controlsCovered = this.extractCoveredControls(evidenceItems);

    // 3. Calculate completeness score
    const completenessScore = this.calculateCompletenessScore(
      request.framework,
      controlsCovered
    );

    // 4. Store package in database
    const created = await db
      .insert(auditEvidencePackages)
      .values({
        healthSystemId: request.healthSystemId,
        framework: request.framework,
        packageType: request.packageType,
        auditPeriod: request.auditPeriod,
        startDate: request.startDate,
        endDate: request.endDate,
        evidenceItems: JSON.stringify(evidenceItems),
        controlsCovered: JSON.stringify(controlsCovered),
        completenessScore: completenessScore.toString(),
        generatedBy: request.generatedBy,
        status: 'complete',
      })
      .returning();

    logger.info({
      packageId: created[0].id,
      framework: request.framework,
      evidenceCount: evidenceItems.length,
      completenessScore,
    }, "Audit evidence package generated");

    return {
      id: created[0].id,
      framework: created[0].framework,
      packageType: created[0].packageType,
      auditPeriod: created[0].auditPeriod!,
      startDate: created[0].startDate,
      endDate: created[0].endDate,
      evidenceItems,
      controlsCovered,
      completenessScore,
      status: created[0].status,
      createdAt: created[0].createdAt,
    };
  }

  /**
   * Collect certification evidence
   */
  private async collectCertificationEvidence(
    healthSystemId: string,
    framework: string,
    startDate: Date,
    endDate: Date
  ): Promise<EvidenceItem[]> {
    // Get all AI systems for this health system
    const systems = await db
      .select()
      .from(aiSystems)
      .where(eq(aiSystems.healthSystemId, healthSystemId));

    if (systems.length === 0) {
      return [];
    }

    const systemIds = systems.map(s => s.id);
    const vendorIdsSet = new Set(systems.map(s => s.vendorId).filter((id): id is string => id !== null));
    const vendorIds = Array.from(vendorIdsSet);

    if (vendorIds.length === 0) {
      return [];
    }

    // Get certifications for vendors associated with this health system's AI systems
    const certifications = await db
      .select()
      .from(complianceCertifications)
      .where(
        and(
          eq(complianceCertifications.type, framework),
          gte(complianceCertifications.createdAt, startDate),
          lte(complianceCertifications.createdAt, endDate)
        )
      );

    // Filter to only certifications for this health system's vendors
    const relevantCerts = certifications.filter(c => vendorIds.includes(c.vendorId));

    // Map certifications to evidence
    return relevantCerts.map(cert => ({
      controlId: this.mapFrameworkToControlId(framework, 'certification'),
      controlName: `${framework} Certification`,
      evidenceType: 'certification' as const,
      description: `Vendor certification ${cert.status} - Type: ${cert.type}`,
      timestamp: cert.createdAt,
      sourceId: cert.id,
      metadata: {
        certificationId: cert.id,
        vendorId: cert.vendorId,
        status: cert.status,
        verifiedDate: cert.verifiedDate,
      },
    }));
  }

  /**
   * Collect alert evidence (compliance violations)
   */
  private async collectAlertEvidence(
    healthSystemId: string,
    framework: string,
    startDate: Date,
    endDate: Date
  ): Promise<EvidenceItem[]> {
    // Get all AI systems for this health system first
    const systems = await db
      .select()
      .from(aiSystems)
      .where(eq(aiSystems.healthSystemId, healthSystemId));

    if (systems.length === 0) {
      return [];
    }

    const systemIds = systems.map(s => s.id);

    // Get alerts for these systems
    const allAlerts = await db
      .select()
      .from(monitoringAlerts)
      .where(
        and(
          gte(monitoringAlerts.createdAt, startDate),
          lte(monitoringAlerts.createdAt, endDate)
        )
      );

    // Filter to alerts for this health system's AI systems
    const healthSystemAlerts = allAlerts.filter(a => systemIds.includes(a.aiSystemId));

    // Filter alerts relevant to this framework
    const relevantAlerts = healthSystemAlerts.filter(alert =>
      this.isAlertRelevantToFramework(alert.type, framework)
    );

    return relevantAlerts.map(alert => ({
      controlId: this.mapAlertTypeToControlId(alert.type, framework),
      controlName: alert.type,
      evidenceType: 'alert_log' as const,
      description: `${alert.type} detected - ${alert.severity} severity: ${alert.message}`,
      timestamp: alert.createdAt,
      sourceId: alert.id,
      metadata: {
        alertId: alert.id,
        severity: alert.severity,
        resolved: alert.resolved,
        aiSystemId: alert.aiSystemId,
        message: alert.message,
      },
    }));
  }

  /**
   * Collect audit log evidence
   */
  private async collectAuditLogEvidence(
    healthSystemId: string,
    framework: string,
    startDate: Date,
    endDate: Date
  ): Promise<EvidenceItem[]> {
    const logs = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.healthSystemId, healthSystemId),
          gte(auditLogs.createdAt, startDate),
          lte(auditLogs.createdAt, endDate)
        )
      )
      .limit(1000); // Limit to prevent overwhelming the package

    // Filter to compliance-relevant actions
    const relevantLogs = logs.filter(log =>
      this.isAuditLogRelevantToFramework(log.action, framework)
    );

    return relevantLogs.map(log => ({
      controlId: this.mapAuditActionToControlId(log.action, framework),
      controlName: log.action,
      evidenceType: 'audit_log' as const,
      description: `${log.action} by ${log.userId || 'system'}: ${log.changes ? JSON.stringify(log.changes) : 'No details'}`,
      timestamp: log.createdAt,
      sourceId: log.id,
      metadata: {
        action: log.action,
        userId: log.userId,
        ipAddress: log.ipAddress,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        changes: log.changes,
      },
    }));
  }

  /**
   * Collect system configuration evidence
   */
  private async collectSystemConfigEvidence(
    healthSystemId: string,
    framework: string
  ): Promise<EvidenceItem[]> {
    const systems = await db
      .select()
      .from(aiSystems)
      .where(eq(aiSystems.healthSystemId, healthSystemId));

    return systems.map(system => ({
      controlId: this.mapFrameworkToControlId(framework, 'system_config'),
      controlName: `${framework} System Configuration`,
      evidenceType: 'system_config' as const,
      description: `AI System: ${system.name} - Department: ${system.department}, Status: ${system.status}, Risk Level: ${system.riskLevel}`,
      timestamp: system.createdAt,
      sourceId: system.id,
      metadata: {
        systemId: system.id,
        systemName: system.name,
        department: system.department,
        status: system.status,
        riskLevel: system.riskLevel,
        vendorId: system.vendorId,
      },
    }));
  }

  /**
   * Extract unique controls covered by evidence
   */
  private extractCoveredControls(evidenceItems: EvidenceItem[]): string[] {
    const controls = new Set(evidenceItems.map(item => item.controlId));
    return Array.from(controls).sort();
  }

  /**
   * Calculate completeness score based on framework requirements
   */
  private calculateCompletenessScore(
    framework: string,
    controlsCovered: string[]
  ): number {
    // Framework-specific required controls
    const requiredControls: Record<string, string[]> = {
      HIPAA: [
        '164.308(a)(1)(i)', // Security Management Process
        '164.308(a)(3)', // Workforce Security
        '164.308(a)(4)', // Information Access Management
        '164.308(a)(5)', // Security Awareness and Training
        '164.310(a)(1)', // Facility Access Controls
        '164.310(d)', // Device and Media Controls
        '164.312(a)(1)', // Access Control
        '164.312(c)(1)', // Integrity
        '164.312(d)', // Person or Entity Authentication
        '164.312(e)(1)', // Transmission Security
      ],
      NIST_AI_RMF: [
        'GOVERN-1.1', 'GOVERN-1.2',
        'MAP-1.1', 'MAP-2.1',
        'MEASURE-1.1', 'MEASURE-2.1',
        'MANAGE-1.1', 'MANAGE-2.1',
      ],
      FDA_SaMD: [
        'CV-1', // Clinical Validation
        'AV-1', // Analytical Validation
        'QMS-1', // Quality Management System
        'CYBER-1', // Cybersecurity
        'PM-1', // Post-Market Surveillance
      ],
      SOC2: [
        'CC1.1', // Control Environment
        'CC2.1', // Communication
        'CC3.1', // Risk Assessment
        'CC6.1', // Logical Access
        'CC7.1', // System Operations
      ],
      Joint_Commission: [
        'IM.02.01.01', // Information Management
        'IM.02.02.01', // Privacy and Security
        'PI.01.01.01', // Performance Improvement
      ],
    };

    const required = requiredControls[framework] || [];
    if (required.length === 0) return 100; // If no requirements defined, 100%

    const coveredCount = required.filter(ctrl =>
      controlsCovered.some(covered => covered.includes(ctrl))
    ).length;

    return Math.round((coveredCount / required.length) * 100);
  }

  /**
   * Map framework to generic control ID
   */
  private mapFrameworkToControlId(framework: string, type: string): string {
    const mapping: Record<string, Record<string, string>> = {
      HIPAA: {
        certification: '164.312(a)(1)',
        system_config: '164.308(a)(1)(i)',
      },
      NIST_AI_RMF: {
        certification: 'GOVERN-1.1',
        system_config: 'GOVERN-1.2',
      },
      FDA_SaMD: {
        certification: 'QMS-1',
        system_config: 'CV-1',
      },
    };

    return mapping[framework]?.[type] || `${framework}-GENERAL`;
  }

  /**
   * Check if alert is relevant to framework
   */
  private isAlertRelevantToFramework(alertType: string, framework: string): boolean {
    const frameworkMapping: Record<string, string[]> = {
      HIPAA: ['phi_leakage', 'unauthorized_access', 'data_breach', 'security_incident'],
      NIST_AI_RMF: ['drift', 'bias', 'fairness', 'safety_violation', 'performance_degradation'],
      FDA_SaMD: ['clinical_accuracy', 'false_alerts', 'safety_violation', 'adverse_event'],
    };

    const relevantTypes = frameworkMapping[framework] || [];
    return relevantTypes.some(type => alertType.toLowerCase().includes(type));
  }

  /**
   * Map alert type to control ID
   */
  private mapAlertTypeToControlId(alertType: string, framework: string): string {
    const mapping: Record<string, Record<string, string>> = {
      HIPAA: {
        phi_leakage: '164.308(a)(4)',
        unauthorized_access: '164.312(a)(1)',
        data_breach: '164.308(a)(6)',
      },
      NIST_AI_RMF: {
        drift: 'MEASURE-2.1',
        bias: 'MEASURE-2.2',
        performance_degradation: 'MEASURE-1.1',
      },
      FDA_SaMD: {
        clinical_accuracy: 'CV-1',
        false_alerts: 'AV-1',
        safety_violation: 'PM-1',
      },
    };

    return mapping[framework]?.[alertType.toLowerCase()] || `${framework}-ALERT`;
  }

  /**
   * Check if audit log is relevant to framework
   */
  private isAuditLogRelevantToFramework(action: string, framework: string): boolean {
    const complianceActions = [
      'ai_system_created',
      'ai_system_updated',
      'ai_system_deleted',
      'certification_approved',
      'certification_rejected',
      'alert_created',
      'alert_resolved',
      'user_login',
      'user_logout',
      'access_granted',
      'access_revoked',
    ];

    return complianceActions.includes(action);
  }

  /**
   * Map audit action to control ID
   */
  private mapAuditActionToControlId(action: string, framework: string): string {
    const mapping: Record<string, Record<string, string>> = {
      HIPAA: {
        user_login: '164.312(d)',
        user_logout: '164.312(d)',
        access_granted: '164.308(a)(4)',
        access_revoked: '164.308(a)(4)',
      },
      NIST_AI_RMF: {
        ai_system_created: 'GOVERN-1.1',
        ai_system_updated: 'MANAGE-1.1',
        ai_system_deleted: 'MANAGE-2.1',
      },
    };

    return mapping[framework]?.[action] || `${framework}-AUDIT`;
  }

  /**
   * Get audit package by ID
   */
  async getPackage(packageId: string): Promise<AuditPackage | null> {
    const result = await db
      .select()
      .from(auditEvidencePackages)
      .where(eq(auditEvidencePackages.id, packageId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const pkg = result[0];
    return {
      id: pkg.id,
      framework: pkg.framework,
      packageType: pkg.packageType,
      auditPeriod: pkg.auditPeriod!,
      startDate: pkg.startDate,
      endDate: pkg.endDate,
      evidenceItems: JSON.parse(JSON.stringify(pkg.evidenceItems)),
      controlsCovered: JSON.parse(JSON.stringify(pkg.controlsCovered)),
      completenessScore: parseFloat(pkg.completenessScore || '0'),
      status: pkg.status,
      createdAt: pkg.createdAt,
    };
  }

  /**
   * Get all packages for a health system
   */
  async getAllPackages(healthSystemId: string): Promise<AuditPackage[]> {
    const results = await db
      .select()
      .from(auditEvidencePackages)
      .where(eq(auditEvidencePackages.healthSystemId, healthSystemId))
      .orderBy(desc(auditEvidencePackages.createdAt));

    return results.map(pkg => ({
      id: pkg.id,
      framework: pkg.framework,
      packageType: pkg.packageType,
      auditPeriod: pkg.auditPeriod!,
      startDate: pkg.startDate,
      endDate: pkg.endDate,
      evidenceItems: JSON.parse(JSON.stringify(pkg.evidenceItems)),
      controlsCovered: JSON.parse(JSON.stringify(pkg.controlsCovered)),
      completenessScore: parseFloat(pkg.completenessScore || '0'),
      status: pkg.status,
      createdAt: pkg.createdAt,
    }));
  }

  /**
   * Mark package as delivered to auditor
   */
  async deliverPackage(packageId: string, deliveredTo: string): Promise<void> {
    await db
      .update(auditEvidencePackages)
      .set({
        status: 'delivered',
        deliveredTo,
        deliveredAt: new Date(),
      })
      .where(eq(auditEvidencePackages.id, packageId));

    logger.info({ packageId, deliveredTo }, "Audit evidence package delivered");
  }
}

export const auditEvidencePackager = new AuditEvidencePackager();
