/**
 * DOMAIN ENTITY: Alert
 * 
 * Encapsulates business logic for AI system monitoring and predictive alerts.
 * Handles severity calculation, routing rules, escalation, and deduplication.
 * 
 * Clean Architecture: This entity contains PURE business logic with NO external dependencies.
 */

export type AlertType =
  | 'compliance_violation'
  | 'performance_degradation'
  | 'phi_exposure'
  | 'model_drift'
  | 'bias_detection'
  | 'error_spike'
  | 'latency_degradation'
  | 'security_breach'
  | 'data_quality';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type Severity = AlertSeverity; // Alias for convenience

export type NotificationChannel = 'email' | 'sms' | 'slack' | 'pagerduty' | 'dashboard';

export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed';

export interface AlertProps {
  id?: string;
  aiSystemId: string;
  healthSystemId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  status: AlertStatus;
  metadata?: Record<string, unknown>;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  responseTimeSeconds?: number;
  slaDeadline?: Date;
  createdAt?: Date;
}

/**
 * Alert Domain Entity
 * 
 * Business Rules:
 * 1. Severity must be calculated based on type, impact, and time sensitivity
 * 2. Critical alerts must route to multiple channels for redundancy
 * 3. Alerts can be acknowledged (in progress) or resolved (fixed)
 * 4. Response time tracking for SLA compliance
 * 5. Deduplication by type + aiSystemId + similar message
 */
export class Alert {
  private constructor(private props: Required<Omit<AlertProps, 'id' | 'acknowledgedAt' | 'acknowledgedBy' | 'resolvedAt' | 'resolvedBy' | 'responseTimeSeconds' | 'metadata' | 'slaDeadline'>> & {
    id?: string;
    acknowledgedAt?: Date;
    acknowledgedBy?: string;
    resolvedAt?: Date;
    resolvedBy?: string;
    responseTimeSeconds?: number;
    slaDeadline?: Date;
    metadata?: Record<string, unknown>;
  }) {}

  // ============================================================
  // FACTORY METHODS
  // ============================================================

  /**
   * Create a new Alert with business validation
   */
  static create(props: Omit<AlertProps, 'id' | 'status' | 'createdAt'>): Alert {
    // Validation: Required fields
    if (!props.aiSystemId?.trim()) {
      throw new Error('AI system ID is required');
    }
    if (!props.healthSystemId?.trim()) {
      throw new Error('Health system ID is required');
    }
    if (!props.message?.trim()) {
      throw new Error('Alert message is required');
    }
    if (props.message.length > 5000) {
      throw new Error('Alert message must not exceed 5000 characters');
    }

    // Validation: Alert type
    const validTypes: AlertType[] = [
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
    if (!validTypes.includes(props.type)) {
      throw new Error(`Invalid alert type: ${props.type}`);
    }

    // Validation: Severity
    const validSeverities: AlertSeverity[] = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(props.severity)) {
      throw new Error(`Invalid severity: ${props.severity}`);
    }

    const createdAt = new Date();
    const slaDeadline = Alert.calculateSLADeadline(props.severity, createdAt);

    return new Alert({
      ...props,
      status: 'active',
      createdAt,
      slaDeadline,
    });
  }

  /**
   * Reconstruct Alert from database (for repositories)
   */
  static fromPersistence(props: AlertProps): Alert {
    if (!props.id) {
      throw new Error('Alert ID is required when reconstructing from persistence');
    }
    return new Alert(props as Required<Omit<AlertProps, 'id' | 'acknowledgedAt' | 'acknowledgedBy' | 'resolvedAt' | 'resolvedBy' | 'responseTimeSeconds' | 'metadata'>> & {
      id: string;
      acknowledgedAt?: Date;
      acknowledgedBy?: string;
      resolvedAt?: Date;
      resolvedBy?: string;
      responseTimeSeconds?: number;
      metadata?: Record<string, unknown>;
    });
  }

  // ============================================================
  // BUSINESS LOGIC: Severity Calculation
  // ============================================================

  /**
   * Calculate SLA deadline based on severity
   * Business Rule: Critical (2 min), High (4 hours), Medium (24 hours), Low (72 hours)
   */
  static calculateSLADeadline(severity: AlertSeverity, createdAt: Date): Date {
    const deadline = new Date(createdAt);
    
    switch (severity) {
      case 'critical':
        deadline.setMinutes(deadline.getMinutes() + 2);
        break;
      case 'high':
        deadline.setHours(deadline.getHours() + 4);
        break;
      case 'medium':
        deadline.setHours(deadline.getHours() + 24);
        break;
      case 'low':
        deadline.setHours(deadline.getHours() + 72);
        break;
    }
    
    return deadline;
  }

  /**
   * Calculate alert severity based on type and metadata
   * Business Rule: PHI/security breaches are always critical, compliance violations vary by impact
   */
  static calculateSeverity(type: AlertType, metadata?: Record<string, unknown>): AlertSeverity {
    // Critical: Security and PHI exposure
    if (type === 'phi_exposure' || type === 'security_breach') {
      return 'critical';
    }

    // High: Compliance violations and bias detection
    if (type === 'compliance_violation' || type === 'bias_detection') {
      // Check if specific control is critical
      const controlId = metadata?.controlId as string;
      if (controlId?.includes('HIPAA') || controlId?.includes('164.312')) {
        return 'critical';
      }
      return 'high';
    }

    // Low to High: Performance issues based on impact
    if (type === 'performance_degradation' || type === 'latency_degradation') {
      const percentDegraded = metadata?.percentDegraded as number;
      if (percentDegraded && percentDegraded > 50) {
        return 'high';
      }
      if (percentDegraded && percentDegraded > 10) {
        return 'medium';
      }
      return 'low';
    }

    // Medium to High: Error spikes based on rate
    if (type === 'error_spike') {
      const errorRate = metadata?.errorRate as number;
      if (errorRate && errorRate > 0.1) { // 10% error rate
        return 'high';
      }
      return 'medium';
    }

    // Medium: Model drift and data quality
    if (type === 'model_drift' || type === 'data_quality') {
      const driftScore = metadata?.driftScore as number;
      if (driftScore && driftScore > 0.7) {
        return 'high';
      }
      return 'medium';
    }

    return 'medium';
  }

  // ============================================================
  // BUSINESS LOGIC: Notification Routing
  // ============================================================

  /**
   * Determine which notification channels should be used
   * Business Rule: Critical alerts use all channels, escalating severity reduces channels
   */
  getNotificationChannels(): NotificationChannel[] {
    const channels: NotificationChannel[] = ['dashboard']; // Always show in dashboard

    switch (this.props.severity) {
      case 'critical':
        // Critical: All channels for maximum visibility
        channels.push('email', 'sms', 'slack', 'pagerduty');
        break;
      case 'high':
        // High: Email, Slack, and PagerDuty
        channels.push('email', 'slack', 'pagerduty');
        break;
      case 'medium':
        // Medium: Email and Slack
        channels.push('email', 'slack');
        break;
      case 'low':
        // Low: Email only (plus dashboard)
        channels.push('email');
        break;
    }

    return channels;
  }

  /**
   * Check if alert requires immediate escalation
   * Business Rule: Critical PHI/security alerts escalate immediately
   */
  requiresImmediateEscalation(): boolean {
    if (this.props.severity !== 'critical') {
      return false;
    }

    // Critical PHI or security breaches require immediate escalation
    return this.props.type === 'phi_exposure' || this.props.type === 'security_breach';
  }

  /**
   * Get escalation tier based on severity and type
   */
  getEscalationTier(): 'team_lead' | 'department_head' | 'ciso' | 'executive' {
    if (this.props.type === 'phi_exposure' || this.props.type === 'security_breach') {
      return 'ciso'; // Security incidents go to CISO
    }

    switch (this.props.severity) {
      case 'critical':
        return 'ciso';
      case 'high':
        return 'department_head';
      case 'medium':
        return 'team_lead';
      default:
        return 'team_lead';
    }
  }

  // ============================================================
  // BUSINESS LOGIC: Alert Lifecycle
  // ============================================================

  /**
   * Acknowledge the alert (someone is working on it)
   */
  acknowledge(userId: string): void {
    if (this.props.status !== 'active') {
      throw new Error('Cannot acknowledge alert that is not active');
    }

    this.props.status = 'acknowledged';
    this.props.acknowledgedAt = new Date();
    this.props.acknowledgedBy = userId;
  }

  /**
   * Resolve the alert (issue is fixed)
   */
  resolve(userId: string): void {
    if (this.props.status !== 'active' && this.props.status !== 'acknowledged') {
      throw new Error('Alert must be in active or acknowledged state to resolve');
    }

    this.props.status = 'resolved';
    this.props.resolvedAt = new Date();
    this.props.resolvedBy = userId;

    // Calculate response time in seconds
    const responseMs = this.props.resolvedAt.getTime() - this.props.createdAt.getTime();
    this.props.responseTimeSeconds = Math.floor(responseMs / 1000);
  }

  /**
   * Dismiss the alert (false positive or not actionable)
   */
  dismiss(userId: string): void {
    if (this.props.status === 'resolved') {
      throw new Error('Cannot dismiss an already resolved alert');
    }

    this.props.status = 'dismissed';
    this.props.resolvedAt = new Date();
    this.props.resolvedBy = userId;
  }

  /**
   * Check if alert is still active (not resolved or dismissed)
   */
  isActive(): boolean {
    return this.props.status === 'active' || this.props.status === 'acknowledged';
  }

  /**
   * Check if alert has exceeded SLA response time
   * Business Rule: Critical = 2min, High = 15min, Medium = 1hr, Low = 24hr
   */
  hasExceededSLA(): boolean {
    if (!this.isActive()) {
      return false;
    }

    const now = new Date();
    const ageMinutes = (now.getTime() - this.props.createdAt.getTime()) / (1000 * 60);

    switch (this.props.severity) {
      case 'critical':
        return ageMinutes > 2;
      case 'high':
        return ageMinutes > 15;
      case 'medium':
        return ageMinutes > 60;
      case 'low':
        return ageMinutes > 1440; // 24 hours
    }
  }

  // ============================================================
  // BUSINESS LOGIC: Deduplication
  // ============================================================

  /**
   * Generate deduplication key for alert grouping
   * Business Rule: Same type + system + similar message = duplicate
   */
  getDeduplicationKey(): string {
    // Normalize message for similarity check (remove numbers, whitespace variations)
    const normalizedMessage = this.props.message
      .toLowerCase()
      .replace(/\d+/g, 'N') // Replace numbers with 'N'
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    return `${this.props.aiSystemId}:${this.props.type}:${normalizedMessage.substring(0, 100)}`;
  }

  /**
   * Check if another alert is a duplicate of this one
   */
  isDuplicateOf(other: Alert): boolean {
    // Same deduplication key = duplicate
    if (this.getDeduplicationKey() !== other.getDeduplicationKey()) {
      return false;
    }

    // Must be within 1 hour of each other
    const timeDiffMs = Math.abs(this.props.createdAt.getTime() - other.props.createdAt.getTime());
    const oneHourMs = 60 * 60 * 1000;
    
    return timeDiffMs < oneHourMs;
  }

  // ============================================================
  // BUSINESS LOGIC: Metadata & Context
  // ============================================================

  /**
   * Add metadata to the alert
   */
  addMetadata(key: string, value: unknown): void {
    if (!this.props.metadata) {
      this.props.metadata = {};
    }
    this.props.metadata[key] = value;
  }

  /**
   * Get formatted alert summary for notifications
   */
  getFormattedSummary(): string {
    const severityEmoji = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    }[this.props.severity];

    return `${severityEmoji} ${this.props.severity.toUpperCase()} Alert: ${this.props.message}`;
  }

  // ============================================================
  // INTERNAL ID MANAGEMENT (for repositories)
  // ============================================================

  /**
   * Set the ID after persistence (called by repository)
   * @internal
   */
  _setId(id: string): void {
    if (this.props.id) {
      throw new Error('Cannot set ID on an alert that already has one');
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

  get healthSystemId(): string {
    return this.props.healthSystemId;
  }

  get type(): AlertType {
    return this.props.type;
  }

  get severity(): AlertSeverity {
    return this.props.severity;
  }

  get message(): string {
    return this.props.message;
  }

  get status(): AlertStatus {
    return this.props.status;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this.props.metadata;
  }

  get acknowledgedAt(): Date | undefined {
    return this.props.acknowledgedAt;
  }

  get acknowledgedBy(): string | undefined {
    return this.props.acknowledgedBy;
  }

  get resolvedAt(): Date | undefined {
    return this.props.resolvedAt;
  }

  get resolvedBy(): string | undefined {
    return this.props.resolvedBy;
  }

  get responseTimeSeconds(): number | undefined {
    return this.props.responseTimeSeconds;
  }

  get slaDeadline(): Date | undefined {
    return this.props.slaDeadline;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  /**
   * Get a deep copy of all properties (for snapshots/auditing)
   */
  toSnapshot(): Readonly<AlertProps> {
    return Object.freeze({
      id: this.props.id,
      aiSystemId: this.props.aiSystemId,
      healthSystemId: this.props.healthSystemId,
      type: this.props.type,
      severity: this.props.severity,
      message: this.props.message,
      status: this.props.status,
      metadata: this.props.metadata ? { ...this.props.metadata } : undefined,
      acknowledgedAt: this.props.acknowledgedAt,
      acknowledgedBy: this.props.acknowledgedBy,
      resolvedAt: this.props.resolvedAt,
      resolvedBy: this.props.resolvedBy,
      responseTimeSeconds: this.props.responseTimeSeconds,
      createdAt: this.props.createdAt,
    });
  }
}
