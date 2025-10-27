/**
 * DOMAIN TESTS: RateLimitPolicy Entity
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimitPolicy } from '../../../server/domain/entities/RateLimitPolicy';

describe('RateLimitPolicy Domain Entity', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should create free tier policy with correct quotas', () => {
    const policy = RateLimitPolicy.create({
      tier: 'free',
      healthSystemId: 'hs-123',
    });

    expect(policy.tier).toBe('free');
    expect(policy.quotas.length).toBe(2);
    expect(policy.quotas.find(q => q.window === '1hour')?.maxRequests).toBe(100);
  });

  it('should allow requests within quota', () => {
    const policy = RateLimitPolicy.create({
      tier: 'free',
      healthSystemId: 'hs-123',
    });

    expect(policy.checkRequest()).toBe('allow');
    policy.recordRequest();
    expect(policy.checkRequest()).toBe('allow');
  });

  it('should throttle when approaching limit', () => {
    const policy = RateLimitPolicy.create({
      tier: 'free',
      healthSystemId: 'hs-123',
    });

    const hourQuota = policy.quotas.find(q => q.window === '1hour')!;
    for (let i = 0; i < 91; i++) {
      policy.recordRequest();
    }

    expect(policy.checkRequest()).toBe('throttle');
  });

  it('should block when quota exceeded', () => {
    const policy = RateLimitPolicy.create({
      tier: 'free',
      healthSystemId: 'hs-123',
    });

    for (let i = 0; i < 101; i++) {
      policy.recordRequest();
    }

    expect(policy.checkRequest()).toBe('block');
  });

  it('should reset quota after window expires', () => {
    const policy = RateLimitPolicy.create({
      tier: 'free',
      healthSystemId: 'hs-123',
    });

    for (let i = 0; i < 101; i++) {
      policy.recordRequest();
    }
    expect(policy.checkRequest()).toBe('block');

    vi.advanceTimersByTime(61 * 60 * 1000); // Advance 61 minutes

    expect(policy.checkRequest()).toBe('allow');
  });

  it('should record violations', () => {
    const policy = RateLimitPolicy.create({
      tier: 'free',
      healthSystemId: 'hs-123',
    });

    policy.recordViolation();
    expect(policy.violationCount).toBe(1);
    expect(policy.isActive).toBe(true);
  });

  it('should block after three violations', () => {
    const policy = RateLimitPolicy.create({
      tier: 'free',
      healthSystemId: 'hs-123',
    });

    policy.recordViolation();
    policy.recordViolation();
    policy.recordViolation();

    expect(policy.isActive).toBe(false);
  });

  it('should auto-unblock after 1 hour', () => {
    const policy = RateLimitPolicy.create({
      tier: 'free',
      healthSystemId: 'hs-123',
    });

    policy.recordViolation();
    policy.recordViolation();
    policy.recordViolation();
    expect(policy.isActive).toBe(false);

    vi.advanceTimersByTime(61 * 60 * 1000); // Advance 61 minutes

    expect(policy.shouldAutoUnblock()).toBe(true);
  });

  it('should upgrade tier', () => {
    const policy = RateLimitPolicy.create({
      tier: 'free',
      healthSystemId: 'hs-123',
    });

    policy.upgradeTier('professional');
    expect(policy.tier).toBe('professional');
    expect(policy.quotas.find(q => q.window === '1hour')?.maxRequests).toBe(10000);
  });

  it('should reject tier downgrade', () => {
    const policy = RateLimitPolicy.create({
      tier: 'professional',
      healthSystemId: 'hs-123',
    });

    expect(() => policy.upgradeTier('free')).toThrow('Can only upgrade to a higher tier');
  });
});
