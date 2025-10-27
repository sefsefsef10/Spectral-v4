/**
 * APPLICATION LAYER USE CASE: Generate Report
 */

import { Report } from '../../domain/entities/Report';

export interface ReportRepository {
  save(report: Report): Promise<void>;
  findById(id: string): Promise<Report | null>;
}

export interface ReportGenerator {
  generate(report: Report, data: Record<string, unknown>): Promise<{ fileUrl: string; fileSize: number }>;
}

export interface DataAggregator {
  aggregateData(sources: string[], parameters?: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export interface GenerateReportInput {
  reportId: string;
}

export interface GenerateReportResult {
  reportId: string;
  fileUrl: string;
  fileSize: number;
  generatedAt: Date;
}

export class GenerateReportUseCase {
  constructor(
    private reportRepository: ReportRepository,
    private dataAggregator: DataAggregator,
    private reportGenerator: ReportGenerator
  ) {}

  async execute(input: GenerateReportInput): Promise<GenerateReportResult> {
    const report = await this.reportRepository.findById(input.reportId);
    if (!report) {
      throw new Error(`Report not found: ${input.reportId}`);
    }

    const validation = report.validateParameters();
    if (!validation.valid) {
      throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
    }

    report.startGeneration();
    await this.reportRepository.save(report);

    try {
      const sources = report.getRequiredDataSources();
      const data = await this.dataAggregator.aggregateData(sources, report.parameters);
      const { fileUrl, fileSize } = await this.reportGenerator.generate(report, data);
      
      report.completeGeneration(fileUrl, fileSize);
      await this.reportRepository.save(report);

      return {
        reportId: report.id!,
        fileUrl,
        fileSize,
        generatedAt: report.generatedAt!,
      };
    } catch (error) {
      report.markFailed(error instanceof Error ? error.message : 'Unknown error');
      await this.reportRepository.save(report);
      throw error;
    }
  }
}
