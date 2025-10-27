/**
 * ProcessCertificationApplicationUseCase Integration Tests
 * 
 * These tests verify the use case orchestrates domain entities,
 * repositories, and external services correctly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ProcessCertificationApplicationUseCase,
  type ProcessCertificationRequest
} from '@server/application/certifications/ProcessCertificationApplicationUseCase';
import {
  CertificationApplication,
  CertificationTier,
  ApplicationStatus
} from '@server/domain/entities/CertificationApplication';
import type { CertificationApplicationRepository, DeploymentRepository } from '@server/domain/repositories/CertificationApplicationRepository';

// Mock implementations
class MockCertificationApplicationRepository implements CertificationApplicationRepository {
  private applications: Map<string, CertificationApplication> = new Map();

  async findById(id: string): Promise<CertificationApplication | null> {
    return this.applications.get(id) || null;
  }

  async findByVendorId(vendorId: string): Promise<CertificationApplication[]> {
    return Array.from(this.applications.values()).filter(app => app.vendorId === vendorId);
  }

  async findByStatus(status: string): Promise<CertificationApplication[]> {
    return Array.from(this.applications.values()).filter(app => app.status === status);
  }

  async save(application: CertificationApplication): Promise<CertificationApplication> {
    this.applications.set(application.id, application);
    return application;
  }

  async exists(id: string): Promise<boolean> {
    return this.applications.has(id);
  }

  // Test helper
  seed(application: CertificationApplication): void {
    this.applications.set(application.id, application);
  }
}

class MockDeploymentRepository implements DeploymentRepository {
  private deploymentCounts: Map<string, number> = new Map();

  async findByVendorId(vendorId: string): Promise<any[]> {
    const count = this.deploymentCounts.get(vendorId) || 0;
    return Array.from({ length: count }, (_, i) => ({
      id: `dep-${i}`,
      vendorId,
      status: 'active'
    }));
  }

  async countActiveByVendorId(vendorId: string): Promise<number> {
    return this.deploymentCounts.get(vendorId) || 0;
  }

  // Test helper
  setActiveCount(vendorId: string, count: number): void {
    this.deploymentCounts.set(vendorId, count);
  }
}

class MockVendorTestingSuite {
  runAllTests = vi.fn();
}

class MockLogger {
  info = vi.fn();
  error = vi.fn();
  warn = vi.fn();
}

describe('ProcessCertificationApplicationUseCase', () => {
  let useCase: ProcessCertificationApplicationUseCase;
  let applicationRepo: MockCertificationApplicationRepository;
  let deploymentRepo: MockDeploymentRepository;
  let vendorTestingSuite: MockVendorTestingSuite;
  let logger: MockLogger;

  beforeEach(() => {
    applicationRepo = new MockCertificationApplicationRepository();
    deploymentRepo = new MockDeploymentRepository();
    vendorTestingSuite = new MockVendorTestingSuite();
    logger = new MockLogger();

    useCase = new ProcessCertificationApplicationUseCase(
      applicationRepo,
      deploymentRepo,
      vendorTestingSuite,
      logger as any
    );

    // Default mock: all tests pass
    vendorTestingSuite.runAllTests.mockResolvedValue([
      { testType: 'phi_exposure', passed: true, score: 100, details: {} },
      { testType: 'clinical_accuracy', passed: true, score: 95, details: {} },
      { testType: 'bias_detection', passed: true, score: 100, details: {} },
      { testType: 'security_scan', passed: true, score: 100, details: {} }
    ]);
  });

  describe('execute - Happy Path', () => {
    it('should process Silver tier application successfully', async () => {
      // Setup
      const application = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        ['https://doc1.pdf'],
        { hipaa: true, nist: false }
      );
      applicationRepo.seed(application);
      deploymentRepo.setActiveCount('vendor-1', 0); // Silver doesn't require deployments

      const request: ProcessCertificationRequest = {
        applicationId: application.id
      };

      // Execute
      const response = await useCase.execute(request);

      // Assert
      expect(response.success).toBe(true);
      expect(response.passed).toBe(true);
      expect(response.score).toBe(100);
      expect(response.status).toBe(ApplicationStatus.IN_REVIEW);
      expect(response.checks.documentationComplete).toBe(true);
      expect(response.checks.complianceStatementsValid).toBe(true);
      expect(response.checks.deploymentHistoryValid).toBe(true);
    });

    it('should process Gold tier application successfully', async () => {
      const application = CertificationApplication.create(
        'vendor-1',
        CertificationTier.GOLD,
        ['https://doc1.pdf', 'https://doc2.pdf'],
        { hipaa: true, nist: true }
      );
      applicationRepo.seed(application);
      deploymentRepo.setActiveCount('vendor-1', 2); // Gold requires 1+

      const request: ProcessCertificationRequest = {
        applicationId: application.id
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(true);
      expect(response.passed).toBe(true);
      expect(response.score).toBe(100);
      expect(response.checks.deploymentHistoryValid).toBe(true);
    });

    it('should process Platinum tier application successfully', async () => {
      const application = CertificationApplication.create(
        'vendor-1',
        CertificationTier.PLATINUM,
        ['doc1', 'doc2', 'doc3'],
        { hipaa: true, nist: true, fda: true }
      );
      applicationRepo.seed(application);
      deploymentRepo.setActiveCount('vendor-1', 5); // Platinum requires 3+

      const request: ProcessCertificationRequest = {
        applicationId: application.id
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(true);
      expect(response.passed).toBe(true);
      expect(response.score).toBe(100);
    });
  });

  describe('execute - Validation Failures', () => {
    it('should fail for insufficient documentation', async () => {
      const application = CertificationApplication.create(
        'vendor-1',
        CertificationTier.GOLD,
        ['doc1'], // Only 1 doc, Gold needs 2
        { hipaa: true, nist: true }
      );
      applicationRepo.seed(application);
      deploymentRepo.setActiveCount('vendor-1', 1);

      const request: ProcessCertificationRequest = {
        applicationId: application.id
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(true);
      expect(response.passed).toBe(false);
      expect(response.checks.documentationComplete).toBe(false);
      expect(response.recommendations).toContain(
        'Please upload complete documentation for all requested compliance frameworks'
      );
    });

    it('should fail for invalid compliance statements', async () => {
      const application = CertificationApplication.create(
        'vendor-1',
        CertificationTier.GOLD,
        ['doc1', 'doc2'],
        { hipaa: true, nist: false } // Gold requires NIST
      );
      applicationRepo.seed(application);
      deploymentRepo.setActiveCount('vendor-1', 1);

      const request: ProcessCertificationRequest = {
        applicationId: application.id
      };

      const response = await useCase.execute(request);

      expect(response.passed).toBe(false);
      expect(response.checks.complianceStatementsValid).toBe(false);
      expect(response.recommendations).toContain(
        'Compliance statements must align with requested certification tier'
      );
    });

    it('should fail for insufficient deployments', async () => {
      const application = CertificationApplication.create(
        'vendor-1',
        CertificationTier.GOLD,
        ['doc1', 'doc2'],
        { hipaa: true, nist: true }
      );
      applicationRepo.seed(application);
      deploymentRepo.setActiveCount('vendor-1', 0); // Gold requires 1+

      const request: ProcessCertificationRequest = {
        applicationId: application.id
      };

      const response = await useCase.execute(request);

      expect(response.passed).toBe(false);
      expect(response.checks.deploymentHistoryValid).toBe(false);
      expect(response.recommendations).toContain(
        'Gold tier requires at least 1 active deployment with a health system'
      );
    });
  });

  describe('execute - Test Failures', () => {
    it('should fail for PHI exposure test failure', async () => {
      const application = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );
      applicationRepo.seed(application);

      vendorTestingSuite.runAllTests.mockResolvedValue([
        { testType: 'phi_exposure', passed: false, score: 60, details: { violations: 5 } },
        { testType: 'clinical_accuracy', passed: true, score: 95, details: {} },
        { testType: 'bias_detection', passed: true, score: 100, details: {} },
        { testType: 'security_scan', passed: true, score: 100, details: {} }
      ]);

      const request: ProcessCertificationRequest = {
        applicationId: application.id
      };

      const response = await useCase.execute(request);

      expect(response.passed).toBe(false);
      expect(response.checks.phiExposureTest).toBe(false);
      expect(response.recommendations).toContain(
        'PHI Exposure Test: 5 violations detected'
      );
    });

    it('should fail for clinical accuracy test failure', async () => {
      const application = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );
      applicationRepo.seed(application);

      vendorTestingSuite.runAllTests.mockResolvedValue([
        { testType: 'phi_exposure', passed: true, score: 100, details: {} },
        { testType: 'clinical_accuracy', passed: false, score: 85, details: {} },
        { testType: 'bias_detection', passed: true, score: 100, details: {} },
        { testType: 'security_scan', passed: true, score: 100, details: {} }
      ]);

      const request: ProcessCertificationRequest = {
        applicationId: application.id
      };

      const response = await useCase.execute(request);

      expect(response.passed).toBe(false);
      expect(response.checks.clinicalAccuracyTest).toBe(false);
      expect(response.recommendations).toContain(
        'Clinical Accuracy Test: Score 85% (minimum 90% required)'
      );
    });
  });

  describe('execute - Error Handling', () => {
    it('should return error response when application not found', async () => {
      const request: ProcessCertificationRequest = {
        applicationId: 'non-existent'
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Application not found: non-existent');
      expect(response.passed).toBe(false);
      expect(response.score).toBe(0);
    });

    it('should handle vendor testing suite errors gracefully', async () => {
      const application = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );
      applicationRepo.seed(application);

      vendorTestingSuite.runAllTests.mockRejectedValue(new Error('Testing suite offline'));

      const request: ProcessCertificationRequest = {
        applicationId: application.id
      };

      const response = await useCase.execute(request);

      expect(response.success).toBe(true); // Use case succeeds even if tests fail
      expect(response.passed).toBe(false); // But application fails due to missing test results
      expect(response.recommendations).toContain(
        'Automated testing suite encountered errors - manual review required'
      );
    });
  });

  describe('execute - Scoring', () => {
    it('should calculate correct score with partial passes', async () => {
      const application = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );
      applicationRepo.seed(application);

      vendorTestingSuite.runAllTests.mockResolvedValue([
        { testType: 'phi_exposure', passed: true, score: 100, details: {} },
        { testType: 'clinical_accuracy', passed: false, score: 85, details: {} },
        { testType: 'bias_detection', passed: false, score: 70, details: {} },
        { testType: 'security_scan', passed: false, score: 80, details: {} }
      ]);

      const request: ProcessCertificationRequest = {
        applicationId: application.id
      };

      const response = await useCase.execute(request);

      // Doc(20) + Compliance(20) + Deploy(10) + PHI(15) = 65
      expect(response.score).toBe(65);
      expect(response.passed).toBe(false);
    });
  });

  describe('execute - Persistence', () => {
    it('should save updated application to repository', async () => {
      const application = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );
      applicationRepo.seed(application);

      const request: ProcessCertificationRequest = {
        applicationId: application.id
      };

      await useCase.execute(request);

      // Verify application was saved with updated status
      const saved = await applicationRepo.findById(application.id);
      expect(saved).toBeDefined();
      expect(saved!.status).toBe(ApplicationStatus.IN_REVIEW);
      expect(saved!.automatedChecksPassed).toBe(true);
      expect(saved!.score).toBe(100);
    });
  });
});
