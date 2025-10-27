/**
 * DOMAIN TESTS: Deployment Entity
 */

import { describe, it, expect } from 'vitest';
import { Deployment } from '../../../server/domain/entities/Deployment';

describe('Deployment Domain Entity', () => {
  const validProps = {
    aiSystemId: 'ai-123',
    version: 'v1.2.3',
    strategy: 'rolling' as const,
    healthChecks: [
      { endpoint: '/health', expectedStatus: 200, timeout: 5000 },
    ],
    rollbackPolicy: {
      autoRollback: true,
      errorThreshold: 5,
      healthCheckFailures: 3,
      timeWindow: 10,
    },
    createdBy: 'user-456',
  };

  it('should create valid deployment', () => {
    const deployment = Deployment.create(validProps);
    expect(deployment.status).toBe('pending');
    expect(deployment.errorRate).toBe(0);
  });

  it('should reject deployment without health checks', () => {
    expect(() => Deployment.create({ ...validProps, healthChecks: [] })).toThrow('At least one health check is required');
  });

  it('should start deployment', () => {
    const deployment = Deployment.create(validProps);
    deployment.start();
    expect(deployment.status).toBe('in_progress');
    expect(deployment.deployedAt).toBeInstanceOf(Date);
  });

  it('should mark deployment as healthy', () => {
    const deployment = Deployment.create(validProps);
    deployment.start();
    deployment.markHealthy();
    expect(deployment.status).toBe('healthy');
    expect(deployment.completedAt).toBeInstanceOf(Date);
  });

  it('should record health check results', () => {
    const deployment = Deployment.create(validProps);
    deployment.recordHealthCheckResult('/health', true);
    expect(deployment.consecutiveHealthCheckFailures).toBe(0);
    expect(deployment.areAllHealthChecksPassing()).toBe(true);
  });

  it('should track consecutive health check failures', () => {
    const deployment = Deployment.create(validProps);
    deployment.recordHealthCheckResult('/health', false, 'Timeout');
    deployment.recordHealthCheckResult('/health', false, 'Timeout');
    deployment.recordHealthCheckResult('/health', false, 'Timeout');
    expect(deployment.consecutiveHealthCheckFailures).toBe(3);
  });

  it('should trigger auto-rollback on error threshold', () => {
    const deployment = Deployment.create(validProps);
    deployment.start();
    deployment.updateErrorRate(6);
    expect(deployment.shouldTriggerAutoRollback()).toBe(true);
  });

  it('should trigger auto-rollback on health check failures', () => {
    const deployment = Deployment.create(validProps);
    deployment.start();
    deployment.recordHealthCheckResult('/health', false);
    deployment.recordHealthCheckResult('/health', false);
    deployment.recordHealthCheckResult('/health', false);
    expect(deployment.shouldTriggerAutoRollback()).toBe(true);
  });

  it('should execute rollback', () => {
    const deployment = Deployment.create(validProps);
    deployment.start();
    deployment.rollback('High error rate');
    expect(deployment.status).toBe('rolled_back');
    expect(deployment.rollbackReason).toBe('High error rate');
  });

  it('should increase canary percentage', () => {
    const deployment = Deployment.create({
      ...validProps,
      strategy: 'canary',
      canaryPercentage: 10,
    });
    deployment.start();
    deployment.increaseCanaryPercentage();
    expect(deployment.canaryPercentage).toBe(20);
  });

  it('should mark canary healthy at 100%', () => {
    const deployment = Deployment.create({
      ...validProps,
      strategy: 'canary',
      canaryPercentage: 90,
    });
    deployment.start();
    deployment.increaseCanaryPercentage();
    expect(deployment.canaryPercentage).toBe(100);
    expect(deployment.status).toBe('healthy');
  });

  it('should check if canary ready for increment', () => {
    const startTime = new Date('2025-01-01T00:00:00Z');
    const deployment = Deployment.fromPersistence({
      id: 'deploy-123',
      aiSystemId: 'ai-123',
      version: 'v1.0.0',
      strategy: 'canary',
      status: 'in_progress',
      canaryPercentage: 10,
      healthChecks: [{ endpoint: '/health', expectedStatus: 200, timeout: 5000 }],
      rollbackPolicy: { autoRollback: true, errorThreshold: 5, healthCheckFailures: 3, timeWindow: 10 },
      deployedAt: startTime,
      createdAt: startTime,
      createdBy: 'user-456',
    });

    expect(deployment.isCanaryReadyForIncrement(startTime)).toBe(false);

    const sixMinutesLater = new Date('2025-01-01T00:06:00Z');
    expect(deployment.isCanaryReadyForIncrement(sixMinutesLater)).toBe(true);
  });
});
