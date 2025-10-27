/**
 * DOMAIN TESTS: Report Entity (Focused)
 */

import { describe, it, expect } from 'vitest';
import { Report } from '../../../server/domain/entities/Report';

describe('Report Domain Entity', () => {
  const validProps = {
    healthSystemId: 'hs-123',
    type: 'executive_summary' as const,
    format: 'pdf' as const,
    schedule: 'monthly' as const,
    title: 'Q4 2025 Executive Summary',
    createdBy: 'user-456',
  };

  it('should create valid report', () => {
    const report = Report.create(validProps);
    expect(report.healthSystemId).toBe('hs-123');
    expect(report.status).toBe('pending');
  });

  it('should reject empty title', () => {
    expect(() => Report.create({ ...validProps, title: '' })).toThrow('Report title is required');
  });

  it('should start generation', () => {
    const report = Report.create(validProps);
    report.startGeneration();
    expect(report.status).toBe('generating');
  });

  it('should complete generation', () => {
    const report = Report.create(validProps);
    report.startGeneration();
    report.completeGeneration('https://s3.amazonaws.com/report.pdf', 1024000);
    expect(report.status).toBe('completed');
    expect(report.fileUrl).toBe('https://s3.amazonaws.com/report.pdf');
  });

  it('should calculate next generation time for monthly reports', () => {
    const report = Report.create(validProps);
    const lastGen = new Date('2025-01-01');
    const next = report.getNextGenerationTime(lastGen);
    expect(next.getMonth()).toBe(1); // February
  });

  it('should identify required data sources', () => {
    const report = Report.create(validProps);
    const sources = report.getRequiredDataSources();
    expect(sources).toContain('ai_systems');
    expect(sources).toContain('alerts');
  });

  it('should detect expired reports', () => {
    const report = Report.fromPersistence({
      id: 'report-123',
      ...validProps,
      status: 'completed',
      generatedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
      createdAt: new Date(),
    });
    expect(report.hasExpired()).toBe(true);
  });
});
