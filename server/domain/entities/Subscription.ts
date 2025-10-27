/**
 * Subscription Domain Entity
 * 
 * Represents a subscription to the Spectral platform with business rules
 * for tier limits, usage validation, and billing cycles.
 */

export enum SubscriptionTier {
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  TRIALING = 'trialing',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  INCOMPLETE = 'incomplete',
}

export interface SubscriptionLimits {
  aiSystems: number;
}

export interface SubscriptionPricing {
  amount: number; // Annual price in cents
  name: string;
  limits: SubscriptionLimits;
}

export class Subscription {
  private constructor(
    private readonly _id: string,
    private readonly _healthSystemId: string,
    private _tier: SubscriptionTier,
    private _status: SubscriptionStatus,
    private _stripeSubscriptionId: string | null,
    private _currentPeriodStart: Date,
    private _currentPeriodEnd: Date,
    private _trialEndsAt: Date | null,
    private readonly _createdAt: Date
  ) {}

  /**
   * Create new subscription (typically in trial)
   */
  static create(
    id: string,
    healthSystemId: string,
    tier: SubscriptionTier
  ): Subscription {
    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + 30); // 30-day trial

    const periodEnd = new Date(now);
    periodEnd.setFullYear(periodEnd.getFullYear() + 1); // Annual billing

    return new Subscription(
      id,
      healthSystemId,
      tier,
      SubscriptionStatus.TRIALING,
      null,
      now,
      periodEnd,
      trialEndsAt,
      now
    );
  }

  /**
   * Reconstitute from database
   */
  static reconstitute(
    id: string,
    healthSystemId: string,
    tier: SubscriptionTier,
    status: SubscriptionStatus,
    stripeSubscriptionId: string | null,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    trialEndsAt: Date | null,
    createdAt: Date
  ): Subscription {
    return new Subscription(
      id,
      healthSystemId,
      tier,
      status,
      stripeSubscriptionId,
      currentPeriodStart,
      currentPeriodEnd,
      trialEndsAt,
      createdAt
    );
  }

  /**
   * Business Rules: Get tier-specific limits
   */
  getTierLimits(): SubscriptionLimits {
    const limitsMap: Record<SubscriptionTier, SubscriptionLimits> = {
      [SubscriptionTier.STARTER]: { aiSystems: 3 },
      [SubscriptionTier.PROFESSIONAL]: { aiSystems: 10 },
      [SubscriptionTier.ENTERPRISE]: { aiSystems: 999999 }, // Unlimited
    };

    return limitsMap[this._tier];
  }

  /**
   * Business Rules: Get tier pricing
   */
  static getTierPricing(tier: SubscriptionTier): SubscriptionPricing {
    const pricingMap: Record<SubscriptionTier, SubscriptionPricing> = {
      [SubscriptionTier.STARTER]: {
        amount: 7500000, // $75,000 in cents
        name: 'Starter',
        limits: { aiSystems: 3 },
      },
      [SubscriptionTier.PROFESSIONAL]: {
        amount: 20000000, // $200,000 in cents
        name: 'Professional',
        limits: { aiSystems: 10 },
      },
      [SubscriptionTier.ENTERPRISE]: {
        amount: 40000000, // $400,000 in cents
        name: 'Enterprise',
        limits: { aiSystems: 999999 },
      },
    };

    return pricingMap[tier];
  }

  /**
   * Business Rules: Check if can add AI system based on tier limits
   */
  canAddAISystem(currentAISystemCount: number): {
    allowed: boolean;
    reason?: string;
  } {
    const limits = this.getTierLimits();

    if (currentAISystemCount >= limits.aiSystems) {
      return {
        allowed: false,
        reason: `You've reached your plan limit of ${limits.aiSystems} AI systems. Please upgrade to add more.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Business Rules: Check if subscription is active (can use features)
   */
  isActive(): boolean {
    return (
      this._status === SubscriptionStatus.ACTIVE ||
      this._status === SubscriptionStatus.TRIALING
    );
  }

  /**
   * Business Rules: Check if trial has expired
   */
  isTrialExpired(): boolean {
    if (!this._trialEndsAt) return false;
    return new Date() > this._trialEndsAt;
  }

  /**
   * Business Rules: Check if subscription needs payment
   */
  requiresPayment(): boolean {
    return this._status === SubscriptionStatus.PAST_DUE || 
           this._status === SubscriptionStatus.INCOMPLETE;
  }

  /**
   * Business Rules: Set Stripe subscription ID (when subscription is created)
   */
  setStripeSubscriptionId(stripeSubscriptionId: string): void {
    this._stripeSubscriptionId = stripeSubscriptionId;
  }

  /**
   * Business Rules: Activate subscription (after payment - called from webhook)
   */
  activate(): void {
    if (this._status === SubscriptionStatus.CANCELED) {
      throw new Error('Cannot activate a canceled subscription');
    }

    this._status = SubscriptionStatus.ACTIVE;
    this._trialEndsAt = null; // Clear trial when activated
  }

  /**
   * Business Rules: Update status from Stripe webhook
   */
  updateStatus(newStatus: SubscriptionStatus): void {
    this._status = newStatus;
  }

  /**
   * Business Rules: Update billing period from Stripe webhook
   */
  updateBillingPeriod(periodStart: Date, periodEnd: Date): void {
    this._currentPeriodStart = periodStart;
    this._currentPeriodEnd = periodEnd;
  }

  /**
   * Business Rules: Upgrade to higher tier
   */
  upgradeTo(newTier: SubscriptionTier): void {
    const tierOrder = {
      [SubscriptionTier.STARTER]: 1,
      [SubscriptionTier.PROFESSIONAL]: 2,
      [SubscriptionTier.ENTERPRISE]: 3,
    };

    if (tierOrder[newTier] <= tierOrder[this._tier]) {
      throw new Error(`Cannot upgrade from ${this._tier} to ${newTier}`);
    }

    this._tier = newTier;
  }

  /**
   * Business Rules: Downgrade to lower tier
   */
  downgradeTo(newTier: SubscriptionTier, currentAISystemCount: number): void {
    const tierOrder = {
      [SubscriptionTier.STARTER]: 1,
      [SubscriptionTier.PROFESSIONAL]: 2,
      [SubscriptionTier.ENTERPRISE]: 3,
    };

    if (tierOrder[newTier] >= tierOrder[this._tier]) {
      throw new Error(`Cannot downgrade from ${this._tier} to ${newTier}`);
    }

    // Business rule: Cannot downgrade if current usage exceeds new tier limits
    const newLimits = Subscription.getTierPricing(newTier).limits;
    if (currentAISystemCount > newLimits.aiSystems) {
      throw new Error(
        `Cannot downgrade to ${newTier}: current AI system count (${currentAISystemCount}) exceeds tier limit (${newLimits.aiSystems})`
      );
    }

    this._tier = newTier;
  }

  /**
   * Business Rules: Cancel subscription
   */
  cancel(): void {
    this._status = SubscriptionStatus.CANCELED;
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get healthSystemId(): string {
    return this._healthSystemId;
  }

  get tier(): SubscriptionTier {
    return this._tier;
  }

  get status(): SubscriptionStatus {
    return this._status;
  }

  get stripeSubscriptionId(): string | null {
    return this._stripeSubscriptionId;
  }

  get currentPeriodStart(): Date {
    return this._currentPeriodStart;
  }

  get currentPeriodEnd(): Date {
    return this._currentPeriodEnd;
  }

  get trialEndsAt(): Date | null {
    return this._trialEndsAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }
}
