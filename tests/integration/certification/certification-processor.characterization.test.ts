/**
 * Characterization Tests for Certification Processor
 * 
 * These tests lock in the CURRENT behavior before refactoring.
 * Goal: Ensure refactored code produces identical results.
 * 
 * DO NOT modify these tests during refactoring.
 * If a test fails after refactoring, you've introduced a regression.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { processCertificationApplication } from '@server/services/certification-processor';
import { storage } from '@server/storage';

// Mock dependencies
vi.mock('@server/storage');
vi.mock('@server/services/vendor-testing/testing-suite', () => ({
  vendorTestingSuite: {
    runAllTests: vi.fn().mockResolvedValue([])
  }
}));

describe('Certification Processor - Characterization Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Documentation Completeness Validation', () => {
    it('should pass Silver tier with 1 document', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Silver',
        documentationUrls: ['https://example.com/doc1.pdf'],
        complianceStatements: JSON.stringify({ hipaa: true }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const result = await processCertificationApplication('app-1');

      expect(result.checks.documentationComplete).toBe(true);
    });

    it('should fail Silver tier with 0 documents', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Silver',
        documentationUrls: [],
        complianceStatements: JSON.stringify({ hipaa: true }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const result = await processCertificationApplication('app-1');

      expect(result.checks.documentationComplete).toBe(false);
      expect(result.recommendations).toContain('Please upload complete documentation for all requested compliance frameworks');
    });

    it('should require 2 documents for Gold tier', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Gold',
        documentationUrls: ['https://example.com/doc1.pdf'],
        complianceStatements: JSON.stringify({ hipaa: true, nist: true }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([
        { id: 'dep-1', vendorId: 'vendor-1', status: 'active' }
      ]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const result = await processCertificationApplication('app-1');

      expect(result.checks.documentationComplete).toBe(false);
    });

    it('should pass Gold tier with 2 documents', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Gold',
        documentationUrls: ['https://example.com/doc1.pdf', 'https://example.com/doc2.pdf'],
        complianceStatements: JSON.stringify({ hipaa: true, nist: true }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([
        { id: 'dep-1', vendorId: 'vendor-1', status: 'active' }
      ]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const result = await processCertificationApplication('app-1');

      expect(result.checks.documentationComplete).toBe(true);
    });

    it('should require 3 documents for Platinum tier', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Platinum',
        documentationUrls: ['https://example.com/doc1.pdf', 'https://example.com/doc2.pdf'],
        complianceStatements: JSON.stringify({ hipaa: true, nist: true, fda: true }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([
        { id: 'dep-1', vendorId: 'vendor-1', status: 'active' },
        { id: 'dep-2', vendorId: 'vendor-1', status: 'active' },
        { id: 'dep-3', vendorId: 'vendor-1', status: 'active' }
      ]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const result = await processCertificationApplication('app-1');

      expect(result.checks.documentationComplete).toBe(false);
    });
  });

  describe('Compliance Statements Validation', () => {
    it('should pass Silver tier with HIPAA compliance', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Silver',
        documentationUrls: ['https://example.com/doc1.pdf'],
        complianceStatements: JSON.stringify({ hipaa: true }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const result = await processCertificationApplication('app-1');

      expect(result.checks.complianceStatementsValid).toBe(true);
    });

    it('should fail Silver tier without HIPAA', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Silver',
        documentationUrls: ['https://example.com/doc1.pdf'],
        complianceStatements: JSON.stringify({ hipaa: false }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const result = await processCertificationApplication('app-1');

      expect(result.checks.complianceStatementsValid).toBe(false);
    });

    it('should require HIPAA + NIST for Gold tier', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Gold',
        documentationUrls: ['https://example.com/doc1.pdf', 'https://example.com/doc2.pdf'],
        complianceStatements: JSON.stringify({ hipaa: true, nist: false }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([
        { id: 'dep-1', vendorId: 'vendor-1', status: 'active' }
      ]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const result = await processCertificationApplication('app-1');

      expect(result.checks.complianceStatementsValid).toBe(false);
    });

    it('should pass Gold tier with HIPAA + NIST', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Gold',
        documentationUrls: ['https://example.com/doc1.pdf', 'https://example.com/doc2.pdf'],
        complianceStatements: JSON.stringify({ hipaa: true, nist: true }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([
        { id: 'dep-1', vendorId: 'vendor-1', status: 'active' }
      ]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const result = await processCertificationApplication('app-1');

      expect(result.checks.complianceStatementsValid).toBe(true);
    });

    it('should require HIPAA + NIST + (FDA or ISO) for Platinum', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Platinum',
        documentationUrls: ['doc1', 'doc2', 'doc3'],
        complianceStatements: JSON.stringify({ hipaa: true, nist: true, fda: false, iso: false }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([
        { id: 'dep-1', vendorId: 'vendor-1', status: 'active' },
        { id: 'dep-2', vendorId: 'vendor-1', status: 'active' },
        { id: 'dep-3', vendorId: 'vendor-1', status: 'active' }
      ]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const result = await processCertificationApplication('app-1');

      expect(result.checks.complianceStatementsValid).toBe(false);
    });

    it('should pass Platinum with HIPAA + NIST + FDA', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Platinum',
        documentationUrls: ['doc1', 'doc2', 'doc3'],
        complianceStatements: JSON.stringify({ hipaa: true, nist: true, fda: true }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([
        { id: 'dep-1', vendorId: 'vendor-1', status: 'active' },
        { id: 'dep-2', vendorId: 'vendor-1', status: 'active' },
        { id: 'dep-3', vendorId: 'vendor-1', status: 'active' }
      ]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const result = await processCertificationApplication('app-1');

      expect(result.checks.complianceStatementsValid).toBe(true);
    });

    it('should pass Platinum with HIPAA + NIST + ISO', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Platinum',
        documentationUrls: ['doc1', 'doc2', 'doc3'],
        complianceStatements: JSON.stringify({ hipaa: true, nist: true, iso: true }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([
        { id: 'dep-1', vendorId: 'vendor-1', status: 'active' },
        { id: 'dep-2', vendorId: 'vendor-1', status: 'active' },
        { id: 'dep-3', vendorId: 'vendor-1', status: 'active' }
      ]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const result = await processCertificationApplication('app-1');

      expect(result.checks.complianceStatementsValid).toBe(true);
    });
  });

  describe('Deployment History Validation', () => {
    it('should pass Silver tier with 0 deployments', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Silver',
        documentationUrls: ['doc1'],
        complianceStatements: JSON.stringify({ hipaa: true }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const result = await processCertificationApplication('app-1');

      expect(result.checks.deploymentHistoryValid).toBe(true);
    });

    it('should fail Gold tier with 0 deployments', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Gold',
        documentationUrls: ['doc1', 'doc2'],
        complianceStatements: JSON.stringify({ hipaa: true, nist: true }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const result = await processCertificationApplication('app-1');

      expect(result.checks.deploymentHistoryValid).toBe(false);
      expect(result.recommendations).toContain('Gold tier requires at least 1 active deployment with a health system');
    });

    it('should pass Gold tier with 1 active deployment', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Gold',
        documentationUrls: ['doc1', 'doc2'],
        complianceStatements: JSON.stringify({ hipaa: true, nist: true }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([
        { id: 'dep-1', vendorId: 'vendor-1', status: 'active' }
      ]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const result = await processCertificationApplication('app-1');

      expect(result.checks.deploymentHistoryValid).toBe(true);
    });

    it('should ignore inactive deployments', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Gold',
        documentationUrls: ['doc1', 'doc2'],
        complianceStatements: JSON.stringify({ hipaa: true, nist: true }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([
        { id: 'dep-1', vendorId: 'vendor-1', status: 'inactive' },
        { id: 'dep-2', vendorId: 'vendor-1', status: 'archived' }
      ]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const result = await processCertificationApplication('app-1');

      expect(result.checks.deploymentHistoryValid).toBe(false);
    });

    it('should require 3 active deployments for Platinum', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Platinum',
        documentationUrls: ['doc1', 'doc2', 'doc3'],
        complianceStatements: JSON.stringify({ hipaa: true, nist: true, fda: true }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([
        { id: 'dep-1', vendorId: 'vendor-1', status: 'active' },
        { id: 'dep-2', vendorId: 'vendor-1', status: 'active' }
      ]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const result = await processCertificationApplication('app-1');

      expect(result.checks.deploymentHistoryValid).toBe(false);
      expect(result.recommendations).toContain('Platinum tier requires at least 3 active deployments with health systems');
    });

    it('should pass Platinum with 3 active deployments', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Platinum',
        documentationUrls: ['doc1', 'doc2', 'doc3'],
        complianceStatements: JSON.stringify({ hipaa: true, nist: true, fda: true }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([
        { id: 'dep-1', vendorId: 'vendor-1', status: 'active' },
        { id: 'dep-2', vendorId: 'vendor-1', status: 'active' },
        { id: 'dep-3', vendorId: 'vendor-1', status: 'active' }
      ]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const result = await processCertificationApplication('app-1');

      expect(result.checks.deploymentHistoryValid).toBe(true);
    });
  });

  describe('Scoring Algorithm', () => {
    it('should calculate score of 100 when all checks pass', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Silver',
        documentationUrls: ['doc1'],
        complianceStatements: JSON.stringify({ hipaa: true }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const { vendorTestingSuite } = await import('@server/services/vendor-testing/testing-suite');
      vi.mocked(vendorTestingSuite.runAllTests).mockResolvedValue([
        { testType: 'phi_exposure', passed: true, score: 100, details: {} },
        { testType: 'clinical_accuracy', passed: true, score: 95, details: {} },
        { testType: 'bias_detection', passed: true, score: 100, details: {} },
        { testType: 'security_scan', passed: true, score: 100, details: {} }
      ]);

      const result = await processCertificationApplication('app-1');

      // Documentation: 20 + Compliance: 20 + Deployment: 10 + PHI: 15 + Clinical: 15 + Bias: 10 + Security: 10 = 100
      expect(result.score).toBe(100);
    });

    it('should calculate score of 50 with only documentation and compliance', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Gold',
        documentationUrls: ['doc1', 'doc2'],
        complianceStatements: JSON.stringify({ hipaa: true, nist: true }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const { vendorTestingSuite } = await import('@server/services/vendor-testing/testing-suite');
      vi.mocked(vendorTestingSuite.runAllTests).mockResolvedValue([
        { testType: 'phi_exposure', passed: false, score: 60, details: { violations: 5 } },
        { testType: 'clinical_accuracy', passed: false, score: 85, details: {} },
        { testType: 'bias_detection', passed: false, score: 70, details: {} },
        { testType: 'security_scan', passed: false, score: 80, details: {} }
      ]);

      const result = await processCertificationApplication('app-1');

      // Documentation: 20 + Compliance: 20 + Deployment: 0 + All tests: 0 = 40
      expect(result.score).toBe(40);
    });

    it('should weight checks correctly (Documentation=20, Compliance=20, Deployment=10, PHI=15, Clinical=15, Bias=10, Security=10)', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Silver',
        documentationUrls: ['doc1'],
        complianceStatements: JSON.stringify({ hipaa: true }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const { vendorTestingSuite } = await import('@server/services/vendor-testing/testing-suite');
      vi.mocked(vendorTestingSuite.runAllTests).mockResolvedValue([
        { testType: 'phi_exposure', passed: true, score: 100, details: {} },
        { testType: 'clinical_accuracy', passed: false, score: 85, details: {} },
        { testType: 'bias_detection', passed: false, score: 70, details: {} },
        { testType: 'security_scan', passed: false, score: 80, details: {} }
      ]);

      const result = await processCertificationApplication('app-1');

      // Documentation: 20 + Compliance: 20 + Deployment: 10 + PHI: 15 = 65
      expect(result.score).toBe(65);
    });
  });

  describe('Overall Pass/Fail Logic', () => {
    it('should pass when all checks are true', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Silver',
        documentationUrls: ['doc1'],
        complianceStatements: JSON.stringify({ hipaa: true }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const { vendorTestingSuite } = await import('@server/services/vendor-testing/testing-suite');
      vi.mocked(vendorTestingSuite.runAllTests).mockResolvedValue([
        { testType: 'phi_exposure', passed: true, score: 100, details: {} },
        { testType: 'clinical_accuracy', passed: true, score: 95, details: {} },
        { testType: 'bias_detection', passed: true, score: 100, details: {} },
        { testType: 'security_scan', passed: true, score: 100, details: {} }
      ]);

      const result = await processCertificationApplication('app-1');

      expect(result.passed).toBe(true);
    });

    it('should fail when any check is false', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Silver',
        documentationUrls: [],  // Failing documentation check
        complianceStatements: JSON.stringify({ hipaa: true }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const { vendorTestingSuite } = await import('@server/services/vendor-testing/testing-suite');
      vi.mocked(vendorTestingSuite.runAllTests).mockResolvedValue([
        { testType: 'phi_exposure', passed: true, score: 100, details: {} },
        { testType: 'clinical_accuracy', passed: true, score: 95, details: {} },
        { testType: 'bias_detection', passed: true, score: 100, details: {} },
        { testType: 'security_scan', passed: true, score: 100, details: {} }
      ]);

      const result = await processCertificationApplication('app-1');

      expect(result.passed).toBe(false);
    });
  });

  describe('Status Updates', () => {
    it('should update status to "in_review" when passed', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Silver',
        documentationUrls: ['doc1'],
        complianceStatements: JSON.stringify({ hipaa: true }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const { vendorTestingSuite } = await import('@server/services/vendor-testing/testing-suite');
      vi.mocked(vendorTestingSuite.runAllTests).mockResolvedValue([
        { testType: 'phi_exposure', passed: true, score: 100, details: {} },
        { testType: 'clinical_accuracy', passed: true, score: 95, details: {} },
        { testType: 'bias_detection', passed: true, score: 100, details: {} },
        { testType: 'security_scan', passed: true, score: 100, details: {} }
      ]);

      await processCertificationApplication('app-1');

      expect(storage.updateCertificationApplicationStatus).toHaveBeenCalledWith(
        'app-1',
        'in_review',
        true,
        expect.any(String)
      );
    });

    it('should update status to "pending" when failed', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Silver',
        documentationUrls: [],
        complianceStatements: JSON.stringify({ hipaa: true }),
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      await processCertificationApplication('app-1');

      expect(storage.updateCertificationApplicationStatus).toHaveBeenCalledWith(
        'app-1',
        'pending',
        false,
        expect.any(String)
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw error when application not found', async () => {
      vi.mocked(storage.getCertificationApplication).mockResolvedValue(null);

      await expect(
        processCertificationApplication('non-existent')
      ).rejects.toThrow('Application not found: non-existent');
    });

    it('should handle invalid JSON in compliance statements', async () => {
      const application = {
        id: 'app-1',
        vendorId: 'vendor-1',
        tierRequested: 'Silver',
        documentationUrls: ['doc1'],
        complianceStatements: 'invalid-json',
      };

      vi.mocked(storage.getCertificationApplication).mockResolvedValue(application);
      vi.mocked(storage.getDeploymentsByVendor).mockResolvedValue([]);
      vi.mocked(storage.updateCertificationApplicationStatus).mockResolvedValue(undefined);

      const result = await processCertificationApplication('app-1');

      expect(result.checks.complianceStatementsValid).toBe(false);
    });
  });
});
