/**
 * APPLICATION LAYER USE CASE: Schedule Report
 */

import { Report, type ReportSchedule } from '../../domain/entities/Report';

export interface ReportRepository {
  save(report: Report): Promise<void>;
  findScheduledReports(): Promise<Report[]>;
}

export interface ScheduleReportInput {
  healthSystemId: string;
  type: string;
  format: string;
  schedule: ReportSchedule;
  title: string;
  description?: string;
  recipients?: string[];
  parameters?: Record<string, unknown>;
  createdBy: string;
}

export interface ScheduleReportResult {
  reportId: string;
  schedule: ReportSchedule;
  nextGenerationTime: Date | null;
}

export class ScheduleReportUseCase {
  constructor(private reportRepository: ReportRepository) {}

  async execute(input: ScheduleReportInput): Promise<ScheduleReportResult> {
    const report = Report.create({
      healthSystemId: input.healthSystemId,
      type: input.type as any,
      format: input.format as any,
      schedule: input.schedule,
      title: input.title,
      description: input.description,
      recipients: input.recipients,
      parameters: input.parameters,
      createdBy: input.createdBy,
    });

    await this.reportRepository.save(report);

    const nextGenerationTime = input.schedule !== 'on_demand' 
      ? report.getNextGenerationTime(new Date())
      : null;

    return {
      reportId: report.id!,
      schedule: input.schedule,
      nextGenerationTime,
    };
  }
}
