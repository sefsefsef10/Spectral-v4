/**
 * 📅 REPORT SCHEDULER - Phase 3 Executive Reporting
 * 
 * Automated report generation and distribution system
 * Handles scheduled executive reports, compliance summaries, and audit packages
 */

import { db } from "../db";
import {
  reportSchedules,
  executiveReports,
  users,
} from "../../shared/schema";
import { eq, and, lte } from "drizzle-orm";
import { logger } from "../logger";
import { executiveSummaryGenerator } from "./executive-summary-generator";
import { auditEvidencePackager } from "./audit-evidence-packager";

export interface ReportScheduleConfig {
  healthSystemId: string;
  reportType: 'board_summary' | 'quarterly_compliance' | 'risk_overview' | 'monthly_snapshot';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number; // 0-6 for weekly (0 = Sunday)
  dayOfMonth?: number; // 1-31 for monthly
  monthOfQuarter?: number; // 1-3 for quarterly (1 = first month, 2 = second, 3 = third)
  recipients: string[]; // Array of user IDs or email addresses
  includeExecutiveSummary: boolean;
  includeDetailedMetrics: boolean;
  createdBy: string;
}

export interface ScheduledReport {
  id: string;
  healthSystemId: string;
  reportType: string;
  frequency: string;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  monthOfQuarter?: number | null;
  recipients: string[];
  includeExecutiveSummary: boolean;
  includeDetailedMetrics: boolean;
  lastRunAt?: Date | null;
  nextRunAt: Date;
  active: boolean;
  createdAt: Date;
}

export class ReportScheduler {
  /**
   * Create a new scheduled report
   */
  async createSchedule(config: ReportScheduleConfig): Promise<ScheduledReport> {
    logger.info({
      healthSystemId: config.healthSystemId,
      reportType: config.reportType,
      frequency: config.frequency,
    }, "Creating report schedule");

    // Calculate next run date
    const nextRunAt = this.calculateNextRunDate(
      config.frequency,
      config.dayOfWeek,
      config.dayOfMonth,
      config.monthOfQuarter
    );

    const created = await db
      .insert(reportSchedules)
      .values({
        healthSystemId: config.healthSystemId,
        reportType: config.reportType,
        frequency: config.frequency,
        dayOfWeek: config.dayOfWeek,
        dayOfMonth: config.dayOfMonth,
        monthOfQuarter: config.monthOfQuarter,
        recipients: JSON.stringify(config.recipients),
        includeExecutiveSummary: config.includeExecutiveSummary,
        includeDetailedMetrics: config.includeDetailedMetrics,
        nextRunAt,
        active: true,
        createdBy: config.createdBy,
      })
      .returning();

    logger.info({
      scheduleId: created[0].id,
      nextRunAt,
    }, "Report schedule created");

    return {
      id: created[0].id,
      healthSystemId: created[0].healthSystemId,
      reportType: created[0].reportType,
      frequency: created[0].frequency,
      dayOfWeek: created[0].dayOfWeek,
      dayOfMonth: created[0].dayOfMonth,
      monthOfQuarter: created[0].monthOfQuarter,
      recipients: JSON.parse(JSON.stringify(created[0].recipients)),
      includeExecutiveSummary: created[0].includeExecutiveSummary ?? true,
      includeDetailedMetrics: created[0].includeDetailedMetrics ?? false,
      lastRunAt: created[0].lastRunAt,
      nextRunAt: created[0].nextRunAt,
      active: created[0].active,
      createdAt: created[0].createdAt,
    };
  }

  /**
   * Process all due scheduled reports
   * Should be called by a background job every hour
   */
  async processDueReports(): Promise<void> {
    logger.info("Processing due scheduled reports");

    const now = new Date();

    // Get all active schedules that are due
    const dueSchedules = await db
      .select()
      .from(reportSchedules)
      .where(
        and(
          eq(reportSchedules.active, true),
          lte(reportSchedules.nextRunAt, now)
        )
      );

    logger.info({ count: dueSchedules.length }, "Found due report schedules");

    for (const schedule of dueSchedules) {
      try {
        await this.executeScheduledReport(schedule);
        
        // Update schedule with next run time
        const nextRunAt = this.calculateNextRunDate(
          schedule.frequency,
          schedule.dayOfWeek,
          schedule.dayOfMonth,
          schedule.monthOfQuarter
        );

        await db
          .update(reportSchedules)
          .set({
            lastRunAt: now,
            nextRunAt,
            updatedAt: now,
          })
          .where(eq(reportSchedules.id, schedule.id));

        logger.info({
          scheduleId: schedule.id,
          reportType: schedule.reportType,
          nextRunAt,
        }, "Scheduled report executed successfully");
      } catch (error) {
        logger.error({
          scheduleId: schedule.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, "Failed to execute scheduled report");
        
        // Continue processing other schedules even if one fails
        continue;
      }
    }
  }

  /**
   * Execute a scheduled report
   */
  private async executeScheduledReport(schedule: any): Promise<void> {
    const now = new Date();

    // Calculate report period based on frequency
    const { startDate, endDate, reportPeriod } = this.calculateReportPeriod(
      schedule.frequency,
      now
    );

    // Generate executive summary
    const report = await executiveSummaryGenerator.generateReport({
      healthSystemId: schedule.healthSystemId,
      reportType: schedule.reportType,
      reportPeriod,
      startDate,
      endDate,
      generatedBy: 'system', // Automated generation
    });

    // TODO: Send report to recipients via email/Slack
    // This would integrate with SendGrid or other notification services
    const recipients = JSON.parse(JSON.stringify(schedule.recipients));
    logger.info({
      reportId: report.id,
      recipients,
    }, "Report generated, ready for distribution");

    // Auto-publish the report
    await executiveSummaryGenerator.publishReport(report.id, 'system');
  }

  /**
   * Calculate the next run date based on frequency
   */
  private calculateNextRunDate(
    frequency: string,
    dayOfWeek?: number | null,
    dayOfMonth?: number | null,
    monthOfQuarter?: number | null
  ): Date {
    const now = new Date();
    const next = new Date(now);

    switch (frequency) {
      case 'daily':
        // Run at midnight tomorrow
        next.setDate(next.getDate() + 1);
        next.setHours(0, 0, 0, 0);
        break;

      case 'weekly':
        // Run on specific day of week
        const targetDay = dayOfWeek ?? 1; // Default to Monday
        const currentDay = next.getDay();
        const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;
        next.setDate(next.getDate() + daysUntilTarget);
        next.setHours(0, 0, 0, 0);
        break;

      case 'monthly':
        // Run on specific day of month
        const targetDate = dayOfMonth ?? 1; // Default to 1st
        next.setMonth(next.getMonth() + 1);
        next.setDate(targetDate);
        next.setHours(0, 0, 0, 0);
        break;

      case 'quarterly':
        // Run on specific month of quarter
        const currentMonth = next.getMonth();
        const currentQuarter = Math.floor(currentMonth / 3);
        const targetMonthInQuarter = (monthOfQuarter ?? 3) - 1; // Default to last month (0-indexed)
        const targetMonth = (currentQuarter + 1) * 3 + targetMonthInQuarter;
        next.setMonth(targetMonth);
        next.setDate(dayOfMonth ?? 1);
        next.setHours(0, 0, 0, 0);
        break;

      default:
        // Default to tomorrow
        next.setDate(next.getDate() + 1);
        next.setHours(0, 0, 0, 0);
    }

    return next;
  }

  /**
   * Calculate report period based on frequency
   */
  private calculateReportPeriod(
    frequency: string,
    now: Date
  ): { startDate: Date; endDate: Date; reportPeriod: string } {
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(now);

    let reportPeriod = '';

    switch (frequency) {
      case 'daily':
        // Previous day (both start and end should be yesterday)
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        reportPeriod = startDate.toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        });
        break;

      case 'weekly':
        // Previous 7 days
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        reportPeriod = `Week of ${startDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        })}`;
        break;

      case 'monthly':
        // Previous month
        startDate.setMonth(startDate.getMonth() - 1);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        const lastDayOfMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
        endDate.setTime(lastDayOfMonth.getTime());
        reportPeriod = startDate.toLocaleDateString('en-US', { 
          month: 'long', 
          year: 'numeric' 
        });
        break;

      case 'quarterly':
        // Previous quarter
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const prevQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
        const year = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
        startDate.setFullYear(year);
        startDate.setMonth(prevQuarter * 3);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setFullYear(year);
        endDate.setMonth((prevQuarter + 1) * 3);
        endDate.setDate(0); // Last day of previous quarter
        reportPeriod = `Q${prevQuarter + 1} ${year}`;
        break;

      default:
        // Default to last 30 days
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        reportPeriod = 'Last 30 Days';
    }

    return { startDate, endDate, reportPeriod };
  }

  /**
   * Get all schedules for a health system
   */
  async getSchedules(healthSystemId: string): Promise<ScheduledReport[]> {
    const results = await db
      .select()
      .from(reportSchedules)
      .where(eq(reportSchedules.healthSystemId, healthSystemId));

    return results.map(schedule => ({
      id: schedule.id,
      healthSystemId: schedule.healthSystemId,
      reportType: schedule.reportType,
      frequency: schedule.frequency,
      dayOfWeek: schedule.dayOfWeek,
      dayOfMonth: schedule.dayOfMonth,
      monthOfQuarter: schedule.monthOfQuarter,
      recipients: JSON.parse(JSON.stringify(schedule.recipients)),
      includeExecutiveSummary: schedule.includeExecutiveSummary ?? true,
      includeDetailedMetrics: schedule.includeDetailedMetrics ?? false,
      lastRunAt: schedule.lastRunAt,
      nextRunAt: schedule.nextRunAt,
      active: schedule.active,
      createdAt: schedule.createdAt,
    }));
  }

  /**
   * Update schedule (activate/deactivate)
   */
  async updateSchedule(
    scheduleId: string,
    updates: { active?: boolean; recipients?: string[] }
  ): Promise<void> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (updates.active !== undefined) {
      updateData.active = updates.active;
    }

    if (updates.recipients) {
      updateData.recipients = JSON.stringify(updates.recipients);
    }

    await db
      .update(reportSchedules)
      .set(updateData)
      .where(eq(reportSchedules.id, scheduleId));

    logger.info({ scheduleId, updates }, "Report schedule updated");
  }

  /**
   * Delete schedule
   */
  async deleteSchedule(scheduleId: string): Promise<void> {
    await db
      .delete(reportSchedules)
      .where(eq(reportSchedules.id, scheduleId));

    logger.info({ scheduleId }, "Report schedule deleted");
  }

  /**
   * Manually trigger a scheduled report (run now)
   */
  async triggerNow(scheduleId: string): Promise<void> {
    const schedule = await db
      .select()
      .from(reportSchedules)
      .where(eq(reportSchedules.id, scheduleId))
      .limit(1);

    if (schedule.length === 0) {
      throw new Error("Schedule not found");
    }

    logger.info({ scheduleId }, "Manually triggering scheduled report");

    await this.executeScheduledReport(schedule[0]);

    // Update last run time
    await db
      .update(reportSchedules)
      .set({
        lastRunAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reportSchedules.id, scheduleId));
  }
}

export const reportScheduler = new ReportScheduler();
