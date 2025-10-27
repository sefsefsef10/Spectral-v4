/**
 * CertificationApplication Domain Entity Unit Tests
 * 
 * Pure domain logic tests - fast, isolated, no dependencies.
 */

import { describe, it, expect } from 'vitest';
import {
  CertificationApplication,
  CertificationTier,
  ApplicationStatus,
  CertificationDomainError,
  ApplicationCreatedEvent,
  AutomatedChecksCompletedEvent,
  ApplicationApprovedEvent,
  ApplicationRejectedEvent,
  type ComplianceStatements,
  type CertificationChecks
} from '@server/domain/entities/CertificationApplication';

describe('CertificationApplication Entity', () => {
  describe('create', () => {
    it('should create new application with pending status', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        ['https://doc1.pdf'],
        { hipaa: true, nist: false }
      );

      expect(app.id).toBeDefined();
      expect(app.vendorId).toBe('vendor-1');
      expect(app.tierRequested).toBe(CertificationTier.SILVER);
      expect(app.status).toBe(ApplicationStatus.PENDING);
      expect(app.automatedChecksPassed).toBe(false);
      expect(app.score).toBe(0);
    });

    it('should raise ApplicationCreated event', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.GOLD,
        ['doc1', 'doc2'],
        { hipaa: true, nist: true }
      );

      expect(app.domainEvents).toHaveLength(1);
      expect(app.domainEvents[0].eventType).toBe('certification.application.created');
      const event = app.domainEvents[0] as ApplicationCreatedEvent;
      expect(event.vendorId).toBe('vendor-1');
      expect(event.tierRequested).toBe(CertificationTier.GOLD);
    });

    it('should throw error for missing vendor ID', () => {
      expect(() =>
        CertificationApplication.create(
          '',
          CertificationTier.SILVER,
          ['doc1'],
          { hipaa: true, nist: false }
        )
      ).toThrow(CertificationDomainError);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute from database data', () => {
      const createdAt = new Date('2025-01-01');
      const updatedAt = new Date('2025-01-02');

      const app = CertificationApplication.reconstitute(
        'app-1',
        'vendor-1',
        CertificationTier.GOLD,
        ['doc1', 'doc2'],
        { hipaa: true, nist: true },
        'https://api.example.com',
        ApplicationStatus.IN_REVIEW,
        true,
        '{"passed":true}',
        85,
        createdAt,
        updatedAt
      );

      expect(app.id).toBe('app-1');
      expect(app.status).toBe(ApplicationStatus.IN_REVIEW);
      expect(app.score).toBe(85);
      expect(app.createdAt).toBe(createdAt);
    });

    it('should not raise events when reconstituting', () => {
      const app = CertificationApplication.reconstitute(
        'app-1',
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false },
        null,
        ApplicationStatus.PENDING,
        false,
        null,
        0,
        new Date(),
        new Date()
      );

      expect(app.domainEvents).toHaveLength(0);
    });
  });

  describe('isDocumentationComplete', () => {
    it('should return true for Silver with 1 document', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );

      expect(app.isDocumentationComplete()).toBe(true);
    });

    it('should return false for Silver with 0 documents', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        [],
        { hipaa: true, nist: false }
      );

      expect(app.isDocumentationComplete()).toBe(false);
    });

    it('should return true for Gold with 2 documents', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.GOLD,
        ['doc1', 'doc2'],
        { hipaa: true, nist: true }
      );

      expect(app.isDocumentationComplete()).toBe(true);
    });

    it('should return false for Gold with 1 document', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.GOLD,
        ['doc1'],
        { hipaa: true, nist: true }
      );

      expect(app.isDocumentationComplete()).toBe(false);
    });

    it('should return true for Platinum with 3 documents', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.PLATINUM,
        ['doc1', 'doc2', 'doc3'],
        { hipaa: true, nist: true, fda: true }
      );

      expect(app.isDocumentationComplete()).toBe(true);
    });

    it('should return false for Platinum with 2 documents', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.PLATINUM,
        ['doc1', 'doc2'],
        { hipaa: true, nist: true, fda: true }
      );

      expect(app.isDocumentationComplete()).toBe(false);
    });
  });

  describe('areComplianceStatementsValid', () => {
    it('should return true for Silver with HIPAA', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );

      expect(app.areComplianceStatementsValid()).toBe(true);
    });

    it('should return false for Silver without HIPAA', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: false, nist: false }
      );

      expect(app.areComplianceStatementsValid()).toBe(false);
    });

    it('should return true for Gold with HIPAA + NIST', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.GOLD,
        ['doc1', 'doc2'],
        { hipaa: true, nist: true }
      );

      expect(app.areComplianceStatementsValid()).toBe(true);
    });

    it('should return false for Gold without NIST', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.GOLD,
        ['doc1', 'doc2'],
        { hipaa: true, nist: false }
      );

      expect(app.areComplianceStatementsValid()).toBe(false);
    });

    it('should return true for Platinum with HIPAA + NIST + FDA', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.PLATINUM,
        ['doc1', 'doc2', 'doc3'],
        { hipaa: true, nist: true, fda: true }
      );

      expect(app.areComplianceStatementsValid()).toBe(true);
    });

    it('should return true for Platinum with HIPAA + NIST + ISO', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.PLATINUM,
        ['doc1', 'doc2', 'doc3'],
        { hipaa: true, nist: true, iso: true }
      );

      expect(app.areComplianceStatementsValid()).toBe(true);
    });

    it('should return false for Platinum without FDA or ISO', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.PLATINUM,
        ['doc1', 'doc2', 'doc3'],
        { hipaa: true, nist: true, fda: false, iso: false }
      );

      expect(app.areComplianceStatementsValid()).toBe(false);
    });
  });

  describe('isDeploymentHistoryValid', () => {
    it('should return true for Silver with 0 deployments', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );

      expect(app.isDeploymentHistoryValid(0)).toBe(true);
    });

    it('should return false for Gold with 0 deployments', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.GOLD,
        ['doc1', 'doc2'],
        { hipaa: true, nist: true }
      );

      expect(app.isDeploymentHistoryValid(0)).toBe(false);
    });

    it('should return true for Gold with 1 deployment', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.GOLD,
        ['doc1', 'doc2'],
        { hipaa: true, nist: true }
      );

      expect(app.isDeploymentHistoryValid(1)).toBe(true);
    });

    it('should return false for Platinum with 2 deployments', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.PLATINUM,
        ['doc1', 'doc2', 'doc3'],
        { hipaa: true, nist: true, fda: true }
      );

      expect(app.isDeploymentHistoryValid(2)).toBe(false);
    });

    it('should return true for Platinum with 3 deployments', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.PLATINUM,
        ['doc1', 'doc2', 'doc3'],
        { hipaa: true, nist: true, fda: true }
      );

      expect(app.isDeploymentHistoryValid(3)).toBe(true);
    });
  });

  describe('calculateScore', () => {
    it('should calculate 100 when all checks pass', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );

      const checks: CertificationChecks = {
        documentationComplete: true,
        complianceStatementsValid: true,
        deploymentHistoryValid: true,
        phiExposureTest: true,
        clinicalAccuracyTest: true,
        biasDetectionTest: true,
        securityScanTest: true
      };

      expect(app.calculateScore(checks)).toBe(100);
    });

    it('should calculate 40 with only documentation and compliance', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );

      const checks: CertificationChecks = {
        documentationComplete: true,   // 20
        complianceStatementsValid: true, // 20
        deploymentHistoryValid: false,
        phiExposureTest: false,
        clinicalAccuracyTest: false,
        biasDetectionTest: false,
        securityScanTest: false
      };

      expect(app.calculateScore(checks)).toBe(40);
    });

    it('should weight checks correctly (Doc=20, Compliance=20, Deploy=10, PHI=15, Clinical=15, Bias=10, Security=10)', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );

      const checks: CertificationChecks = {
        documentationComplete: true,     // 20
        complianceStatementsValid: true, // 20
        deploymentHistoryValid: true,    // 10
        phiExposureTest: true,           // 15
        clinicalAccuracyTest: false,
        biasDetectionTest: false,
        securityScanTest: false
      };

      expect(app.calculateScore(checks)).toBe(65);
    });
  });

  describe('determineOverallPass', () => {
    it('should return true when all checks pass', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );

      const checks: CertificationChecks = {
        documentationComplete: true,
        complianceStatementsValid: true,
        deploymentHistoryValid: true,
        phiExposureTest: true,
        clinicalAccuracyTest: true,
        biasDetectionTest: true,
        securityScanTest: true
      };

      expect(app.determineOverallPass(checks)).toBe(true);
    });

    it('should return false when any check fails', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );

      const checks: CertificationChecks = {
        documentationComplete: false, // One failing check
        complianceStatementsValid: true,
        deploymentHistoryValid: true,
        phiExposureTest: true,
        clinicalAccuracyTest: true,
        biasDetectionTest: true,
        securityScanTest: true
      };

      expect(app.determineOverallPass(checks)).toBe(false);
    });
  });

  describe('processAutomatedChecks', () => {
    it('should update status to IN_REVIEW when passed', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );
      app.clearEvents();

      const checks: CertificationChecks = {
        documentationComplete: true,
        complianceStatementsValid: true,
        deploymentHistoryValid: true,
        phiExposureTest: true,
        clinicalAccuracyTest: true,
        biasDetectionTest: true,
        securityScanTest: true
      };

      app.processAutomatedChecks(checks, {}, []);

      expect(app.status).toBe(ApplicationStatus.IN_REVIEW);
      expect(app.automatedChecksPassed).toBe(true);
      expect(app.score).toBe(100);
    });

    it('should update status to PENDING when failed', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );
      app.clearEvents();

      const checks: CertificationChecks = {
        documentationComplete: false,
        complianceStatementsValid: true,
        deploymentHistoryValid: true,
        phiExposureTest: true,
        clinicalAccuracyTest: true,
        biasDetectionTest: true,
        securityScanTest: true
      };

      app.processAutomatedChecks(checks, {}, ['Missing documentation']);

      expect(app.status).toBe(ApplicationStatus.PENDING);
      expect(app.automatedChecksPassed).toBe(false);
    });

    it('should raise AutomatedChecksCompleted event', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );
      app.clearEvents();

      const checks: CertificationChecks = {
        documentationComplete: true,
        complianceStatementsValid: true,
        deploymentHistoryValid: true,
        phiExposureTest: true,
        clinicalAccuracyTest: true,
        biasDetectionTest: true,
        securityScanTest: true
      };

      app.processAutomatedChecks(checks, {}, []);

      expect(app.domainEvents).toHaveLength(1);
      expect(app.domainEvents[0].eventType).toBe('certification.automated_checks_completed');
      const event = app.domainEvents[0] as AutomatedChecksCompletedEvent;
      expect(event.passed).toBe(true);
      expect(event.score).toBe(100);
    });
  });

  describe('approve', () => {
    it('should approve application in review', () => {
      const app = CertificationApplication.reconstitute(
        'app-1',
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false },
        null,
        ApplicationStatus.IN_REVIEW,
        true,
        '{}',
        100,
        new Date(),
        new Date()
      );

      app.approve();

      expect(app.status).toBe(ApplicationStatus.APPROVED);
    });

    it('should raise ApplicationApproved event', () => {
      const app = CertificationApplication.reconstitute(
        'app-1',
        'vendor-1',
        CertificationTier.GOLD,
        ['doc1', 'doc2'],
        { hipaa: true, nist: true },
        null,
        ApplicationStatus.IN_REVIEW,
        true,
        '{}',
        100,
        new Date(),
        new Date()
      );

      app.approve();

      expect(app.domainEvents).toHaveLength(1);
      expect(app.domainEvents[0].eventType).toBe('certification.application.approved');
      const event = app.domainEvents[0] as ApplicationApprovedEvent;
      expect(event.tierAwarded).toBe(CertificationTier.GOLD);
    });

    it('should throw error if not in review', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );

      expect(() => app.approve()).toThrow(CertificationDomainError);
      expect(() => app.approve()).toThrow('Can only approve applications in review');
    });

    it('should throw error if automated checks failed', () => {
      const app = CertificationApplication.reconstitute(
        'app-1',
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false },
        null,
        ApplicationStatus.IN_REVIEW,
        false, // Checks failed
        '{}',
        50,
        new Date(),
        new Date()
      );

      expect(() => app.approve()).toThrow(CertificationDomainError);
      expect(() => app.approve()).toThrow('Cannot approve application that failed automated checks');
    });
  });

  describe('reject', () => {
    it('should reject pending application', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );
      app.clearEvents();

      app.reject('Missing documentation');

      expect(app.status).toBe(ApplicationStatus.REJECTED);
    });

    it('should raise ApplicationRejected event', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );
      app.clearEvents();

      app.reject('Failed security scan');

      expect(app.domainEvents).toHaveLength(1);
      expect(app.domainEvents[0].eventType).toBe('certification.application.rejected');
      const event = app.domainEvents[0] as ApplicationRejectedEvent;
      expect(event.reason).toBe('Failed security scan');
    });

    it('should throw error if already approved', () => {
      const app = CertificationApplication.reconstitute(
        'app-1',
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false },
        null,
        ApplicationStatus.APPROVED,
        true,
        '{}',
        100,
        new Date(),
        new Date()
      );

      expect(() => app.reject('Test')).toThrow(CertificationDomainError);
      expect(() => app.reject('Test')).toThrow('Cannot reject approved application');
    });
  });

  describe('query methods', () => {
    it('canBeApproved should return true when in review and passed checks', () => {
      const app = CertificationApplication.reconstitute(
        'app-1',
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false },
        null,
        ApplicationStatus.IN_REVIEW,
        true,
        '{}',
        100,
        new Date(),
        new Date()
      );

      expect(app.canBeApproved()).toBe(true);
    });

    it('canBeApproved should return false when checks failed', () => {
      const app = CertificationApplication.reconstitute(
        'app-1',
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false },
        null,
        ApplicationStatus.IN_REVIEW,
        false,
        '{}',
        50,
        new Date(),
        new Date()
      );

      expect(app.canBeApproved()).toBe(false);
    });

    it('canBeRejected should return true when not approved', () => {
      const app = CertificationApplication.create(
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );

      expect(app.canBeRejected()).toBe(true);
    });

    it('canBeRejected should return false when approved', () => {
      const app = CertificationApplication.reconstitute(
        'app-1',
        'vendor-1',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false },
        null,
        ApplicationStatus.APPROVED,
        true,
        '{}',
        100,
        new Date(),
        new Date()
      );

      expect(app.canBeRejected()).toBe(false);
    });
  });
});
