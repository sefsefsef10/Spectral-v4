/**
 * APPLICATION LAYER TESTS: Reporting Use Cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GenerateReportUseCase, type ReportRepository as GenerateReportRepository, type DataAggregator, type ReportGenerator } from '../../../server/application/reporting/GenerateReportUseCase';
import { ScheduleReportUseCase, type ReportRepository as ScheduleReportRepository } from '../../../server/application/reporting/ScheduleReportUseCase';
import { Report } from '../../../server/domain/entities/Report';

describe('GenerateReportUseCase', () => {
  let mockReportRepository: GenerateReportRepository;
  let mockDataAggregator: DataAggregator;
  let mockReportGenerator: ReportGenerator;
  let useCase: GenerateReportUseCase;

  beforeEach(() => {
    mockReportRepository = {
      save: vi.fn(),
      findById: vi.fn(),
    };
    mockDataAggregator = {
      aggregateData: vi.fn().mockResolvedValue({ totalSystems: 10, totalAlerts: 5 }),
    };
    mockReportGenerator = {
      generate: vi.fn().mockResolvedValue({ fileUrl: 'https://s3.amazonaws.com/report.pdf', fileSize: 2048000 }),
    };
    useCase = new GenerateReportUseCase(mockReportRepository, mockDataAggregator, mockReportGenerator);
  });

  it('should generate report successfully', async () => {
    const report = Report.create({
      healthSystemId: 'hs-123',
      type: 'executive_summary',
      format: 'pdf',
      schedule: 'monthly',
      title: 'Executive Summary',
      createdBy: 'user-456',
      parameters: { startDate: new Date(), endDate: new Date() },
    });
    report._setId('report-123');

    vi.mocked(mockReportRepository.findById).mockResolvedValue(report);

    const result = await useCase.execute({ reportId: 'report-123' });

    expect(result.reportId).toBe('report-123');
    expect(result.fileUrl).toBe('https://s3.amazonaws.com/report.pdf');
    expect(result.fileSize).toBe(2048000);
    expect(mockReportRepository.save).toHaveBeenCalledTimes(2); // Start + Complete
  });

  it('should handle generation failures', async () => {
    const report = Report.create({
      healthSystemId: 'hs-123',
      type: 'executive_summary',
      format: 'pdf',
      schedule: 'monthly',
      title: 'Executive Summary',
      createdBy: 'user-456',
      parameters: { startDate: new Date(), endDate: new Date() },
    });
    report._setId('report-123');

    vi.mocked(mockReportRepository.findById).mockResolvedValue(report);
    vi.mocked(mockReportGenerator.generate).mockRejectedValue(new Error('Generation failed'));

    await expect(useCase.execute({ reportId: 'report-123' })).rejects.toThrow('Generation failed');
    expect(mockReportRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    );
  });
});

describe('ScheduleReportUseCase', () => {
  let mockReportRepository: ScheduleReportRepository;
  let useCase: ScheduleReportUseCase;

  beforeEach(() => {
    mockReportRepository = {
      save: vi.fn(),
      findScheduledReports: vi.fn(),
    };
    useCase = new ScheduleReportUseCase(mockReportRepository);
  });

  it('should schedule monthly report', async () => {
    const result = await useCase.execute({
      healthSystemId: 'hs-123',
      type: 'executive_summary',
      format: 'pdf',
      schedule: 'monthly',
      title: 'Monthly Executive Summary',
      createdBy: 'user-456',
    });

    expect(result.schedule).toBe('monthly');
    expect(result.nextGenerationTime).toBeInstanceOf(Date);
    expect(mockReportRepository.save).toHaveBeenCalled();
  });

  it('should schedule on-demand report with no next generation time', async () => {
    const result = await useCase.execute({
      healthSystemId: 'hs-123',
      type: 'compliance_status',
      format: 'pdf',
      schedule: 'on_demand',
      title: 'Ad-hoc Compliance Report',
      createdBy: 'user-456',
    });

    expect(result.schedule).toBe('on_demand');
    expect(result.nextGenerationTime).toBeNull();
  });

  it('should save report with recipients', async () => {
    const result = await useCase.execute({
      healthSystemId: 'hs-123',
      type: 'risk_assessment',
      format: 'pdf',
      schedule: 'weekly',
      title: 'Weekly Risk Assessment',
      recipients: ['admin@hospital.com', 'ciso@hospital.com'],
      createdBy: 'user-456',
    });

    expect(mockReportRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: ['admin@hospital.com', 'ciso@hospital.com'],
      })
    );
  });
});
