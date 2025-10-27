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
        severity: 'high',
        message: 'HIPAA violation detected in model output',
        details: { violationType: 'PHI_EXPOSURE', affectedRecords: 5 },
      });

      expect(result.aiSystemId).toBe('ai-system-123');
      expect(result.healthSystemId).toBe('hs-456');
      expect(result.type).toBe('compliance_violation');
      expect(result.severity).toBe('high');
      expect(result.status).toBe('open');
      expect(result.slaDeadline).toBeInstanceOf(Date);
    });

    it('should create critical alert with 2-minute SLA', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);

      const result = await createUseCase.execute({
        aiSystemId: 'ai-system-789',
        healthSystemId: 'hs-999',
        type: 'security_breach',
        severity: 'critical',
        message: 'Unauthorized access detected',
        details: { ipAddress: '192.168.1.100', attempts: 10 },
      });

      expect(result.severity).toBe('critical');
      
      // Critical alerts should have 2-minute SLA
      const slaMinutes = Math.round(
        (result.slaDeadline!.getTime() - result.createdAt.getTime()) / (1000 * 60)
      );
      expect(slaMinutes).toBe(2);
    });

    it('should prevent duplicate alerts within 1-hour window', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);

      // Create first alert
      const first = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'model_drift',
        severity: 'medium',
        message: 'Model accuracy degraded by 15%',
      });

      expect(first.id).toBeDefined();

      // Attempt to create duplicate - should throw
      await expect(
        createUseCase.execute({
          aiSystemId: 'ai-system-123',
          healthSystemId: 'hs-456',
          type: 'model_drift',
          severity: 'medium',
          message: 'Model accuracy degraded by 16%',
        })
      ).rejects.toThrow('Duplicate alert detected');
    });

    it('should allow different alert types for same AI system', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);

      const alert1 = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'model_drift',
        severity: 'medium',
        message: 'Accuracy degraded',
      });

      const alert2 = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'compliance_violation',
        severity: 'high',
        message: 'HIPAA violation',
      });

      expect(alert1.id).not.toBe(alert2.id);
      expect(alert1.type).not.toBe(alert2.type);
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
        severity: 'medium',
        message: 'Alert 1',
      });

      await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'compliance_violation',
        severity: 'high',
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
        severity: 'low',
        message: 'Low severity',
      });

      await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'compliance_violation',
        severity: 'critical',
        message: 'Critical issue',
      });

      const result = await listUseCase.execute({
        aiSystemId: 'ai-system-123',
        severity: 'critical',
      });

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('critical');
    });

    it('should filter alerts by status', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);
      const acknowledgeUseCase = new AcknowledgeAlertUseCase(alertRepository);
      const listUseCase = new ListAlertsUseCase(alertRepository);

      const alert = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'model_drift',
        severity: 'medium',
        message: 'Alert to acknowledge',
      });

      // Acknowledge one alert
      await acknowledgeUseCase.execute({
        alertId: alert.id!,
        acknowledgedBy: 'admin-user-123',
      });

      await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'performance_degradation',
        severity: 'medium',
        message: 'Still open',
      });

      const openAlerts = await listUseCase.execute({
        aiSystemId: 'ai-system-123',
        status: 'open',
      });

      expect(openAlerts).toHaveLength(1);
      expect(openAlerts[0].status).toBe('open');
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
        severity: 'high',
        message: 'Test alert',
        details: { key: 'value' },
      });

      const result = await getUseCase.execute({ alertId: created.id! });

      expect(result.id).toBe(created.id);
      expect(result.message).toBe('Test alert');
      expect(result.details).toEqual({ key: 'value' });
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
        severity: 'medium',
        message: 'Alert to acknowledge',
      });

      const result = await acknowledgeUseCase.execute({
        alertId: alert.id!,
        acknowledgedBy: 'admin-user-456',
      });

      expect(result.status).toBe('acknowledged');
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
        severity: 'medium',
        message: 'Alert',
      });

      // Acknowledge once
      await acknowledgeUseCase.execute({
        alertId: alert.id!,
        acknowledgedBy: 'user-1',
      });

      // Attempt to acknowledge again
      await expect(
        acknowledgeUseCase.execute({
          alertId: alert.id!,
          acknowledgedBy: 'user-2',
        })
      ).rejects.toThrow('Alert is not in open state');
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
        severity: 'medium',
        message: 'Alert to resolve',
      });

      // Acknowledge first
      await acknowledgeUseCase.execute({
        alertId: alert.id!,
        acknowledgedBy: 'admin-user-123',
      });

      // Then resolve
      const result = await resolveUseCase.execute({
        alertId: alert.id!,
        resolvedBy: 'engineer-user-789',
        resolution: 'Model retrained and deployed',
      });

      expect(result.status).toBe('resolved');
      expect(result.resolvedBy).toBe('engineer-user-789');
      expect(result.resolution).toBe('Model retrained and deployed');
      expect(result.resolvedAt).toBeInstanceOf(Date);
    });

    it('should allow resolving open alert directly', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);
      const resolveUseCase = new ResolveAlertUseCase(alertRepository, auditLogger);

      const alert = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'model_drift',
        severity: 'low',
        message: 'Minor issue',
      });

      const result = await resolveUseCase.execute({
        alertId: alert.id!,
        resolvedBy: 'engineer-user-789',
        resolution: 'Fixed immediately',
      });

      expect(result.status).toBe('resolved');
    });

    it('should prevent resolving already resolved alert', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);
      const resolveUseCase = new ResolveAlertUseCase(alertRepository, auditLogger);

      const alert = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'model_drift',
        severity: 'medium',
        message: 'Alert',
      });

      // Resolve once
      await resolveUseCase.execute({
        alertId: alert.id!,
        resolvedBy: 'user-1',
        resolution: 'Fixed',
      });

      // Attempt to resolve again
      await expect(
        resolveUseCase.execute({
          alertId: alert.id!,
          resolvedBy: 'user-2',
          resolution: 'Already fixed',
        })
      ).rejects.toThrow('Alert must be in open or acknowledged state');
    });

    it('should require resolution notes when resolving', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);
      const resolveUseCase = new ResolveAlertUseCase(alertRepository, auditLogger);

      const alert = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'model_drift',
        severity: 'medium',
        message: 'Alert',
      });

      await expect(
        resolveUseCase.execute({
          alertId: alert.id!,
          resolvedBy: 'user-1',
          resolution: '',
        })
      ).rejects.toThrow('Resolution notes are required');
    });
  });

  describe('Alert SLA Management', () => {
    it('should calculate correct SLA for critical alerts', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);

      const alert = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'security_breach',
        severity: 'critical',
        message: 'Critical issue',
      });

      const slaMinutes = Math.round(
        (alert.slaDeadline!.getTime() - alert.createdAt.getTime()) / (1000 * 60)
      );
      expect(slaMinutes).toBe(2);
    });

    it('should calculate correct SLA for high alerts', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);

      const alert = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'compliance_violation',
        severity: 'high',
        message: 'High priority',
      });

      const slaHours = Math.round(
        (alert.slaDeadline!.getTime() - alert.createdAt.getTime()) / (1000 * 60 * 60)
      );
      expect(slaHours).toBe(4);
    });

    it('should calculate correct SLA for medium alerts', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);

      const alert = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'model_drift',
        severity: 'medium',
        message: 'Medium priority',
      });

      const slaHours = Math.round(
        (alert.slaDeadline!.getTime() - alert.createdAt.getTime()) / (1000 * 60 * 60)
      );
      expect(slaHours).toBe(24);
    });

    it('should calculate correct SLA for low alerts', async () => {
      const createUseCase = new CreateAlertUseCase(alertRepository, notificationGateway);

      const alert = await createUseCase.execute({
        aiSystemId: 'ai-system-123',
        healthSystemId: 'hs-456',
        type: 'performance_degradation',
        severity: 'low',
        message: 'Low priority',
      });

      const slaHours = Math.round(
        (alert.slaDeadline!.getTime() - alert.createdAt.getTime()) / (1000 * 60 * 60)
      );
      expect(slaHours).toBe(72);
    });
  });
});
