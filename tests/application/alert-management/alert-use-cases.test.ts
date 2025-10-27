/**
 * APPLICATION LAYER TESTS: Alert Management Use Cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateAlertUseCase, type AlertRepository as CreateAlertRepository, type NotificationGateway } from '../../../server/application/alert-management/CreateAlertUseCase';
import { ResolveAlertUseCase, type AlertRepository as ResolveAlertRepository, type AuditLogger } from '../../../server/application/alert-management/ResolveAlertUseCase';
import { AcknowledgeAlertUseCase, type AlertRepository as AckAlertRepository } from '../../../server/application/alert-management/AcknowledgeAlertUseCase';
import { Alert } from '../../../server/domain/entities/Alert';

describe('CreateAlertUseCase', () => {
  let mockAlertRepository: CreateAlertRepository;
  let mockNotificationGateway: NotificationGateway;
  let useCase: CreateAlertUseCase;

  beforeEach(() => {
    mockAlertRepository = {
      save: vi.fn(),
      findByDeduplicationKey: vi.fn(),
    };
    mockNotificationGateway = {
      send: vi.fn().mockResolvedValue(undefined), // Must return Promise
    };
    useCase = new CreateAlertUseCase(mockAlertRepository, mockNotificationGateway);
  });

  it('should create alert with calculated severity', async () => {
    vi.mocked(mockAlertRepository.findByDeduplicationKey).mockResolvedValue(null);

    const result = await useCase.execute({
      aiSystemId: 'system-123',
      healthSystemId: 'health-456',
      type: 'phi_exposure',
      message: 'PHI detected in logs',
    });

    expect(result.severity).toBe('critical');
    expect(result.isDuplicate).toBe(false);
    expect(mockAlertRepository.save).toHaveBeenCalled();
  });

  it('should detect and skip duplicates', async () => {
    const existingAlert = Alert.create({
      aiSystemId: 'system-123',
      healthSystemId: 'health-456',
      type: 'model_drift',
      severity: 'medium',
      message: 'Model drift detected',
    });
    existingAlert._setId('existing-alert-id');

    vi.mocked(mockAlertRepository.findByDeduplicationKey).mockResolvedValue(existingAlert);

    const result = await useCase.execute({
      aiSystemId: 'system-123',
      healthSystemId: 'health-456',
      type: 'model_drift',
      message: 'Model drift detected',
    });

    expect(result.isDuplicate).toBe(true);
    expect(result.alertId).toBe('existing-alert-id');
    expect(mockAlertRepository.save).not.toHaveBeenCalled();
  });

  it('should route notifications correctly', async () => {
    vi.mocked(mockAlertRepository.findByDeduplicationKey).mockResolvedValue(null);

    const result = await useCase.execute({
      aiSystemId: 'system-123',
      healthSystemId: 'health-456',
      type: 'phi_exposure',
      message: 'PHI detected',
    });

    expect(result.notificationChannels).toContain('email');
    expect(result.notificationChannels).toContain('sms');
    expect(result.notificationChannels).toContain('slack');
  });
});

describe('ResolveAlertUseCase', () => {
  let mockAlertRepository: ResolveAlertRepository;
  let mockAuditLogger: AuditLogger;
  let useCase: ResolveAlertUseCase;

  beforeEach(() => {
    mockAlertRepository = {
      findById: vi.fn(),
      save: vi.fn(),
    };
    mockAuditLogger = {
      logAlertResolution: vi.fn(),
    };
    useCase = new ResolveAlertUseCase(mockAlertRepository, mockAuditLogger);
  });

  it('should resolve alert and log audit', async () => {
    const alert = Alert.create({
      aiSystemId: 'system-123',
      healthSystemId: 'health-456',
      type: 'model_drift',
      severity: 'medium',
      message: 'Drift detected',
    });
    alert._setId('alert-123');

    vi.mocked(mockAlertRepository.findById).mockResolvedValue(alert);

    const result = await useCase.execute({
      alertId: 'alert-123',
      userId: 'user-456',
    });

    expect(result.alertId).toBe('alert-123');
    expect(result.responseTimeSeconds).toBeGreaterThanOrEqual(0);
    expect(mockAlertRepository.save).toHaveBeenCalled();
    expect(mockAuditLogger.logAlertResolution).toHaveBeenCalledWith(
      'alert-123',
      'user-456',
      expect.any(Number)
    );
  });

  it('should throw error if alert not found', async () => {
    vi.mocked(mockAlertRepository.findById).mockResolvedValue(null);

    await expect(
      useCase.execute({
        alertId: 'non-existent',
        userId: 'user-123',
      })
    ).rejects.toThrow('Alert not found: non-existent');
  });

  it('should detect SLA breaches', async () => {
    const oldAlert = Alert.fromPersistence({
      id: 'alert-123',
      aiSystemId: 'system-123',
      healthSystemId: 'health-456',
      type: 'phi_exposure',
      severity: 'critical',
      message: 'PHI detected',
      status: 'active',
      createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    });

    vi.mocked(mockAlertRepository.findById).mockResolvedValue(oldAlert);

    const result = await useCase.execute({
      alertId: 'alert-123',
      userId: 'user-123',
    });

    expect(result.exceededSLA).toBe(true); // Critical SLA is 2 minutes
  });
});

describe('AcknowledgeAlertUseCase', () => {
  let mockAlertRepository: AckAlertRepository;
  let useCase: AcknowledgeAlertUseCase;

  beforeEach(() => {
    mockAlertRepository = {
      findById: vi.fn(),
      save: vi.fn(),
    };
    useCase = new AcknowledgeAlertUseCase(mockAlertRepository);
  });

  it('should acknowledge alert', async () => {
    const alert = Alert.create({
      aiSystemId: 'system-123',
      healthSystemId: 'health-456',
      type: 'error_spike',
      severity: 'high',
      message: 'Error rate increased',
    });
    alert._setId('alert-123');

    vi.mocked(mockAlertRepository.findById).mockResolvedValue(alert);

    const result = await useCase.execute({
      alertId: 'alert-123',
      userId: 'user-456',
    });

    expect(result.alertId).toBe('alert-123');
    expect(result.acknowledgedBy).toBe('user-456');
    expect(result.acknowledgedAt).toBeInstanceOf(Date);
    expect(mockAlertRepository.save).toHaveBeenCalled();
  });

  it('should throw error if alert not found', async () => {
    vi.mocked(mockAlertRepository.findById).mockResolvedValue(null);

    await expect(
      useCase.execute({
        alertId: 'non-existent',
        userId: 'user-123',
      })
    ).rejects.toThrow('Alert not found: non-existent');
  });
});
