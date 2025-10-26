/**
 * 📊 EXECUTIVE SUMMARY GENERATOR - Phase 3 Executive Reporting
 * 
 * AI-powered narrative generation for board-ready compliance reports
 * Transforms technical compliance data into executive-friendly summaries
 */

import { db } from "../db";
import {
  executiveReports,
  monitoringAlerts,
  complianceCertifications,
  aiSystems,
  healthSystems,
  vendors,
} from "../../shared/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { logger } from "../logger";

export interface ExecutiveReportRequest {
  healthSystemId: string;
  reportType: 'board_summary' | 'quarterly_compliance' | 'risk_overview' | 'monthly_snapshot';
  reportPeriod: string; // e.g., 'Q1 2025', 'January 2025'
  startDate: Date;
  endDate: Date;
  generatedBy: string;
}

export interface ExecutiveReportData {
  id: string;
  reportType: string;
  reportTitle: string;
  reportPeriod: string;
  startDate: Date;
  endDate: Date;
  narrative: string;
  keyMetrics: {
    totalAISystems: number;
    activeAlerts: number;
    criticalAlerts: number;
    complianceRate: number;
    averageRiskScore: number;
    certifiedVendors: number;
  };
  riskSummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  complianceStatus: {
    HIPAA: { compliant: number; total: number; percentage: number };
    'NIST AI RMF': { compliant: number; total: number; percentage: number };
    'FDA SaMD': { compliant: number; total: number; percentage: number };
  };
  actionItems: Array<{
    priority: 'critical' | 'high' | 'medium';
    item: string;
    deadline?: string;
    owner?: string;
  }>;
  trendAnalysis: {
    alertTrend: 'increasing' | 'decreasing' | 'stable';
    riskTrend: 'improving' | 'worsening' | 'stable';
    complianceTrend: 'improving' | 'declining' | 'stable';
  };
  status: string;
  createdAt: Date;
}

export class ExecutiveSummaryGenerator {
  /**
   * Generate comprehensive executive report
   */
  async generateReport(request: ExecutiveReportRequest): Promise<ExecutiveReportData> {
    logger.info({
      healthSystemId: request.healthSystemId,
      reportType: request.reportType,
      reportPeriod: request.reportPeriod,
    }, "Generating executive report");

    // 1. Collect raw data
    const healthSystem = await db
      .select()
      .from(healthSystems)
      .where(eq(healthSystems.id, request.healthSystemId))
      .limit(1);

    if (healthSystem.length === 0) {
      throw new Error("Health system not found");
    }

    // 2. Get all AI systems for this health system
    const allSystems = await db
      .select()
      .from(aiSystems)
      .where(eq(aiSystems.healthSystemId, request.healthSystemId));

    // 3. Get all system IDs for this health system
    const systemIds = allSystems.map(s => s.id);

    // 4. Get alerts in period for these systems
    const periodAlerts = systemIds.length > 0
      ? await db
          .select()
          .from(monitoringAlerts)
          .where(
            and(
              gte(monitoringAlerts.createdAt, request.startDate),
              lte(monitoringAlerts.createdAt, request.endDate)
            )
          )
      : [];

    // Filter to alerts for this health system's AI systems
    const healthSystemAlerts = periodAlerts.filter(a => systemIds.includes(a.aiSystemId));

    // 5. Get active alerts (not resolved)
    const activeAlerts = healthSystemAlerts.filter(a => !a.resolved);
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');

    // 6. Calculate risk summary
    const riskSummary = {
      critical: healthSystemAlerts.filter(a => a.severity === 'critical').length,
      high: healthSystemAlerts.filter(a => a.severity === 'high').length,
      medium: healthSystemAlerts.filter(a => a.severity === 'medium').length,
      low: healthSystemAlerts.filter(a => a.severity === 'low').length,
    };

    // 7. Calculate compliance status
    const certifications = await db
      .select()
      .from(complianceCertifications);

    const complianceStatus = {
      HIPAA: this.calculateFrameworkCompliance('HIPAA', allSystems, certifications),
      'NIST AI RMF': this.calculateFrameworkCompliance('NIST AI RMF', allSystems, certifications),
      'FDA SaMD': this.calculateFrameworkCompliance('FDA SaMD', allSystems, certifications),
    };

    // 8. Calculate average risk level (convert riskLevel text to numeric)
    const riskLevelMap: Record<string, number> = {
      low: 25,
      medium: 50,
      high: 75,
      critical: 100,
    };
    const systemsWithRisk = allSystems.filter(s => s.riskLevel);
    const averageRiskScore = systemsWithRisk.length > 0
      ? systemsWithRisk.reduce((sum, s) => sum + (riskLevelMap[s.riskLevel.toLowerCase()] || 50), 0) / systemsWithRisk.length
      : 0;

    // 9. Get certified vendors count (verified vendors)
    const certifiedVendors = await db
      .select()
      .from(vendors)
      .where(eq(vendors.verified, true));

    // 10. Generate key metrics
    const keyMetrics = {
      totalAISystems: allSystems.length,
      activeAlerts: activeAlerts.length,
      criticalAlerts: criticalAlerts.length,
      complianceRate: this.calculateOverallComplianceRate(complianceStatus),
      averageRiskScore: Math.round(averageRiskScore),
      certifiedVendors: certifiedVendors.length,
    };

    // 11. Generate action items
    const actionItems = this.generateActionItems(criticalAlerts, allSystems, complianceStatus);

    // 12. Calculate trend analysis
    const trendAnalysis = await this.calculateTrends(
      allSystems.map(s => s.id),
      request.startDate,
      request.endDate
    );

    // 13. Generate AI-powered narrative
    const narrative = this.generateNarrative(
      healthSystem[0].name,
      request.reportPeriod,
      keyMetrics,
      riskSummary,
      complianceStatus,
      trendAnalysis
    );

    // 14. Create report title
    const reportTitle = this.generateReportTitle(request.reportType, request.reportPeriod);

    // 15. Store in database
    const created = await db
      .insert(executiveReports)
      .values({
        healthSystemId: request.healthSystemId,
        reportType: request.reportType,
        reportTitle,
        reportPeriod: request.reportPeriod,
        startDate: request.startDate,
        endDate: request.endDate,
        narrative,
        keyMetrics: JSON.stringify(keyMetrics),
        riskSummary: JSON.stringify(riskSummary),
        complianceStatus: JSON.stringify(complianceStatus),
        actionItems: JSON.stringify(actionItems),
        trendAnalysis: JSON.stringify(trendAnalysis),
        generatedBy: request.generatedBy,
        status: 'draft',
      })
      .returning();

    logger.info({
      reportId: created[0].id,
      reportType: request.reportType,
      keyMetrics,
    }, "Executive report generated");

    return {
      id: created[0].id,
      reportType: created[0].reportType,
      reportTitle: created[0].reportTitle!,
      reportPeriod: created[0].reportPeriod!,
      startDate: created[0].startDate,
      endDate: created[0].endDate,
      narrative: created[0].narrative!,
      keyMetrics,
      riskSummary,
      complianceStatus,
      actionItems,
      trendAnalysis,
      status: created[0].status,
      createdAt: created[0].createdAt,
    };
  }

  /**
   * Calculate compliance for a specific framework
   * Note: Certifications are vendor-level, so we check if the system's vendor is certified
   */
  private calculateFrameworkCompliance(
    framework: string,
    systems: any[],
    certifications: any[]
  ): { compliant: number; total: number; percentage: number } {
    const total = systems.length;
    
    // Get certified vendors for this framework
    const certifiedVendorIds = new Set(
      certifications
        .filter(c => c.type === framework && c.status === 'verified')
        .map(c => c.vendorId)
    );

    // Count systems whose vendors are certified for this framework
    const compliant = systems.filter(s => 
      s.vendorId && certifiedVendorIds.has(s.vendorId)
    ).length;
    
    const percentage = total > 0 ? Math.round((compliant / total) * 100) : 0;

    return { compliant, total, percentage };
  }

  /**
   * Calculate overall compliance rate across all frameworks
   */
  private calculateOverallComplianceRate(complianceStatus: any): number {
    const frameworks = ['HIPAA', 'NIST AI RMF', 'FDA SaMD'];
    const total = frameworks.reduce((sum, f) => sum + complianceStatus[f].total, 0);
    const compliant = frameworks.reduce((sum, f) => sum + complianceStatus[f].compliant, 0);

    return total > 0 ? Math.round((compliant / total) * 100) : 0;
  }

  /**
   * Generate action items based on current state
   */
  private generateActionItems(
    criticalAlerts: any[],
    systems: any[],
    complianceStatus: any
  ): Array<{ priority: 'critical' | 'high' | 'medium'; item: string; deadline?: string; owner?: string }> {
    const items: Array<{ priority: 'critical' | 'high' | 'medium'; item: string; deadline?: string }> = [];

    // Critical alerts require immediate action
    if (criticalAlerts.length > 0) {
      items.push({
        priority: 'critical',
        item: `Address ${criticalAlerts.length} critical compliance alert${criticalAlerts.length > 1 ? 's' : ''}`,
        deadline: '7 days',
      });
    }

    // Low compliance frameworks need attention
    Object.entries(complianceStatus).forEach(([framework, status]: [string, any]) => {
      if (status.percentage < 70 && status.total > 0) {
        items.push({
          priority: 'high',
          item: `Improve ${framework} compliance from ${status.percentage}% to target 90%`,
          deadline: '30 days',
        });
      }
    });

    // High-risk systems (risk level 'high' or 'critical')
    const highRiskSystems = systems.filter(s => 
      s.riskLevel === 'high' || s.riskLevel === 'critical'
    );
    
    if (highRiskSystems.length > 0) {
      items.push({
        priority: 'high',
        item: `Review and mitigate ${highRiskSystems.length} high-risk AI system${highRiskSystems.length > 1 ? 's' : ''}`,
        deadline: '14 days',
      });
    }

    return items.slice(0, 5); // Top 5 action items
  }

  /**
   * Calculate trend analysis
   */
  private async calculateTrends(
    systemIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<{
    alertTrend: 'increasing' | 'decreasing' | 'stable';
    riskTrend: 'improving' | 'worsening' | 'stable';
    complianceTrend: 'improving' | 'declining' | 'stable';
  }> {
    if (systemIds.length === 0) {
      return {
        alertTrend: 'stable',
        riskTrend: 'stable',
        complianceTrend: 'stable',
      };
    }

    // Get previous period for comparison
    const periodLength = endDate.getTime() - startDate.getTime();
    const prevStartDate = new Date(startDate.getTime() - periodLength);
    const prevEndDate = new Date(startDate.getTime());

    // Current period alerts
    const currentAlerts = await db
      .select()
      .from(monitoringAlerts)
      .where(
        and(
          gte(monitoringAlerts.createdAt, startDate),
          lte(monitoringAlerts.createdAt, endDate)
        )
      );

    // Previous period alerts
    const previousAlerts = await db
      .select()
      .from(monitoringAlerts)
      .where(
        and(
          gte(monitoringAlerts.createdAt, prevStartDate),
          lte(monitoringAlerts.createdAt, prevEndDate)
        )
      );

    // Filter to only alerts for this health system's AI systems
    const currentHealthSystemAlerts = currentAlerts.filter(a => systemIds.includes(a.aiSystemId));
    const previousHealthSystemAlerts = previousAlerts.filter(a => systemIds.includes(a.aiSystemId));

    // Calculate trends
    const alertTrend = this.determineTrend(
      currentHealthSystemAlerts.length,
      previousHealthSystemAlerts.length
    ) as 'increasing' | 'decreasing' | 'stable';

    // Risk trend (fewer critical alerts = improving)
    const currentCritical = currentHealthSystemAlerts.filter(a => a.severity === 'critical').length;
    const previousCritical = previousHealthSystemAlerts.filter(a => a.severity === 'critical').length;
    
    // For risk: decreasing critical alerts = improving, so invert the comparison
    const riskTrend = this.determineTrend(
      currentCritical,
      previousCritical
    ) as 'increasing' | 'decreasing' | 'stable';
    
    // Map to risk-specific terms
    const riskTrendMapped = riskTrend === 'decreasing' ? 'improving' : 
                             riskTrend === 'increasing' ? 'worsening' : 'stable';

    // Compliance trend (based on resolution rate)
    const currentResolved = currentHealthSystemAlerts.filter(a => a.resolved).length;
    const currentResolveRate = currentHealthSystemAlerts.length > 0
      ? currentResolved / currentHealthSystemAlerts.length
      : 0;

    const previousResolved = previousHealthSystemAlerts.filter(a => a.resolved).length;
    const previousResolveRate = previousHealthSystemAlerts.length > 0
      ? previousResolved / previousHealthSystemAlerts.length
      : 0;

    const complianceTrend = this.determineTrend(
      currentResolveRate,
      previousResolveRate
    ) as 'improving' | 'declining' | 'stable';

    return { alertTrend, riskTrend: riskTrendMapped as 'improving' | 'worsening' | 'stable', complianceTrend };
  }

  /**
   * Determine trend direction
   */
  private determineTrend(current: number, previous: number): string {
    if (previous === 0) return 'stable';
    
    const change = ((current - previous) / previous) * 100;
    
    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }

  /**
   * Generate executive narrative using template-based approach
   * (In production, this would use an LLM with PHI-safe configuration)
   */
  private generateNarrative(
    healthSystemName: string,
    reportPeriod: string,
    keyMetrics: any,
    riskSummary: any,
    complianceStatus: any,
    trendAnalysis: any
  ): string {
    const sections: string[] = [];

    // Opening summary
    sections.push(
      `**AI Governance Summary for ${healthSystemName} - ${reportPeriod}**\n\n` +
      `This report provides a comprehensive overview of AI system compliance, risk management, and governance activities for ${reportPeriod}.`
    );

    // Key findings
    sections.push(
      `\n**Key Findings:**\n` +
      `• Currently managing ${keyMetrics.totalAISystems} AI systems across the organization\n` +
      `• ${keyMetrics.activeAlerts} active compliance alerts requiring attention\n` +
      `• Overall compliance rate: ${keyMetrics.complianceRate}%\n` +
      `• Average risk score: ${keyMetrics.averageRiskScore}/100\n` +
      `• Working with ${keyMetrics.certifiedVendors} certified AI vendors`
    );

    // Risk overview
    const totalRisk = riskSummary.critical + riskSummary.high + riskSummary.medium + riskSummary.low;
    sections.push(
      `\n**Risk Profile:**\n` +
      `During this period, the system detected ${totalRisk} total risk events:\n` +
      `• Critical: ${riskSummary.critical}\n` +
      `• High: ${riskSummary.high}\n` +
      `• Medium: ${riskSummary.medium}\n` +
      `• Low: ${riskSummary.low}`
    );

    if (riskSummary.critical > 0) {
      sections.push(
        `\n⚠️ **Immediate Action Required:** ${riskSummary.critical} critical alerts demand urgent executive attention.`
      );
    }

    // Compliance status
    sections.push(
      `\n**Regulatory Compliance Status:**\n` +
      `• HIPAA: ${complianceStatus.HIPAA.percentage}% (${complianceStatus.HIPAA.compliant}/${complianceStatus.HIPAA.total} systems)\n` +
      `• NIST AI RMF: ${complianceStatus['NIST AI RMF'].percentage}% (${complianceStatus['NIST AI RMF'].compliant}/${complianceStatus['NIST AI RMF'].total} systems)\n` +
      `• FDA SaMD: ${complianceStatus['FDA SaMD'].percentage}% (${complianceStatus['FDA SaMD'].compliant}/${complianceStatus['FDA SaMD'].total} systems)`
    );

    // Trend analysis
    const trendEmoji: Record<string, string> = {
      improving: '📈',
      worsening: '📉',
      declining: '📉',
      stable: '→',
      increasing: '📈',
      decreasing: '📉',
    };

    sections.push(
      `\n**Trend Analysis:**\n` +
      `• Alert Volume: ${trendEmoji[trendAnalysis.alertTrend] || '→'} ${trendAnalysis.alertTrend}\n` +
      `• Risk Posture: ${trendEmoji[trendAnalysis.riskTrend] || '→'} ${trendAnalysis.riskTrend}\n` +
      `• Compliance: ${trendEmoji[trendAnalysis.complianceTrend] || '→'} ${trendAnalysis.complianceTrend}`
    );

    // Closing recommendation
    sections.push(
      `\n**Executive Recommendation:**\n` +
      this.generateRecommendation(keyMetrics, riskSummary, complianceStatus)
    );

    return sections.join('\n');
  }

  /**
   * Generate recommendation based on current state
   */
  private generateRecommendation(keyMetrics: any, riskSummary: any, complianceStatus: any): string {
    if (riskSummary.critical > 0) {
      return `Immediate action is required to address ${riskSummary.critical} critical compliance issues. Recommend emergency review with legal and compliance teams within 48 hours.`;
    }

    if (keyMetrics.complianceRate < 70) {
      return `Compliance rate of ${keyMetrics.complianceRate}% is below industry standards. Recommend investing in vendor certification program and compliance automation.`;
    }

    if (keyMetrics.averageRiskScore >= 70) {
      return `Elevated average risk score (${keyMetrics.averageRiskScore}/100) suggests need for enhanced monitoring and risk mitigation strategies.`;
    }

    return `AI governance posture is strong. Continue current monitoring practices and maintain focus on proactive compliance management.`;
  }

  /**
   * Generate report title
   */
  private generateReportTitle(reportType: string, reportPeriod: string): string {
    const titles = {
      board_summary: `Board AI Governance Summary - ${reportPeriod}`,
      quarterly_compliance: `Quarterly Compliance Report - ${reportPeriod}`,
      risk_overview: `AI Risk Overview - ${reportPeriod}`,
      monthly_snapshot: `Monthly AI Governance Snapshot - ${reportPeriod}`,
    };

    return titles[reportType as keyof typeof titles] || `Executive Report - ${reportPeriod}`;
  }

  /**
   * Get latest executive report
   */
  async getLatestReport(healthSystemId: string): Promise<ExecutiveReportData | null> {
    const result = await db
      .select()
      .from(executiveReports)
      .where(eq(executiveReports.healthSystemId, healthSystemId))
      .orderBy(desc(executiveReports.createdAt))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const report = result[0];
    return {
      id: report.id,
      reportType: report.reportType,
      reportTitle: report.reportTitle!,
      reportPeriod: report.reportPeriod!,
      startDate: report.startDate,
      endDate: report.endDate,
      narrative: report.narrative!,
      keyMetrics: JSON.parse(JSON.stringify(report.keyMetrics)),
      riskSummary: JSON.parse(JSON.stringify(report.riskSummary)),
      complianceStatus: JSON.parse(JSON.stringify(report.complianceStatus)),
      actionItems: JSON.parse(JSON.stringify(report.actionItems)),
      trendAnalysis: JSON.parse(JSON.stringify(report.trendAnalysis)),
      status: report.status,
      createdAt: report.createdAt,
    };
  }

  /**
   * Get all reports for a health system
   */
  async getAllReports(healthSystemId: string): Promise<ExecutiveReportData[]> {
    const results = await db
      .select()
      .from(executiveReports)
      .where(eq(executiveReports.healthSystemId, healthSystemId))
      .orderBy(desc(executiveReports.createdAt));

    return results.map(report => ({
      id: report.id,
      reportType: report.reportType,
      reportTitle: report.reportTitle!,
      reportPeriod: report.reportPeriod!,
      startDate: report.startDate,
      endDate: report.endDate,
      narrative: report.narrative!,
      keyMetrics: JSON.parse(JSON.stringify(report.keyMetrics)),
      riskSummary: JSON.parse(JSON.stringify(report.riskSummary)),
      complianceStatus: JSON.parse(JSON.stringify(report.complianceStatus)),
      actionItems: JSON.parse(JSON.stringify(report.actionItems)),
      trendAnalysis: JSON.parse(JSON.stringify(report.trendAnalysis)),
      status: report.status,
      createdAt: report.createdAt,
    }));
  }

  /**
   * Publish report (mark as reviewed and published)
   */
  async publishReport(reportId: string, reviewedBy: string): Promise<void> {
    await db
      .update(executiveReports)
      .set({
        status: 'published',
        reviewedBy,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(executiveReports.id, reportId));

    logger.info({ reportId, reviewedBy }, "Executive report published");
  }
}

export const executiveSummaryGenerator = new ExecutiveSummaryGenerator();
