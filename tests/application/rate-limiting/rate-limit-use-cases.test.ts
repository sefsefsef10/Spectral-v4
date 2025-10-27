/**
 * APPLICATION LAYER TESTS: Rate Limiting Use Cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CheckRateLimitUseCase, type RateLimitRepository as CheckRateLimitRepository } from '../../../server/application/rate-limiting/CheckRateLimitUseCase';
import { UpgradeTierUseCase, type RateLimitRepository as UpgradeTierRepository } from '../../../server/application/rate-limiting/UpgradeTierUseCase';
import { RateLimitPolicy } from '../../../server/domain/entities/RateLimitPolicy';

describe('CheckRateLimitUseCase', () => {
  let mockRepository: CheckRateLimitRepository;
  let useCase: CheckRateLimitUseCase;

  beforeEach(() => {
    mockRepository = {
      findByHealthSystemId: vi.fn(),
      save: vi.fn(),
    };
    useCase = new CheckRateLimitUseCase(mockRepository);
  });

  it('should allow request within quota', async () => {
    const policy = RateLimitPolicy.create({
      tier: 'free',
      healthSystemId: 'hs-123',
    });
    policy._setId('policy-123');

    vi.mocked(mockRepository.findByHealthSystemId).mockResolvedValue(policy);

    const result = await useCase.execute({ healthSystemId: 'hs-123' });

    expect(result.action).toBe('allow');
    expect(result.tier).toBe('free');
    expect(mockRepository.save).toHaveBeenCalled();
  });

  it('should create policy if not exists', async () => {
    vi.mocked(mockRepository.findByHealthSystemId).mockResolvedValue(null);

    const result = await useCase.execute({ healthSystemId: 'hs-456' });

    expect(result.action).toBe('allow');
    expect(result.tier).toBe('free');
    expect(mockRepository.save).toHaveBeenCalled();
  });

  it('should record violation on block', async () => {
    const policy = RateLimitPolicy.create({
      tier: 'free',
      healthSystemId: 'hs-123',
    });
    policy._setId('policy-123');

    for (let i = 0; i < 101; i++) {
      policy.recordRequest();
    }

    vi.mocked(mockRepository.findByHealthSystemId).mockResolvedValue(policy);

    const result = await useCase.execute({ healthSystemId: 'hs-123' });

    expect(result.action).toBe('block');
    expect(mockRepository.save).toHaveBeenCalled();
  });
});

describe('UpgradeTierUseCase', () => {
  let mockRepository: UpgradeTierRepository;
  let useCase: UpgradeTierUseCase;

  beforeEach(() => {
    mockRepository = {
      findByHealthSystemId: vi.fn(),
      save: vi.fn(),
    };
    useCase = new UpgradeTierUseCase(mockRepository);
  });

  it('should upgrade tier successfully', async () => {
    const policy = RateLimitPolicy.create({
      tier: 'free',
      healthSystemId: 'hs-123',
    });
    policy._setId('policy-123');

    vi.mocked(mockRepository.findByHealthSystemId).mockResolvedValue(policy);

    const result = await useCase.execute({
      healthSystemId: 'hs-123',
      newTier: 'professional',
    });

    expect(result.newTier).toBe('professional');
    expect(mockRepository.save).toHaveBeenCalledWith(policy);
  });

  it('should throw error if policy not found', async () => {
    vi.mocked(mockRepository.findByHealthSystemId).mockResolvedValue(null);

    await expect(useCase.execute({
      healthSystemId: 'hs-999',
      newTier: 'basic',
    })).rejects.toThrow('Rate limit policy not found');
  });
});
