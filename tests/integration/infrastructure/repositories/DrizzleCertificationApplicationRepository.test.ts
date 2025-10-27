/**
 * Drizzle Repository Integration Tests
 * 
 * These tests verify the repository correctly maps between domain entities
 * and database persistence (round-trip fidelity).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DrizzleCertificationApplicationRepository } from '@server/infrastructure/repositories/DrizzleCertificationApplicationRepository';
import {
  CertificationApplication,
  CertificationTier,
  ApplicationStatus
} from '@server/domain/entities/CertificationApplication';

describe('DrizzleCertificationApplicationRepository (Integration)', () => {
  let repository: DrizzleCertificationApplicationRepository;

  beforeEach(() => {
    repository = new DrizzleCertificationApplicationRepository();
  });

  describe('Round-trip Persistence', () => {
    it('should save and retrieve Silver tier application with all data intact', async () => {
      // Create domain entity
      const original = CertificationApplication.create(
        'vendor-test-1',
        CertificationTier.SILVER,
        ['https://doc1.pdf'],
        { hipaa: true, nist: false }
      );

      // Save to database
      const saved = await repository.save(original);
      expect(saved.id).toBe(original.id);

      // Retrieve from database
      const retrieved = await repository.findById(original.id);

      // Verify round-trip fidelity
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(original.id);
      expect(retrieved!.vendorId).toBe('vendor-test-1');
      expect(retrieved!.tierRequested).toBe(CertificationTier.SILVER);
      expect(retrieved!.documentationUrls).toEqual(['https://doc1.pdf']);
      expect(retrieved!.complianceStatements).toEqual({ hipaa: true, nist: false });
      expect(retrieved!.status).toBe(ApplicationStatus.PENDING);
      expect(retrieved!.automatedChecksPassed).toBe(false);
      expect(retrieved!.score).toBe(0);
    });

    it('should preserve compliance statements for Gold tier', async () => {
      const original = CertificationApplication.create(
        'vendor-test-2',
        CertificationTier.GOLD,
        ['doc1', 'doc2'],
        { hipaa: true, nist: true }
      );

      await repository.save(original);
      const retrieved = await repository.findById(original.id);

      expect(retrieved!.complianceStatements).toEqual({ hipaa: true, nist: true });
    });

    it('should preserve compliance statements for Platinum tier with FDA', async () => {
      const original = CertificationApplication.create(
        'vendor-test-3',
        CertificationTier.PLATINUM,
        ['doc1', 'doc2', 'doc3'],
        { hipaa: true, nist: true, fda: true }
      );

      await repository.save(original);
      const retrieved = await repository.findById(original.id);

      expect(retrieved!.complianceStatements).toEqual({ hipaa: true, nist: true, fda: true });
      expect(retrieved!.areComplianceStatementsValid()).toBe(true);
    });

    it('should preserve compliance statements for Platinum tier with ISO', async () => {
      const original = CertificationApplication.create(
        'vendor-test-4',
        CertificationTier.PLATINUM,
        ['doc1', 'doc2', 'doc3'],
        { hipaa: true, nist: true, iso: true }
      );

      await repository.save(original);
      const retrieved = await repository.findById(original.id);

      expect(retrieved!.complianceStatements).toEqual({ hipaa: true, nist: true, iso: true });
      expect(retrieved!.areComplianceStatementsValid()).toBe(true);
    });

    it('should handle updates correctly (upsert logic)', async () => {
      const original = CertificationApplication.create(
        'vendor-test-5',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );

      // Save original
      await repository.save(original);

      // Process checks (simulating use case)
      original.processAutomatedChecks(
        {
          documentationComplete: true,
          complianceStatementsValid: true,
          deploymentHistoryValid: true,
          phiExposureTest: true,
          clinicalAccuracyTest: true,
          biasDetectionTest: true,
          securityScanTest: true
        },
        {},
        []
      );

      // Save updates
      await repository.save(original);

      // Retrieve and verify updates persisted
      const retrieved = await repository.findById(original.id);
      expect(retrieved!.status).toBe(ApplicationStatus.IN_REVIEW);
      expect(retrieved!.automatedChecksPassed).toBe(true);
      expect(retrieved!.score).toBe(100);
    });

    it('should preserve apiEndpoint when provided', async () => {
      const original = CertificationApplication.create(
        'vendor-test-6',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false },
        'https://api.vendor.com/v1'
      );

      await repository.save(original);
      const retrieved = await repository.findById(original.id);

      expect(retrieved!.apiEndpoint).toBe('https://api.vendor.com/v1');
    });

    it('should handle null apiEndpoint correctly', async () => {
      const original = CertificationApplication.create(
        'vendor-test-7',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false },
        null
      );

      await repository.save(original);
      const retrieved = await repository.findById(original.id);

      expect(retrieved!.apiEndpoint).toBeNull();
    });
  });

  describe('Query Methods', () => {
    it('should return null for non-existent application', async () => {
      const retrieved = await repository.findById('non-existent-id');
      expect(retrieved).toBeNull();
    });

    it('should find applications by vendor ID', async () => {
      const app1 = CertificationApplication.create(
        'vendor-query-test',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );

      const app2 = CertificationApplication.create(
        'vendor-query-test',
        CertificationTier.GOLD,
        ['doc1', 'doc2'],
        { hipaa: true, nist: true }
      );

      await repository.save(app1);
      await repository.save(app2);

      const applications = await repository.findByVendorId('vendor-query-test');
      expect(applications.length).toBeGreaterThanOrEqual(2);
      
      const vendorIds = applications.map(a => a.vendorId);
      expect(vendorIds.every(id => id === 'vendor-query-test')).toBe(true);
    });

    it('should find applications by status', async () => {
      const app = CertificationApplication.create(
        'vendor-status-test',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );

      await repository.save(app);

      const pending = await repository.findByStatus(ApplicationStatus.PENDING);
      const hasOurApp = pending.some(a => a.id === app.id);
      expect(hasOurApp).toBe(true);
    });

    it('should check existence correctly', async () => {
      const app = CertificationApplication.create(
        'vendor-exists-test',
        CertificationTier.SILVER,
        ['doc1'],
        { hipaa: true, nist: false }
      );

      const existsBeforeSave = await repository.exists(app.id);
      expect(existsBeforeSave).toBe(false);

      await repository.save(app);

      const existsAfterSave = await repository.exists(app.id);
      expect(existsAfterSave).toBe(true);
    });
  });
});
