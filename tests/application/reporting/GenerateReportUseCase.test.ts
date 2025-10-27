/**
 * APPLICATION LAYER TESTS: GenerateReportUseCase
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GenerateReportUseCase, type ReportRepository, type DataAggregator, type ReportGenerator } from '../../../server/application/reporting/GenerateReportUseCase';
import { Report } from '../../../server/domain/entities/Report';

describe('GenerateReportUseCase', () => {
  let mockReportRepository: ReportRepository;
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

  it('should throw error if report not found', async () => {
    vi.mocked(mockReportRepository.findById).mockResolvedValue(null);

    await expect(useCase.execute({ reportId: 'non-existent' })).rejects.toThrow('Report not found');
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
