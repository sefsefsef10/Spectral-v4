/**
 * DOMAIN ENTITY: Report
 * 
 * Encapsulates business logic for executive reporting, analytics, and scheduled delivery.
 * Handles report generation, data aggregation, formatting, and distribution.
 * 
 * Clean Architecture: This entity contains PURE business logic with NO external dependencies.
 */

export type ReportType =
  | 'executive_summary'
  | 'compliance_status'
  | 'risk_assessment'
  | 'ai_portfolio'
  | 'vendor_performance'
  | 'alert_analytics'
  | 'audit_trail';

export type ReportFormat = 'pdf' | 'csv' | 'json' | 'html';

export type ReportSchedule = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'on_demand';

export type ReportStatus = 'pending' | 'generating' | 'completed' | 'failed' | 'delivered';

export interface ReportProps {
  id?: string;
  healthSystemId: string;
  type: ReportType;
  format: ReportFormat;
  schedule: ReportSchedule;
  title: string;
  description?: string;
  parameters?: Record<string, unknown>;
  status: ReportStatus;
  generatedAt?: Date;
  deliveredAt?: Date;
  recipients?: string[]; // Email addresses
  fileUrl?: string; // S3 URL or storage location
  fileSize?: number; // Bytes
  error?: string;
  createdAt: Date;
  createdBy: string;
}

/**
 * Report Domain Entity
 * 
 * Business Rules:
 * 1. Executive reports must include risk metrics and compliance status
 * 2. Scheduled reports auto-generate based on frequency
 * 3. Failed reports retry up to 3 times before marking as failed
 * 4. Reports expire after 90 days and are auto-archived
 * 5. Sensitive reports (audit trails) require encryption
 */
export class Report {
  private constructor(private props: ReportProps) {}

  // ============================================================
  // FACTORY METHODS
  // ============================================================

  /**
   * Create a new Report with business validation
   */
  static create(
    props: Omit<ReportProps, 'id' | 'status' | 'createdAt'>
  ): Report {
    // Validation: Required fields
    if (!props.healthSystemId?.trim()) {
      throw new Error('Health system ID is required');
    }
    if (!props.title?.trim()) {
      throw new Error('Report title is required');
    }
    if (props.title.length > 500) {
      throw new Error('Report title must not exceed 500 characters');
    }
    if (!props.createdBy?.trim()) {
      throw new Error('Creator user ID is required');
    }

    // Validation: Report type
    const validTypes: ReportType[] = [
      'executive_summary',
      'compliance_status',
      'risk_assessment',
      'ai_portfolio',
      'vendor_performance',
      'alert_analytics',
      'audit_trail',
    ];
    if (!validTypes.includes(props.type)) {
      throw new Error(`Invalid report type: ${props.type}`);
    }

    // Validation: Format
    const validFormats: ReportFormat[] = ['pdf', 'csv', 'json', 'html'];
    if (!validFormats.includes(props.format)) {
      throw new Error(`Invalid report format: ${props.format}`);
    }

    // Validation: Schedule
    const validSchedules: ReportSchedule[] = [
      'daily',
      'weekly',
      'monthly',
      'quarterly',
      'on_demand',
    ];
    if (!validSchedules.includes(props.schedule)) {
      throw new Error(`Invalid report schedule: ${props.schedule}`);
    }

    // Validation: Recipients
    if (props.recipients && props.recipients.length > 50) {
      throw new Error('Cannot exceed 50 recipients per report');
    }

    return new Report({
      ...props,
      status: 'pending',
      createdAt: new Date(),
    });
  }

  /**
   * Reconstruct Report from database (for repositories)
   */
  static fromPersistence(props: ReportProps): Report {
    if (!props.id) {
      throw new Error('Report ID is required when reconstructing from persistence');
    }
    return new Report(props);
  }

  // ============================================================
  // BUSINESS LOGIC: Report Generation
  // ============================================================

  /**
   * Mark report as generating
   */
  startGeneration(): void {
    if (this.props.status !== 'pending') {
      throw new Error(`Cannot start generation for report with status: ${this.props.status}`);
    }
    this.props.status = 'generating';
  }

  /**
   * Complete report generation with file details
   */
  completeGeneration(fileUrl: string, fileSize: number): void {
    if (this.props.status !== 'generating') {
      throw new Error('Report must be in generating status');
    }

    if (!fileUrl?.trim()) {
      throw new Error('File URL is required');
    }
    if (fileSize <= 0) {
      throw new Error('File size must be positive');
    }
    if (fileSize > 100 * 1024 * 1024) { // 100MB limit
      throw new Error('Report file size exceeds 100MB limit');
    }

    this.props.status = 'completed';
    this.props.generatedAt = new Date();
    this.props.fileUrl = fileUrl;
    this.props.fileSize = fileSize;
  }

  /**
   * Mark report generation as failed
   */
  markFailed(error: string): void {
    if (!error?.trim()) {
      throw new Error('Error message is required');
    }

    this.props.status = 'failed';
    this.props.error = error;
  }

  /**
   * Mark report as delivered
   */
  markDelivered(): void {
    if (this.props.status !== 'completed') {
      throw new Error('Only completed reports can be marked as delivered');
    }

    this.props.status = 'delivered';
    this.props.deliveredAt = new Date();
  }

  // ============================================================
  // BUSINESS LOGIC: Scheduling
  // ============================================================

  /**
   * Check if report should be generated based on schedule
   */
  shouldGenerate(lastGeneratedAt?: Date): boolean {
    if (this.props.schedule === 'on_demand') {
      return false; // Only generate when explicitly requested
    }

    if (!lastGeneratedAt) {
      return true; // Never generated before
    }

    const now = new Date();
    const timeSinceLastMs = now.getTime() - lastGeneratedAt.getTime();
    const hoursSince = timeSinceLastMs / (1000 * 60 * 60);

    switch (this.props.schedule) {
      case 'daily':
        return hoursSince >= 24;
      case 'weekly':
        return hoursSince >= 168; // 7 days
      case 'monthly':
        return hoursSince >= 720; // 30 days
      case 'quarterly':
        return hoursSince >= 2160; // 90 days
      default:
        return false;
    }
  }

  /**
   * Calculate next scheduled generation time
   */
  getNextGenerationTime(lastGeneratedAt: Date): Date {
    const next = new Date(lastGeneratedAt);

    switch (this.props.schedule) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
      default:
        return next; // on_demand has no next time
    }

    return next;
  }

  // ============================================================
  // BUSINESS LOGIC: Data Requirements
  // ============================================================

  /**
   * Get required data sources for this report type
   * Business Rule: Different report types require different data
   */
  getRequiredDataSources(): string[] {
    switch (this.props.type) {
      case 'executive_summary':
        return ['ai_systems', 'alerts', 'compliance_violations', 'risk_scores'];
      case 'compliance_status':
        return ['compliance_violations', 'control_coverage', 'audit_logs'];
      case 'risk_assessment':
        return ['risk_scores', 'ai_systems', 'telemetry_events'];
      case 'ai_portfolio':
        return ['ai_systems', 'deployments', 'vendors'];
      case 'vendor_performance':
        return ['vendors', 'certifications', 'compliance_violations'];
      case 'alert_analytics':
        return ['alerts', 'predictive_alerts', 'response_times'];
      case 'audit_trail':
        return ['audit_logs', 'user_actions', 'system_changes'];
      default:
        return [];
    }
  }

  /**
   * Check if report requires encryption (sensitive data)
   */
  requiresEncryption(): boolean {
    // Audit trails and compliance reports contain sensitive data
    return this.props.type === 'audit_trail' || this.props.type === 'compliance_status';
  }

  /**
   * Get minimum role required to generate this report
   */
  getMinimumRole(): 'viewer' | 'analyst' | 'admin' | 'executive' {
    switch (this.props.type) {
      case 'executive_summary':
        return 'executive';
      case 'audit_trail':
        return 'admin';
      case 'compliance_status':
      case 'risk_assessment':
        return 'analyst';
      default:
        return 'viewer';
    }
  }

  // ============================================================
  // BUSINESS LOGIC: Expiration & Archival
  // ============================================================

  /**
   * Check if report has expired (90 days)
   */
  hasExpired(): boolean {
    if (!this.props.generatedAt) {
      return false; // Not generated yet
    }

    const now = new Date();
    const ageMs = now.getTime() - this.props.generatedAt.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    return ageDays > 90;
  }

  /**
   * Get expiration date
   */
  getExpirationDate(): Date | null {
    if (!this.props.generatedAt) {
      return null;
    }

    const expiration = new Date(this.props.generatedAt);
    expiration.setDate(expiration.getDate() + 90);
    return expiration;
  }

  // ============================================================
  // BUSINESS LOGIC: Validation
  // ============================================================

  /**
   * Validate report parameters against requirements
   */
  validateParameters(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Executive summaries require date range
    if (this.props.type === 'executive_summary') {
      if (!this.props.parameters?.startDate || !this.props.parameters?.endDate) {
        errors.push('Executive summary requires startDate and endDate parameters');
      }
    }

    // Vendor performance requires vendor selection
    if (this.props.type === 'vendor_performance') {
      if (!this.props.parameters?.vendorIds || (this.props.parameters.vendorIds as any[]).length === 0) {
        errors.push('Vendor performance report requires at least one vendor ID');
      }
    }

    // Compliance status requires framework selection
    if (this.props.type === 'compliance_status') {
      if (!this.props.parameters?.frameworks) {
        errors.push('Compliance status requires framework selection (HIPAA, NIST, FDA)');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ============================================================
  // INTERNAL ID MANAGEMENT
  // ============================================================

  /**
   * Set the ID after persistence (called by repository)
   * @internal
   */
  _setId(id: string): void {
    if (this.props.id) {
      throw new Error('Cannot set ID on a report that already has one');
    }
    this.props.id = id;
  }

  // ============================================================
  // GETTERS
  // ============================================================

  get id(): string | undefined {
    return this.props.id;
  }

  get healthSystemId(): string {
    return this.props.healthSystemId;
  }

  get type(): ReportType {
    return this.props.type;
  }

  get format(): ReportFormat {
    return this.props.format;
  }

  get schedule(): ReportSchedule {
    return this.props.schedule;
  }

  get title(): string {
    return this.props.title;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get parameters(): Record<string, unknown> | undefined {
    return this.props.parameters;
  }

  get status(): ReportStatus {
    return this.props.status;
  }

  get generatedAt(): Date | undefined {
    return this.props.generatedAt;
  }

  get deliveredAt(): Date | undefined {
    return this.props.deliveredAt;
  }

  get recipients(): string[] | undefined {
    return this.props.recipients;
  }

  get fileUrl(): string | undefined {
    return this.props.fileUrl;
  }

  get fileSize(): number | undefined {
    return this.props.fileSize;
  }

  get error(): string | undefined {
    return this.props.error;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get createdBy(): string {
    return this.props.createdBy;
  }

  /**
   * Get a deep copy of all properties (for snapshots/auditing)
   */
  toSnapshot(): Readonly<ReportProps> {
    return Object.freeze({
      ...this.props,
      parameters: this.props.parameters ? { ...this.props.parameters } : undefined,
      recipients: this.props.recipients ? [...this.props.recipients] : undefined,
    });
  }
}
