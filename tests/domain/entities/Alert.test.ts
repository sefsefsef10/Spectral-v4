/**
 * DOMAIN TESTS: Alert Entity
 * 
 * Tests PURE business logic with NO external dependencies.
 * Validates business rules for alert management, severity, routing, and lifecycle.
 */

import { describe, it, expect } from 'vitest';
import { Alert, type AlertType, type AlertSeverity } from '../../../server/domain/entities/Alert';

describe('Alert Domain Entity', () => {
  const validProps = {
    aiSystemId: 'ai-system-123',
    healthSystemId: 'health-system-456',
    type: 'compliance_violation' as AlertType,
    severity: 'high' as AlertSeverity,
    message: 'HIPAA violation detected in model output',
  };

  describe('Alert Creation', () => {
    it('should create valid alert', () => {
      const alert = Alert.create(validProps);

      expect(alert.aiSystemId).toBe('ai-system-123');
      expect(alert.healthSystemId).toBe('health-system-456');
      expect(alert.type).toBe('compliance_violation');
      expect(alert.severity).toBe('high');
      expect(alert.message).toBe('HIPAA violation detected in model output');
      expect(alert.status).toBe('active');
      expect(alert.createdAt).toBeInstanceOf(Date);
      expect(alert.id).toBeUndefined(); // Not persisted yet
    });

    it('should reject empty AI system ID', () => {
      expect(() => {
        Alert.create({ ...validProps, aiSystemId: '' });
      }).toThrow('AI system ID is required');
    });

    it('should reject empty health system ID', () => {
      expect(() => {
        Alert.create({ ...validProps, healthSystemId: '' });
      }).toThrow('Health system ID is required');
    });

    it('should reject empty message', () => {
      expect(() => {
        Alert.create({ ...validProps, message: '' });
      }).toThrow('Alert message is required');
    });

    it('should reject message exceeding 5000 characters', () => {
      const longMessage = 'a'.repeat(5001);
      expect(() => {
        Alert.create({ ...validProps, message: longMessage });
      }).toThrow('Alert message must not exceed 5000 characters');
    });

    it('should accept message exactly 5000 characters', () => {
      const maxMessage = 'a'.repeat(5000);
      const alert = Alert.create({ ...validProps, message: maxMessage });
      expect(alert.message).toHaveLength(5000);
    });

    it('should reject invalid alert type', () => {
      expect(() => {
        Alert.create({ ...validProps, type: 'invalid_type' as AlertType });
      }).toThrow('Invalid alert type: invalid_type');
    });

    it('should reject invalid severity', () => {
      expect(() => {
        Alert.create({ ...validProps, severity: 'super_critical' as AlertSeverity });
      }).toThrow('Invalid severity: super_critical');
    });

    it('should accept all valid alert types', () => {
      const types: AlertType[] = [
        'compliance_violation',
        'performance_degradation',
        'phi_exposure',
        'model_drift',
        'bias_detection',
        'error_spike',
        'latency_degradation',
        'security_breach',
        'data_quality',
      ];

      types.forEach(type => {
        const alert = Alert.create({ ...validProps, type });
        expect(alert.type).toBe(type);
      });
    });

    it('should accept all valid severities', () => {
      const severities: AlertSeverity[] = ['low', 'medium', 'high', 'critical'];

      severities.forEach(severity => {
        const alert = Alert.create({ ...validProps, severity });
        expect(alert.severity).toBe(severity);
      });
    });
  });

  describe('Alert Reconstruction', () => {
    it('should reconstruct from persistence with ID', () => {
      const alert = Alert.fromPersistence({
        id: 'alert-789',
        ...validProps,
        status: 'active',
        createdAt: new Date(),
      });

      expect(alert.id).toBe('alert-789');
      expect(alert.aiSystemId).toBe('ai-system-123');
    });

    it('should reject reconstruction without ID', () => {
      expect(() => {
        Alert.fromPersistence({
          ...validProps,
          status: 'active',
          createdAt: new Date(),
        });
      }).toThrow('Alert ID is required when reconstructing from persistence');
    });
  });

  describe('Severity Calculation', () => {
    it('should calculate PHI exposure as critical', () => {
      const severity = Alert.calculateSeverity('phi_exposure');
      expect(severity).toBe('critical');
    });

    it('should calculate security breach as critical', () => {
      const severity = Alert.calculateSeverity('security_breach');
      expect(severity).toBe('critical');
    });

    it('should calculate HIPAA compliance violation as critical', () => {
      const severity = Alert.calculateSeverity('compliance_violation', {
        controlId: 'HIPAA-164.312',
      });
      expect(severity).toBe('critical');
    });

    it('should calculate non-HIPAA compliance violation as high', () => {
      const severity = Alert.calculateSeverity('compliance_violation', {
        controlId: 'NIST-AI-RMF-1.1',
      });
      expect(severity).toBe('high');
    });

    it('should calculate bias detection as high', () => {
      const severity = Alert.calculateSeverity('bias_detection');
      expect(severity).toBe('high');
    });

    it('should calculate severe performance degradation as high', () => {
      const severity = Alert.calculateSeverity('performance_degradation', {
        percentDegraded: 60,
      });
      expect(severity).toBe('high');
    });

    it('should calculate moderate performance degradation as medium', () => {
      const severity = Alert.calculateSeverity('performance_degradation', {
        percentDegraded: 30,
      });
      expect(severity).toBe('medium');
    });

    it('should calculate high error rate as high', () => {
      const severity = Alert.calculateSeverity('error_spike', {
        errorRate: 0.15, // 15%
      });
      expect(severity).toBe('high');
    });

    it('should calculate moderate error rate as medium', () => {
      const severity = Alert.calculateSeverity('error_spike', {
        errorRate: 0.05, // 5%
      });
      expect(severity).toBe('medium');
    });

    it('should calculate high drift score as high', () => {
      const severity = Alert.calculateSeverity('model_drift', {
        driftScore: 0.8,
      });
      expect(severity).toBe('high');
    });

    it('should calculate moderate drift score as medium', () => {
      const severity = Alert.calculateSeverity('model_drift', {
        driftScore: 0.5,
      });
      expect(severity).toBe('medium');
    });

    it('should calculate data quality issues as medium by default', () => {
      const severity = Alert.calculateSeverity('data_quality');
      expect(severity).toBe('medium');
    });
  });

  describe('Notification Routing', () => {
    it('should route critical alerts to all channels', () => {
      const alert = Alert.create({ ...validProps, severity: 'critical' });
      const channels = alert.getNotificationChannels();

      expect(channels).toContain('email');
      expect(channels).toContain('sms');
      expect(channels).toContain('slack');
      expect(channels).toContain('pagerduty');
      expect(channels).toContain('dashboard');
      expect(channels).toHaveLength(5);
    });

    it('should route high alerts to email, slack, pagerduty, dashboard', () => {
      const alert = Alert.create({ ...validProps, severity: 'high' });
      const channels = alert.getNotificationChannels();

      expect(channels).toContain('email');
      expect(channels).toContain('slack');
      expect(channels).toContain('pagerduty');
      expect(channels).toContain('dashboard');
      expect(channels).not.toContain('sms');
      expect(channels).toHaveLength(4);
    });

    it('should route medium alerts to email, slack, dashboard', () => {
      const alert = Alert.create({ ...validProps, severity: 'medium' });
      const channels = alert.getNotificationChannels();

      expect(channels).toContain('email');
      expect(channels).toContain('slack');
      expect(channels).toContain('dashboard');
      expect(channels).not.toContain('sms');
      expect(channels).not.toContain('pagerduty');
      expect(channels).toHaveLength(3);
    });

    it('should route low alerts to email and dashboard only', () => {
      const alert = Alert.create({ ...validProps, severity: 'low' });
      const channels = alert.getNotificationChannels();

      expect(channels).toContain('email');
      expect(channels).toContain('dashboard');
      expect(channels).not.toContain('sms');
      expect(channels).not.toContain('slack');
      expect(channels).not.toContain('pagerduty');
      expect(channels).toHaveLength(2);
    });

    it('should always include dashboard channel', () => {
      const severities: AlertSeverity[] = ['low', 'medium', 'high', 'critical'];
      
      severities.forEach(severity => {
        const alert = Alert.create({ ...validProps, severity });
        const channels = alert.getNotificationChannels();
        expect(channels).toContain('dashboard');
      });
    });
  });

  describe('Escalation Logic', () => {
    it('should require immediate escalation for critical PHI exposure', () => {
      const alert = Alert.create({
        ...validProps,
        type: 'phi_exposure',
        severity: 'critical',
      });

      expect(alert.requiresImmediateEscalation()).toBe(true);
    });

    it('should require immediate escalation for critical security breach', () => {
      const alert = Alert.create({
        ...validProps,
        type: 'security_breach',
        severity: 'critical',
      });

      expect(alert.requiresImmediateEscalation()).toBe(true);
    });

    it('should not require immediate escalation for non-critical alerts', () => {
      const alert = Alert.create({
        ...validProps,
        type: 'model_drift',
        severity: 'high',
      });

      expect(alert.requiresImmediateEscalation()).toBe(false);
    });

    it('should escalate PHI exposure to CISO', () => {
      const alert = Alert.create({
        ...validProps,
        type: 'phi_exposure',
        severity: 'critical',
      });

      expect(alert.getEscalationTier()).toBe('ciso');
    });

    it('should escalate security breach to CISO', () => {
      const alert = Alert.create({
        ...validProps,
        type: 'security_breach',
        severity: 'critical',
      });

      expect(alert.getEscalationTier()).toBe('ciso');
    });

    it('should escalate critical alerts to CISO', () => {
      const alert = Alert.create({
        ...validProps,
        type: 'compliance_violation',
        severity: 'critical',
      });

      expect(alert.getEscalationTier()).toBe('ciso');
    });

    it('should escalate high alerts to department head', () => {
      const alert = Alert.create({
        ...validProps,
        severity: 'high',
      });

      expect(alert.getEscalationTier()).toBe('department_head');
    });

    it('should escalate medium alerts to team lead', () => {
      const alert = Alert.create({
        ...validProps,
        severity: 'medium',
      });

      expect(alert.getEscalationTier()).toBe('team_lead');
    });

    it('should escalate low alerts to team lead', () => {
      const alert = Alert.create({
        ...validProps,
        severity: 'low',
      });

      expect(alert.getEscalationTier()).toBe('team_lead');
    });
  });

  describe('Alert Lifecycle', () => {
    it('should acknowledge active alert', () => {
      const alert = Alert.create(validProps);
      
      alert.acknowledge('user-123');

      expect(alert.status).toBe('acknowledged');
      expect(alert.acknowledgedAt).toBeInstanceOf(Date);
      expect(alert.acknowledgedBy).toBe('user-123');
    });

    it('should reject acknowledging resolved alert', () => {
      const alert = Alert.create(validProps);
      alert.resolve('user-123');

      expect(() => {
        alert.acknowledge('user-456');
      }).toThrow('Cannot acknowledge a resolved or dismissed alert');
    });

    it('should reject acknowledging dismissed alert', () => {
      const alert = Alert.create(validProps);
      alert.dismiss('user-123');

      expect(() => {
        alert.acknowledge('user-456');
      }).toThrow('Cannot acknowledge a resolved or dismissed alert');
    });

    it('should resolve active alert', () => {
      const alert = Alert.create(validProps);
      
      alert.resolve('user-123');

      expect(alert.status).toBe('resolved');
      expect(alert.resolvedAt).toBeInstanceOf(Date);
      expect(alert.resolvedBy).toBe('user-123');
      expect(alert.responseTimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('should resolve acknowledged alert', () => {
      const alert = Alert.create(validProps);
      alert.acknowledge('user-123');

      alert.resolve('user-456');

      expect(alert.status).toBe('resolved');
      expect(alert.resolvedBy).toBe('user-456');
    });

    it('should reject resolving dismissed alert', () => {
      const alert = Alert.create(validProps);
      alert.dismiss('user-123');

      expect(() => {
        alert.resolve('user-456');
      }).toThrow('Cannot resolve a dismissed alert');
    });

    it('should calculate response time correctly', () => {
      const alert = Alert.create(validProps);
      
      // Wait a bit before resolving
      setTimeout(() => {}, 100);
      
      alert.resolve('user-123');

      expect(alert.responseTimeSeconds).toBeDefined();
      expect(alert.responseTimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('should dismiss active alert', () => {
      const alert = Alert.create(validProps);
      
      alert.dismiss('user-123');

      expect(alert.status).toBe('dismissed');
      expect(alert.resolvedAt).toBeInstanceOf(Date);
      expect(alert.resolvedBy).toBe('user-123');
    });

    it('should reject dismissing resolved alert', () => {
      const alert = Alert.create(validProps);
      alert.resolve('user-123');

      expect(() => {
        alert.dismiss('user-456');
      }).toThrow('Cannot dismiss an already resolved alert');
    });

    it('should identify active alerts correctly', () => {
      const activeAlert = Alert.create(validProps);
      const acknowledgedAlert = Alert.create(validProps);
      const resolvedAlert = Alert.create(validProps);
      const dismissedAlert = Alert.create(validProps);

      acknowledgedAlert.acknowledge('user-123');
      resolvedAlert.resolve('user-123');
      dismissedAlert.dismiss('user-123');

      expect(activeAlert.isActive()).toBe(true);
      expect(acknowledgedAlert.isActive()).toBe(true);
      expect(resolvedAlert.isActive()).toBe(false);
      expect(dismissedAlert.isActive()).toBe(false);
    });
  });

  describe('SLA Tracking', () => {
    it('should not exceed SLA for new critical alert', () => {
      const alert = Alert.create({ ...validProps, severity: 'critical' });
      expect(alert.hasExceededSLA()).toBe(false);
    });

    it('should detect SLA breach for critical alert (>2 minutes)', () => {
      // Create alert with old timestamp
      const alert = Alert.fromPersistence({
        id: 'alert-123',
        ...validProps,
        severity: 'critical',
        status: 'active',
        createdAt: new Date(Date.now() - 3 * 60 * 1000), // 3 minutes ago
      });

      expect(alert.hasExceededSLA()).toBe(true);
    });

    it('should detect SLA breach for high alert (>15 minutes)', () => {
      const alert = Alert.fromPersistence({
        id: 'alert-123',
        ...validProps,
        severity: 'high',
        status: 'active',
        createdAt: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
      });

      expect(alert.hasExceededSLA()).toBe(true);
    });

    it('should detect SLA breach for medium alert (>1 hour)', () => {
      const alert = Alert.fromPersistence({
        id: 'alert-123',
        ...validProps,
        severity: 'medium',
        status: 'active',
        createdAt: new Date(Date.now() - 90 * 60 * 1000), // 90 minutes ago
      });

      expect(alert.hasExceededSLA()).toBe(true);
    });

    it('should detect SLA breach for low alert (>24 hours)', () => {
      const alert = Alert.fromPersistence({
        id: 'alert-123',
        ...validProps,
        severity: 'low',
        status: 'active',
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
      });

      expect(alert.hasExceededSLA()).toBe(true);
    });

    it('should not report SLA breach for resolved alerts', () => {
      const alert = Alert.fromPersistence({
        id: 'alert-123',
        ...validProps,
        severity: 'critical',
        status: 'resolved',
        createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        resolvedAt: new Date(),
        resolvedBy: 'user-123',
      });

      expect(alert.hasExceededSLA()).toBe(false);
    });
  });

  describe('Deduplication', () => {
    it('should generate consistent deduplication key', () => {
      const alert1 = Alert.create(validProps);
      const alert2 = Alert.create(validProps);

      expect(alert1.getDeduplicationKey()).toBe(alert2.getDeduplicationKey());
    });

    it('should normalize numbers in deduplication key', () => {
      const alert1 = Alert.create({
        ...validProps,
        message: 'Error rate: 0.15 detected',
      });
      const alert2 = Alert.create({
        ...validProps,
        message: 'Error rate: 0.20 detected',
      });

      expect(alert1.getDeduplicationKey()).toBe(alert2.getDeduplicationKey());
    });

    it('should normalize whitespace in deduplication key', () => {
      const alert1 = Alert.create({
        ...validProps,
        message: 'PHI   exposure   detected',
      });
      const alert2 = Alert.create({
        ...validProps,
        message: 'PHI exposure detected',
      });

      expect(alert1.getDeduplicationKey()).toBe(alert2.getDeduplicationKey());
    });

    it('should identify duplicates within 1 hour', () => {
      const alert1 = Alert.fromPersistence({
        id: 'alert-1',
        ...validProps,
        status: 'active',
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      });
      const alert2 = Alert.create(validProps);

      expect(alert2.isDuplicateOf(alert1)).toBe(true);
    });

    it('should not identify duplicates beyond 1 hour', () => {
      const alert1 = Alert.fromPersistence({
        id: 'alert-1',
        ...validProps,
        status: 'active',
        createdAt: new Date(Date.now() - 90 * 60 * 1000), // 90 minutes ago
      });
      const alert2 = Alert.create(validProps);

      expect(alert2.isDuplicateOf(alert1)).toBe(false);
    });

    it('should not identify different types as duplicates', () => {
      const alert1 = Alert.create({ ...validProps, type: 'phi_exposure' });
      const alert2 = Alert.create({ ...validProps, type: 'model_drift' });

      expect(alert2.isDuplicateOf(alert1)).toBe(false);
    });

    it('should not identify different systems as duplicates', () => {
      const alert1 = Alert.create({ ...validProps, aiSystemId: 'system-1' });
      const alert2 = Alert.create({ ...validProps, aiSystemId: 'system-2' });

      expect(alert2.isDuplicateOf(alert1)).toBe(false);
    });
  });

  describe('Metadata Management', () => {
    it('should add metadata', () => {
      const alert = Alert.create(validProps);
      
      alert.addMetadata('controlId', 'HIPAA-164.312');
      alert.addMetadata('impactScore', 0.85);

      expect(alert.metadata).toEqual({
        controlId: 'HIPAA-164.312',
        impactScore: 0.85,
      });
    });

    it('should support complex metadata', () => {
      const alert = Alert.create(validProps);
      
      alert.addMetadata('details', {
        framework: 'HIPAA',
        control: '164.312',
        subsection: 'a',
        requirements: ['encryption', 'audit_controls'],
      });

      expect(alert.metadata?.details).toBeDefined();
      expect((alert.metadata?.details as any).framework).toBe('HIPAA');
    });

    it('should get formatted summary', () => {
      const criticalAlert = Alert.create({ ...validProps, severity: 'critical' });
      const highAlert = Alert.create({ ...validProps, severity: 'high' });
      const mediumAlert = Alert.create({ ...validProps, severity: 'medium' });
      const lowAlert = Alert.create({ ...validProps, severity: 'low' });

      expect(criticalAlert.getFormattedSummary()).toContain('🔴');
      expect(criticalAlert.getFormattedSummary()).toContain('CRITICAL');
      expect(highAlert.getFormattedSummary()).toContain('🟠');
      expect(mediumAlert.getFormattedSummary()).toContain('🟡');
      expect(lowAlert.getFormattedSummary()).toContain('🟢');
    });
  });

  describe('ID Management', () => {
    it('should allow setting ID once', () => {
      const alert = Alert.create(validProps);
      
      alert._setId('alert-123');

      expect(alert.id).toBe('alert-123');
    });

    it('should reject setting ID twice', () => {
      const alert = Alert.create(validProps);
      alert._setId('alert-123');

      expect(() => {
        alert._setId('alert-456');
      }).toThrow('Cannot set ID on an alert that already has one');
    });
  });

  describe('Snapshot', () => {
    it('should create immutable snapshot', () => {
      const alert = Alert.create(validProps);
      alert._setId('alert-123');
      alert.addMetadata('test', 'value');

      const snapshot = alert.toSnapshot();

      expect(snapshot.id).toBe('alert-123');
      expect(snapshot.aiSystemId).toBe('ai-system-123');
      expect(snapshot.metadata).toEqual({ test: 'value' });

      // Snapshot should be frozen
      expect(Object.isFrozen(snapshot)).toBe(true);
    });

    it('should create deep copy of metadata in snapshot', () => {
      const alert = Alert.create(validProps);
      alert.addMetadata('nested', { value: 'original' });

      const snapshot = alert.toSnapshot();
      
      // Modify original alert's metadata
      alert.addMetadata('nested', { value: 'modified' });

      // Snapshot should still have original value
      expect((snapshot.metadata?.nested as any).value).toBe('original');
    });
  });
});
