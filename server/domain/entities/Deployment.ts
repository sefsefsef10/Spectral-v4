/**
 * DOMAIN ENTITY: Deployment
 * 
 * Encapsulates business logic for deployment management, health checks, and rollback policies.
 * Handles deployment validation, canary releases, and automated rollback triggers.
 * 
 * Clean Architecture: This entity contains PURE business logic with NO external dependencies.
 */

export type DeploymentStatus = 'pending' | 'in_progress' | 'healthy' | 'degraded' | 'failed' | 'rolled_back';

export type DeploymentStrategy = 'rolling' | 'blue_green' | 'canary';

export interface HealthCheck {
  endpoint: string;
  expectedStatus: number;
  timeout: number; // milliseconds
  lastCheckedAt?: Date;
  isHealthy?: boolean;
  errorMessage?: string;
}

export interface RollbackPolicy {
  autoRollback: boolean;
  errorThreshold: number; // Percentage of failed requests to trigger rollback
  healthCheckFailures: number; // Consecutive failures to trigger rollback
  timeWindow: number; // Minutes to monitor
}

export interface DeploymentProps {
  id?: string;
  aiSystemId: string;
  version: string;
  strategy: DeploymentStrategy;
  status: DeploymentStatus;
  healthChecks: HealthCheck[];
  rollbackPolicy: RollbackPolicy;
  canaryPercentage?: number; // For canary deployments (0-100)
  errorRate?: number; // Current error percentage
  consecutiveHealthCheckFailures?: number;
  deployedAt?: Date;
  completedAt?: Date;
  rolledBackAt?: Date;
  rollbackReason?: string;
  createdAt: Date;
  createdBy: string;
}

/**
 * Deployment Domain Entity
 * 
 * Business Rules:
 * 1. Canary deployments start at 10% traffic, increase by 10% every 5 minutes
 * 2. Auto-rollback triggers on 5% error rate or 3 consecutive health check failures
 * 3. Health checks run every 30 seconds during deployment
 * 4. Rolling deployments update 25% of instances at a time
 * 5. All deployments require at least one health check endpoint
 */
export class Deployment {
  private constructor(private props: DeploymentProps) {}

  // ============================================================
  // FACTORY METHODS
  // ============================================================

  /**
   * Create a new Deployment with business validation
   */
  static create(
    props: Omit<DeploymentProps, 'id' | 'status' | 'createdAt' | 'consecutiveHealthCheckFailures' | 'errorRate'>
  ): Deployment {
    if (!props.aiSystemId?.trim()) {
      throw new Error('AI system ID is required');
    }

    if (!props.version?.trim()) {
      throw new Error('Version is required');
    }

    const validStrategies: DeploymentStrategy[] = ['rolling', 'blue_green', 'canary'];
    if (!validStrategies.includes(props.strategy)) {
      throw new Error(`Invalid deployment strategy: ${props.strategy}`);
    }

    if (props.strategy === 'canary' && !props.canaryPercentage) {
      throw new Error('Canary percentage is required for canary deployments');
    }

    if (props.strategy === 'canary' && (props.canaryPercentage! < 0 || props.canaryPercentage! > 100)) {
      throw new Error('Canary percentage must be between 0 and 100');
    }

    if (!props.healthChecks || props.healthChecks.length === 0) {
      throw new Error('At least one health check is required');
    }

    for (const check of props.healthChecks) {
      if (!check.endpoint?.trim()) {
        throw new Error('Health check endpoint is required');
      }
      if (check.timeout <= 0 || check.timeout > 30000) {
        throw new Error('Health check timeout must be between 0 and 30000ms');
      }
    }

    if (props.rollbackPolicy.errorThreshold < 0 || props.rollbackPolicy.errorThreshold > 100) {
      throw new Error('Error threshold must be between 0 and 100');
    }

    return new Deployment({
      ...props,
      status: 'pending',
      consecutiveHealthCheckFailures: 0,
      errorRate: 0,
      createdAt: new Date(),
    });
  }

  /**
   * Reconstruct from database
   */
  static fromPersistence(props: DeploymentProps): Deployment {
    if (!props.id) {
      throw new Error('Deployment ID is required when reconstructing from persistence');
    }
    return new Deployment(props);
  }

  // ============================================================
  // BUSINESS LOGIC: Deployment Lifecycle
  // ============================================================

  /**
   * Start deployment
   */
  start(): void {
    if (this.props.status !== 'pending') {
      throw new Error(`Cannot start deployment with status: ${this.props.status}`);
    }
    this.props.status = 'in_progress';
    this.props.deployedAt = new Date();
  }

  /**
   * Mark deployment as healthy
   */
  markHealthy(): void {
    if (this.props.status !== 'in_progress' && this.props.status !== 'degraded') {
      throw new Error('Can only mark in_progress or degraded deployments as healthy');
    }
    this.props.status = 'healthy';
    this.props.completedAt = new Date();
  }

  /**
   * Mark deployment as degraded
   */
  markDegraded(reason: string): void {
    if (this.props.status !== 'in_progress' && this.props.status !== 'healthy') {
      throw new Error('Can only mark in_progress or healthy deployments as degraded');
    }
    this.props.status = 'degraded';
  }

  /**
   * Mark deployment as failed
   */
  markFailed(reason: string): void {
    this.props.status = 'failed';
    this.props.completedAt = new Date();
    this.props.rollbackReason = reason;
  }

  // ============================================================
  // BUSINESS LOGIC: Health Checks
  // ============================================================

  /**
   * Record health check result
   */
  recordHealthCheckResult(endpoint: string, success: boolean, errorMessage?: string): void {
    const check = this.props.healthChecks.find(c => c.endpoint === endpoint);
    if (!check) {
      throw new Error(`Health check not found for endpoint: ${endpoint}`);
    }

    check.lastCheckedAt = new Date();
    check.isHealthy = success;
    check.errorMessage = errorMessage;

    if (success) {
      this.props.consecutiveHealthCheckFailures = 0;
    } else {
      this.props.consecutiveHealthCheckFailures = (this.props.consecutiveHealthCheckFailures || 0) + 1;
    }
  }

  /**
   * Check if all health checks are passing
   */
  areAllHealthChecksPassing(): boolean {
    return this.props.healthChecks.every(c => c.isHealthy === true);
  }

  /**
   * Get unhealthy check count
   */
  getUnhealthyCheckCount(): number {
    return this.props.healthChecks.filter(c => c.isHealthy === false).length;
  }

  // ============================================================
  // BUSINESS LOGIC: Error Tracking
  // ============================================================

  /**
   * Update error rate
   */
  updateErrorRate(errorRate: number): void {
    if (errorRate < 0 || errorRate > 100) {
      throw new Error('Error rate must be between 0 and 100');
    }
    this.props.errorRate = errorRate;
  }

  /**
   * Check if should trigger automatic rollback
   * Business Rule: Rollback on 5% error rate or 3 consecutive health check failures
   */
  shouldTriggerAutoRollback(): boolean {
    if (!this.props.rollbackPolicy.autoRollback) {
      return false;
    }

    if (this.props.status === 'rolled_back' || this.props.status === 'failed') {
      return false; // Already rolled back or failed
    }

    const errorThresholdExceeded = (this.props.errorRate || 0) >= this.props.rollbackPolicy.errorThreshold;
    const healthCheckFailuresExceeded = (this.props.consecutiveHealthCheckFailures || 0) >= this.props.rollbackPolicy.healthCheckFailures;

    return errorThresholdExceeded || healthCheckFailuresExceeded;
  }

  // ============================================================
  // BUSINESS LOGIC: Rollback
  // ============================================================

  /**
   * Execute rollback
   */
  rollback(reason: string): void {
    if (this.props.status === 'rolled_back') {
      throw new Error('Deployment is already rolled back');
    }

    if (!reason?.trim()) {
      throw new Error('Rollback reason is required');
    }

    this.props.status = 'rolled_back';
    this.props.rolledBackAt = new Date();
    this.props.rollbackReason = reason;
  }

  // ============================================================
  // BUSINESS LOGIC: Canary Deployment
  // ============================================================

  /**
   * Increase canary percentage
   * Business Rule: Increase by 10% every 5 minutes
   */
  increaseCanaryPercentage(): void {
    if (this.props.strategy !== 'canary') {
      throw new Error('Can only increase canary percentage for canary deployments');
    }

    if (this.props.status !== 'in_progress' && this.props.status !== 'healthy') {
      throw new Error('Can only increase canary percentage for in_progress or healthy deployments');
    }

    const newPercentage = Math.min(100, (this.props.canaryPercentage || 0) + 10);
    this.props.canaryPercentage = newPercentage;

    if (newPercentage === 100) {
      this.markHealthy();
    }
  }

  /**
   * Check if canary is ready for next increment
   * Business Rule: Wait 5 minutes between increments
   */
  isCanaryReadyForIncrement(currentTime: Date = new Date()): boolean {
    if (this.props.strategy !== 'canary') {
      return false;
    }

    if (!this.props.deployedAt) {
      return false;
    }

    if ((this.props.canaryPercentage || 0) >= 100) {
      return false; // Already at 100%
    }

    const minutesSinceDeployment = (currentTime.getTime() - this.props.deployedAt.getTime()) / (1000 * 60);
    const expectedIncrement = Math.floor(minutesSinceDeployment / 5);
    const currentIncrement = Math.floor((this.props.canaryPercentage || 10) / 10) - 1; // Subtract 1 because we start at 10%

    return expectedIncrement > currentIncrement;
  }

  // ============================================================
  // BUSINESS LOGIC: Validation
  // ============================================================

  /**
   * Validate deployment is ready to start
   */
  validateReadyToStart(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.props.status !== 'pending') {
      errors.push(`Deployment must be pending to start, current status: ${this.props.status}`);
    }

    if (!this.props.healthChecks || this.props.healthChecks.length === 0) {
      errors.push('At least one health check is required');
    }

    if (this.props.strategy === 'canary' && !this.props.canaryPercentage) {
      errors.push('Canary percentage is required for canary deployments');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ============================================================
  // INTERNAL ID MANAGEMENT
  // ============================================================

  _setId(id: string): void {
    if (this.props.id) {
      throw new Error('Cannot set ID on a deployment that already has one');
    }
    this.props.id = id;
  }

  // ============================================================
  // GETTERS
  // ============================================================

  get id(): string | undefined {
    return this.props.id;
  }

  get aiSystemId(): string {
    return this.props.aiSystemId;
  }

  get version(): string {
    return this.props.version;
  }

  get strategy(): DeploymentStrategy {
    return this.props.strategy;
  }

  get status(): DeploymentStatus {
    return this.props.status;
  }

  get healthChecks(): HealthCheck[] {
    return this.props.healthChecks;
  }

  get rollbackPolicy(): RollbackPolicy {
    return this.props.rollbackPolicy;
  }

  get canaryPercentage(): number | undefined {
    return this.props.canaryPercentage;
  }

  get errorRate(): number | undefined {
    return this.props.errorRate;
  }

  get consecutiveHealthCheckFailures(): number | undefined {
    return this.props.consecutiveHealthCheckFailures;
  }

  get deployedAt(): Date | undefined {
    return this.props.deployedAt;
  }

  get completedAt(): Date | undefined {
    return this.props.completedAt;
  }

  get rolledBackAt(): Date | undefined {
    return this.props.rolledBackAt;
  }

  get rollbackReason(): string | undefined {
    return this.props.rollbackReason;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get createdBy(): string {
    return this.props.createdBy;
  }

  toSnapshot(): Readonly<DeploymentProps> {
    return Object.freeze({
      ...this.props,
      healthChecks: this.props.healthChecks.map(h => ({ ...h })),
      rollbackPolicy: { ...this.props.rollbackPolicy },
    });
  }
}
