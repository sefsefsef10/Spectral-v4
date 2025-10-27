/**
 * DOMAIN ENTITY: RateLimitPolicy
 * 
 * Encapsulates business logic for API rate limiting, quota management, and throttling.
 * Handles request tracking, violation detection, and quota enforcement.
 * 
 * Clean Architecture: This entity contains PURE business logic with NO external dependencies.
 */

export type RateLimitTier = 'free' | 'basic' | 'professional' | 'enterprise';

export type RateLimitWindow = '1min' | '1hour' | '1day' | '1month';

export type RateLimitAction = 'allow' | 'throttle' | 'block';

export interface RateLimitQuota {
  window: RateLimitWindow;
  maxRequests: number;
  currentRequests: number;
  windowStartAt: Date;
}

export interface RateLimitPolicyProps {
  id?: string;
  tier: RateLimitTier;
  healthSystemId: string;
  quotas: RateLimitQuota[];
  burstAllowance?: number; // Allow burst traffic up to this multiplier (e.g., 1.5x)
  isActive: boolean;
  violationCount?: number;
  lastViolationAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * RateLimitPolicy Domain Entity
 * 
 * Business Rules:
 * 1. Free tier: 100 req/hour, 1000 req/day
 * 2. Basic tier: 1000 req/hour, 10000 req/day
 * 3. Professional tier: 10000 req/hour, 100000 req/day
 * 4. Enterprise tier: Unlimited (soft limit 1M req/day for abuse detection)
 * 5. Three consecutive violations result in 1-hour block
 * 6. Burst allowance permits 1.5x rate for short periods
 */
export class RateLimitPolicy {
  private constructor(private props: RateLimitPolicyProps) {}

  // ============================================================
  // FACTORY METHODS
  // ============================================================

  /**
   * Create a new RateLimitPolicy with tier-based defaults
   */
  static create(
    props: Omit<RateLimitPolicyProps, 'id' | 'quotas' | 'isActive' | 'createdAt' | 'violationCount'>
  ): RateLimitPolicy {
    if (!props.healthSystemId?.trim()) {
      throw new Error('Health system ID is required');
    }

    const validTiers: RateLimitTier[] = ['free', 'basic', 'professional', 'enterprise'];
    if (!validTiers.includes(props.tier)) {
      throw new Error(`Invalid tier: ${props.tier}`);
    }

    const quotas = RateLimitPolicy.getDefaultQuotasForTier(props.tier);

    return new RateLimitPolicy({
      ...props,
      quotas,
      isActive: true,
      violationCount: 0,
      createdAt: new Date(),
    });
  }

  /**
   * Reconstruct from database
   */
  static fromPersistence(props: RateLimitPolicyProps): RateLimitPolicy {
    if (!props.id) {
      throw new Error('RateLimitPolicy ID is required when reconstructing from persistence');
    }
    return new RateLimitPolicy(props);
  }

  // ============================================================
  // BUSINESS LOGIC: Tier Configuration
  // ============================================================

  /**
   * Get default quotas for a tier
   */
  private static getDefaultQuotasForTier(tier: RateLimitTier): RateLimitQuota[] {
    const now = new Date();

    switch (tier) {
      case 'free':
        return [
          { window: '1hour', maxRequests: 100, currentRequests: 0, windowStartAt: now },
          { window: '1day', maxRequests: 1000, currentRequests: 0, windowStartAt: now },
        ];
      case 'basic':
        return [
          { window: '1hour', maxRequests: 1000, currentRequests: 0, windowStartAt: now },
          { window: '1day', maxRequests: 10000, currentRequests: 0, windowStartAt: now },
        ];
      case 'professional':
        return [
          { window: '1min', maxRequests: 200, currentRequests: 0, windowStartAt: now },
          { window: '1hour', maxRequests: 10000, currentRequests: 0, windowStartAt: now },
          { window: '1day', maxRequests: 100000, currentRequests: 0, windowStartAt: now },
        ];
      case 'enterprise':
        return [
          { window: '1min', maxRequests: 5000, currentRequests: 0, windowStartAt: now },
          { window: '1hour', maxRequests: 100000, currentRequests: 0, windowStartAt: now },
          { window: '1day', maxRequests: 1000000, currentRequests: 0, windowStartAt: now },
        ];
    }
  }

  // ============================================================
  // BUSINESS LOGIC: Request Tracking
  // ============================================================

  /**
   * Check if request should be allowed
   */
  checkRequest(): RateLimitAction {
    if (!this.props.isActive) {
      return 'allow';
    }

    for (const quota of this.props.quotas) {
      this.resetQuotaIfExpired(quota);

      const effectiveLimit = this.props.burstAllowance
        ? Math.floor(quota.maxRequests * this.props.burstAllowance)
        : quota.maxRequests;

      if (quota.currentRequests >= effectiveLimit) {
        return 'block';
      }

      if (quota.currentRequests >= quota.maxRequests * 0.9) {
        return 'throttle'; // Approaching limit, warn client
      }
    }

    return 'allow';
  }

  /**
   * Record a request
   */
  recordRequest(): void {
    for (const quota of this.props.quotas) {
      this.resetQuotaIfExpired(quota);
      quota.currentRequests++;
    }
    this.props.updatedAt = new Date();
  }

  /**
   * Reset quota if window has expired
   */
  private resetQuotaIfExpired(quota: RateLimitQuota): void {
    const now = new Date();
    const windowMs = this.getWindowDurationMs(quota.window);
    const elapsed = now.getTime() - quota.windowStartAt.getTime();

    if (elapsed >= windowMs) {
      quota.currentRequests = 0;
      quota.windowStartAt = now;
    }
  }

  /**
   * Get window duration in milliseconds
   */
  private getWindowDurationMs(window: RateLimitWindow): number {
    switch (window) {
      case '1min':
        return 60 * 1000;
      case '1hour':
        return 60 * 60 * 1000;
      case '1day':
        return 24 * 60 * 60 * 1000;
      case '1month':
        return 30 * 24 * 60 * 60 * 1000;
    }
  }

  // ============================================================
  // BUSINESS LOGIC: Violation Handling
  // ============================================================

  /**
   * Record rate limit violation
   * Business Rule: Three consecutive violations result in 1-hour block
   */
  recordViolation(): void {
    this.props.violationCount = (this.props.violationCount || 0) + 1;
    this.props.lastViolationAt = new Date();
    this.props.updatedAt = new Date();

    if (this.props.violationCount >= 3) {
      this.props.isActive = false; // Block
    }
  }

  /**
   * Clear violations (after manual review or timeout)
   */
  clearViolations(): void {
    this.props.violationCount = 0;
    this.props.lastViolationAt = undefined;
    this.props.isActive = true;
    this.props.updatedAt = new Date();
  }

  /**
   * Check if policy should be automatically unblocked
   */
  shouldAutoUnblock(): boolean {
    if (this.props.isActive) {
      return false; // Not blocked
    }

    if (!this.props.lastViolationAt) {
      return true; // No violation record, unblock
    }

    const now = new Date();
    const hoursSinceViolation = (now.getTime() - this.props.lastViolationAt.getTime()) / (1000 * 60 * 60);

    return hoursSinceViolation >= 1; // Unblock after 1 hour
  }

  // ============================================================
  // BUSINESS LOGIC: Quota Management
  // ============================================================

  /**
   * Get remaining quota for a window
   */
  getRemainingQuota(window: RateLimitWindow): number {
    const quota = this.props.quotas.find(q => q.window === window);
    if (!quota) {
      return 0;
    }

    this.resetQuotaIfExpired(quota);
    return Math.max(0, quota.maxRequests - quota.currentRequests);
  }

  /**
   * Get quota usage percentage
   */
  getQuotaUsagePercent(window: RateLimitWindow): number {
    const quota = this.props.quotas.find(q => q.window === window);
    if (!quota) {
      return 0;
    }

    this.resetQuotaIfExpired(quota);
    return (quota.currentRequests / quota.maxRequests) * 100;
  }

  /**
   * Get time until quota resets
   */
  getTimeUntilReset(window: RateLimitWindow): number {
    const quota = this.props.quotas.find(q => q.window === window);
    if (!quota) {
      return 0;
    }

    const now = new Date();
    const windowMs = this.getWindowDurationMs(window);
    const elapsed = now.getTime() - quota.windowStartAt.getTime();
    return Math.max(0, windowMs - elapsed);
  }

  // ============================================================
  // BUSINESS LOGIC: Tier Management
  // ============================================================

  /**
   * Upgrade tier
   */
  upgradeTier(newTier: RateLimitTier): void {
    const tierOrder: RateLimitTier[] = ['free', 'basic', 'professional', 'enterprise'];
    const currentIndex = tierOrder.indexOf(this.props.tier);
    const newIndex = tierOrder.indexOf(newTier);

    if (newIndex <= currentIndex) {
      throw new Error('Can only upgrade to a higher tier');
    }

    this.props.tier = newTier;
    this.props.quotas = RateLimitPolicy.getDefaultQuotasForTier(newTier);
    this.props.updatedAt = new Date();
  }

  // ============================================================
  // INTERNAL ID MANAGEMENT
  // ============================================================

  _setId(id: string): void {
    if (this.props.id) {
      throw new Error('Cannot set ID on a policy that already has one');
    }
    this.props.id = id;
  }

  // ============================================================
  // GETTERS
  // ============================================================

  get id(): string | undefined {
    return this.props.id;
  }

  get tier(): RateLimitTier {
    return this.props.tier;
  }

  get healthSystemId(): string {
    return this.props.healthSystemId;
  }

  get quotas(): RateLimitQuota[] {
    return this.props.quotas;
  }

  get burstAllowance(): number | undefined {
    return this.props.burstAllowance;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get violationCount(): number | undefined {
    return this.props.violationCount;
  }

  get lastViolationAt(): Date | undefined {
    return this.props.lastViolationAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  toSnapshot(): Readonly<RateLimitPolicyProps> {
    return Object.freeze({
      ...this.props,
      quotas: this.props.quotas.map(q => ({ ...q })),
    });
  }
}
