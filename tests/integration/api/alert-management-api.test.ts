/**
 * INTEGRATION TESTS: Alert Management API
 * Tests the full alert lifecycle including creation, acknowledgment, and resolution
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CreateAlertUseCase } from '../../../server/application/alert-management/CreateAlertUseCase';
import { ListAlertsUseCase } from '../../../server/application/alert-management/ListAlertsUseCase';
import { GetAlertUseCase } from '../../../server/application/alert-management/GetAlertUseCase';
import { AcknowledgeAlertUseCase } from '../../../server/application/alert-management/AcknowledgeAlertUseCase';
import { ResolveAlertUseCase } from '../../../server/application/alert-management/ResolveAlertUseCase';
import { MockAlertRepository, MockNotificationGateway, MockAuditLogger } from '../../mocks';

describe('Alert Management API Integration Tests', () => {
  let alertRepository: MockAlertRepository;
  let notificationGateway: MockNotificationGateway;
  let auditLogger: MockAuditLogger;

  beforeEach(() => {
    console.log('🧪 Test environment initialized');
    alertRepository = new MockAlertRepository();
    notificationGateway = new MockNotificationGateway();
    auditLogger = new MockAuditLogger();
  });

  afterEach(() => {
    alertRepository.clear();
    notificationGateway.clear();
    auditLogger.clear();
    console.log('✅ Test environment cleaned up');
  });

  describe('POST /api/alerts', () => {
    it('should create high severity alert successfully', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);

      const result = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'compliance_violation',
        message: 'HIPAA violation detected in model output',
        metadata: { violationType: 'PHI_EXPOSURE', affectedRecords: 5 },
      });

      expect(result.alertId).toBeTruthy();
      expect(result.severity).toBe('high');
      expect(result.isDuplicate).toBe(false);
      expect(result.notificationChannels).toContain('email');
    });

    it('should create critical alert with 2-minute SLA', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);

      const result = await createUseCase.execute({
        aiSystemId: 'ai-system-789',
        healthSystemId: 'hs-999',
        type: 'security_breach',
        message: 'Unauthorized access detected',
        metadata: { ipAddress: '192.168.1.100', attempts: 10 },
      });

      expect(result.severity).toBe('critical');
      expect(result.notificationChannels).toContain('pagerduty');
    });

    it('should prevent duplicate alerts within 1-hour window', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);

      // Create first alert
      const first = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'model_drift',
        message: 'Model accuracy degraded by 15%',
      });

      expect(first.alertId).toBeTruthy();
      expect(first.isDuplicate).toBe(false);

      // Attempt to create duplicate - should return isDuplicate: true
      const duplicate = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'model_drift',
        message: 'Model accuracy degraded by 16%',
      });

      expect(duplicate.isDuplicate).toBe(true);
      expect(duplicate.alertId).toBe(first.alertId);
    });

    it('should allow different alert types for same AI system', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);

      const alert1 = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'model_drift',
        message: 'Accuracy degraded',
      });

      const alert2 = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'compliance_violation',
        message: 'HIPAA violation',
      });

      expect(alert1.alertId).not.toBe(alert2.alertId);
      expect(alert1.severity).toBe('medium');
      expect(alert2.severity).toBe('high');
    });
  });

  describe('GET /api/alerts', () => {
    it('should list all alerts for AI system', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);
      const listUseCase = new ListAlertsUseCase(alertRepository);

      // Create multiple alerts
      await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'model_drift',
        message: 'Alert 1',
      });

      await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'compliance_violation',
        message: 'Alert 2',
      });

      const result = await listUseCase.execute({ aiSystemId: 'ai-system-123' });

      expect(result).toHaveLength(2);
    });

    it('should filter alerts by severity', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);
      const listUseCase = new ListAlertsUseCase(alertRepository);

      await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'model_drift',
        message: 'Low severity',
      });

      await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'compliance_violation',
        message: 'Critical issue',
      });

      const result = await listUseCase.execute({
        aiSystemId: 'ai-system-123',
        severity: 'high',
      });

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].severity).toBe('high');
    });

    it('should filter alerts by status', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);
      const acknowledgeUseCase = new AcknowledgeAlertUseCase(alertRepository);
      const listUseCase = new ListAlertsUseCase(alertRepository);

      const alert = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'model_drift',
        message: 'Alert to acknowledge',
      });

      // Acknowledge one alert
      await acknowledgeUseCase.execute({
        alertId: alert.alertId,
        userId: 'admin-user-123',
      });

      await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'performance_degradation',
        message: 'Still open',
      });

      const activeAlerts = await listUseCase.execute({
        aiSystemId: 'ai-system-123',
        status: 'active',
      });

      expect(activeAlerts).toHaveLength(1);
      expect(activeAlerts[0].status).toBe('active');
    });
  });

  describe('GET /api/alerts/:id', () => {
    it('should retrieve alert by ID', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);
      const getUseCase = new GetAlertUseCase(alertRepository);

      const created = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'compliance_violation',
        message: 'Test alert',
        metadata: { key: 'value' },
      });

      const result = await getUseCase.execute({ alertId: created.alertId });

      expect(result.id).toBe(created.alertId);
      expect(result.message).toBe('Test alert');
      expect(result.metadata).toEqual({ key: 'value' });
    });

    it('should throw error for non-existent alert', async () => {
      const getUseCase = new GetAlertUseCase(alertRepository);

      await expect(
        getUseCase.execute({ alertId: 'non-existent-id' })
      ).rejects.toThrow('Alert not found');
    });
  });

  describe('PUT /api/alerts/:id/acknowledge', () => {
    it('should acknowledge alert successfully', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);
      const acknowledgeUseCase = new AcknowledgeAlertUseCase(alertRepository);

      const alert = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'model_drift',
        message: 'Alert to acknowledge',
      });

      const result = await acknowledgeUseCase.execute({
        alertId: alert.alertId,
        userId: 'admin-user-456',
      });

      expect(result.acknowledgedBy).toBe('admin-user-456');
      expect(result.acknowledgedAt).toBeInstanceOf(Date);
    });

    it('should prevent acknowledging already acknowledged alert', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);
      const acknowledgeUseCase = new AcknowledgeAlertUseCase(alertRepository);

      const alert = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'model_drift',
        message: 'Alert',
      });

      // Acknowledge once
      await acknowledgeUseCase.execute({
        alertId: alert.alertId,
        userId: 'user-1',
      });

      // Attempt to acknowledge again
      await expect(
        acknowledgeUseCase.execute({
          alertId: alert.alertId,
          userId: 'user-2',
        })
      ).rejects.toThrow('Cannot acknowledge alert that is not active');
    });
  });

  describe('PUT /api/alerts/:id/resolve', () => {
    it('should resolve acknowledged alert successfully', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);
      const acknowledgeUseCase = new AcknowledgeAlertUseCase(alertRepository);
      const resolveUseCase = new ResolveAlertUseCase(alertRepository, auditLogger);

      const alert = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'model_drift',
        message: 'Alert to resolve',
      });

      // Acknowledge first
      await acknowledgeUseCase.execute({
        alertId: alert.alertId,
        userId: 'admin-user-123',
      });

      // Then resolve
      const result = await resolveUseCase.execute({
        alertId: alert.alertId,
        userId: 'engineer-user-789',
      });

      expect(result.alertId).toBe(alert.alertId);
      expect(result.responseTimeSeconds).toBeGreaterThanOrEqual(0);
      expect(result.exceededSLA).toBe(false);
    });

    it('should allow resolving open alert directly', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);
      const resolveUseCase = new ResolveAlertUseCase(alertRepository, auditLogger);

      const alert = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'model_drift',
        message: 'Minor issue',
      });

      const result = await resolveUseCase.execute({
        alertId: alert.alertId,
        userId: 'engineer-user-789',
      });

      expect(result.alertId).toBe(alert.alertId);
      expect(result.responseTimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('should prevent resolving already resolved alert', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);
      const resolveUseCase = new ResolveAlertUseCase(alertRepository, auditLogger);

      const alert = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'model_drift',
        message: 'Alert',
      });

      // Resolve once
      await resolveUseCase.execute({
        alertId: alert.alertId,
        userId: 'user-1',
      });

      // Attempt to resolve again
      await expect(
        resolveUseCase.execute({
          alertId: alert.alertId,
          userId: 'user-2',
        })
      ).rejects.toThrow('Alert must be in active or acknowledged state to resolve');
    });

  });

  describe('Alert SLA Management', () => {
    it('should calculate correct SLA for critical alerts', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);

      const result = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'security_breach',
        message: 'Critical issue',
      });

      const alert = await alertRepository.findById(result.alertId);
      expect(alert).toBeTruthy();
      
      const slaMinutes = Math.round(
        (alert!.slaDeadline!.getTime() - alert!.createdAt.getTime()) / (1000 * 60)
      );
      expect(slaMinutes).toBe(2);
    });

    it('should calculate correct SLA for high alerts', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);

      const result = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'compliance_violation',
        message: 'High priority',
      });

      const alert = await alertRepository.findById(result.alertId);
      expect(alert).toBeTruthy();
      
      const slaHours = Math.round(
        (alert!.slaDeadline!.getTime() - alert!.createdAt.getTime()) / (1000 * 60 * 60)
      );
      expect(slaHours).toBe(4);
    });

    it('should calculate correct SLA for medium alerts', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);

      const result = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'model_drift',
        message: 'Medium priority',
      });

      const alert = await alertRepository.findById(result.alertId);
      expect(alert).toBeTruthy();
      
      const slaHours = Math.round(
        (alert!.slaDeadline!.getTime() - alert!.createdAt.getTime()) / (1000 * 60 * 60)
      );
      expect(slaHours).toBe(24);
    });

    it('should calculate correct SLA for low alerts', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);

      const result = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'performance_degradation',
        message: 'Low priority',
      });

      const alert = await alertRepository.findById(result.alertId);
      expect(alert).toBeTruthy();
      
      const slaHours = Math.round(
        (alert!.slaDeadline!.getTime() - alert!.createdAt.getTime()) / (1000 * 60 * 60)
      );
      expect(slaHours).toBe(72);
    });
  });
});
