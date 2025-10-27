/**
 * AISystem Domain Entity
 * 
 * Encapsulates core business rules for AI system management:
 * - Input validation (name, risk level, status)
 * - Status lifecycle transitions
 * - Monitoring requirements based on risk
 * - PHI exposure tracking
 * - FDA classification validation
 * - Provider system sync metadata
 */

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum SystemStatus {
  ACTIVE = 'active',
  TESTING = 'testing',
  PAUSED = 'paused',
  DEPRECATED = 'deprecated'
}

export enum ProviderType {
  EPIC = 'epic',
  CERNER = 'cerner',
  ATHENAHEALTH = 'athenahealth',
  LANGSMITH = 'langsmith',
  LANGFUSE = 'langfuse',
  ARIZE = 'arize',
  WANDB = 'wandb'
}

export interface IntegrationConfig {
  apiKey?: string;
  baseUrl?: string;
  webhookSecret?: string;
  [key: string]: any;
}

export interface AISystemProps {
  id: string;
  healthSystemId: string;
  name: string;
  description: string | null;
  riskLevel: RiskLevel;
  status: SystemStatus;
  usesPHI: boolean;
  fdaClassification: string | null;
  category: string | null;
  clinicalUseCase: string | null;
  department: string | null;
  monitoringEnabled: boolean;
  integrationConfig: IntegrationConfig | null;
  providerType: ProviderType | null;
  providerSystemId: string | null;
  vendorId: string | null;
  lastCheck: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class AISystem {
  private constructor(private props: AISystemProps) {
    this.validate();
  }

  // Factory method for creating new AI systems
  static create(
    healthSystemId: string,
    name: string,
    options: {
      description?: string | null;
      riskLevel?: RiskLevel;
      status?: SystemStatus;
      usesPHI?: boolean;
      fdaClassification?: string | null;
      category?: string | null;
      clinicalUseCase?: string | null;
      department?: string | null;
      monitoringEnabled?: boolean;
      integrationConfig?: IntegrationConfig | null;
      providerType?: ProviderType | null;
      providerSystemId?: string | null;
      vendorId?: string | null;
    } = {}
  ): AISystem {
    const now = new Date();
    
    return new AISystem({
      id: '', // Will be set by repository
      healthSystemId,
      name,
      description: options.description ?? null,
      riskLevel: options.riskLevel ?? RiskLevel.MEDIUM,
      status: options.status ?? SystemStatus.TESTING,
      usesPHI: options.usesPHI ?? false,
      fdaClassification: options.fdaClassification ?? null,
      category: options.category ?? null,
      clinicalUseCase: options.clinicalUseCase ?? null,
      department: options.department ?? null,
      monitoringEnabled: options.monitoringEnabled ?? false,
      integrationConfig: options.integrationConfig ?? null,
      providerType: options.providerType ?? null,
      providerSystemId: options.providerSystemId ?? null,
      vendorId: options.vendorId ?? null,
      lastCheck: null,
      createdAt: now,
      updatedAt: now
    });
  }

  // Factory method for reconstituting from database
  static fromPersistence(props: AISystemProps): AISystem {
    return new AISystem(props);
  }

  // Validation logic (encapsulated business rules)
  private validate(): void {
    // Name must be at least 3 characters
    if (this.props.name.length < 3) {
      throw new Error('AI system name must be at least 3 characters');
    }

    // High and critical risk systems MUST have monitoring enabled
    if (
      (this.props.riskLevel === RiskLevel.HIGH || this.props.riskLevel === RiskLevel.CRITICAL) &&
      !this.props.monitoringEnabled
    ) {
      throw new Error('High and critical risk AI systems must have monitoring enabled');
    }

    // If using PHI, FDA classification should be considered
    if (this.props.usesPHI && !this.props.fdaClassification) {
      // This is a warning, not an error, but we track it
      // In future, this could be a hard requirement
    }

    // Provider-synced systems must have both providerType and providerSystemId
    if (
      (this.props.providerType && !this.props.providerSystemId) ||
      (!this.props.providerType && this.props.providerSystemId)
    ) {
      throw new Error('Provider-synced systems must have both providerType and providerSystemId');
    }
  }

  // Business logic: Can this system transition to a new status?
  canTransitionTo(newStatus: SystemStatus): boolean {
    const currentStatus = this.props.status;

    // Allowed transitions based on lifecycle
    const allowedTransitions: Record<SystemStatus, SystemStatus[]> = {
      [SystemStatus.TESTING]: [SystemStatus.ACTIVE, SystemStatus.DEPRECATED],
      [SystemStatus.ACTIVE]: [SystemStatus.PAUSED, SystemStatus.DEPRECATED],
      [SystemStatus.PAUSED]: [SystemStatus.ACTIVE, SystemStatus.DEPRECATED],
      [SystemStatus.DEPRECATED]: [] // Terminal state
    };

    return allowedTransitions[currentStatus]?.includes(newStatus) ?? false;
  }

  // Business logic: Update status with validation
  updateStatus(newStatus: SystemStatus, reason?: string): void {
    if (!this.canTransitionTo(newStatus)) {
      throw new Error(
        `Invalid status transition: cannot go from ${this.props.status} to ${newStatus}`
      );
    }

    this.props.status = newStatus;
    this.props.updatedAt = new Date();
  }

  // Business logic: Update risk level with side effects
  updateRiskLevel(newRiskLevel: RiskLevel): void {
    const oldRiskLevel = this.props.riskLevel;
    this.props.riskLevel = newRiskLevel;

    // If upgrading to high/critical, enforce monitoring
    if (
      (newRiskLevel === RiskLevel.HIGH || newRiskLevel === RiskLevel.CRITICAL) &&
      !this.props.monitoringEnabled
    ) {
      this.props.monitoringEnabled = true;
    }

    this.props.updatedAt = new Date();
    this.validate(); // Re-validate after change
  }

  // Business logic: Update basic properties
  updateProperties(updates: {
    name?: string;
    description?: string | null;
    usesPHI?: boolean;
    fdaClassification?: string | null;
    category?: string | null;
    clinicalUseCase?: string | null;
    department?: string | null;
    monitoringEnabled?: boolean;
    integrationConfig?: IntegrationConfig | null;
    vendorId?: string | null;
  }): void {
    if (updates.name !== undefined) {
      this.props.name = updates.name;
    }
    if (updates.description !== undefined) {
      this.props.description = updates.description;
    }
    if (updates.usesPHI !== undefined) {
      this.props.usesPHI = updates.usesPHI;
    }
    if (updates.fdaClassification !== undefined) {
      this.props.fdaClassification = updates.fdaClassification;
    }
    if (updates.category !== undefined) {
      this.props.category = updates.category;
    }
    if (updates.clinicalUseCase !== undefined) {
      this.props.clinicalUseCase = updates.clinicalUseCase;
    }
    if (updates.department !== undefined) {
      this.props.department = updates.department;
    }
    if (updates.monitoringEnabled !== undefined) {
      this.props.monitoringEnabled = updates.monitoringEnabled;
    }
    if (updates.integrationConfig !== undefined) {
      this.props.integrationConfig = updates.integrationConfig;
    }
    if (updates.vendorId !== undefined) {
      this.props.vendorId = updates.vendorId;
    }

    this.props.updatedAt = new Date();
    this.validate(); // Re-validate after changes
  }

  // Business logic: Record monitoring check
  recordCheck(): void {
    this.props.lastCheck = new Date();
    this.props.updatedAt = new Date();
  }

  // Business logic: Is monitoring required?
  requiresMonitoring(): boolean {
    return (
      this.props.riskLevel === RiskLevel.HIGH ||
      this.props.riskLevel === RiskLevel.CRITICAL ||
      this.props.usesPHI
    );
  }

  // Business logic: Is this system production-ready?
  isProductionReady(): boolean {
    return (
      this.props.status === SystemStatus.ACTIVE &&
      this.props.monitoringEnabled &&
      // Additional checks could be added
      true
    );
  }

  // Business logic: Does this system need immediate attention?
  needsAttention(): boolean {
    // High/critical risk systems should be checked recently
    if (
      (this.props.riskLevel === RiskLevel.HIGH || this.props.riskLevel === RiskLevel.CRITICAL) &&
      this.props.lastCheck
    ) {
      const hoursSinceCheck =
        (Date.now() - this.props.lastCheck.getTime()) / (1000 * 60 * 60);
      if (hoursSinceCheck > 24) {
        return true; // Not checked in 24 hours
      }
    }

    return false;
  }

  // Getters
  get id(): string {
    return this.props.id;
  }

  get healthSystemId(): string {
    return this.props.healthSystemId;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | null {
    return this.props.description;
  }

  get riskLevel(): RiskLevel {
    return this.props.riskLevel;
  }

  get status(): SystemStatus {
    return this.props.status;
  }

  get usesPHI(): boolean {
    return this.props.usesPHI;
  }

  get fdaClassification(): string | null {
    return this.props.fdaClassification;
  }

  get category(): string | null {
    return this.props.category;
  }

  get clinicalUseCase(): string | null {
    return this.props.clinicalUseCase;
  }

  get department(): string | null {
    return this.props.department;
  }

  get monitoringEnabled(): boolean {
    return this.props.monitoringEnabled;
  }

  get integrationConfig(): IntegrationConfig | null {
    return this.props.integrationConfig;
  }

  get providerType(): ProviderType | null {
    return this.props.providerType;
  }

  get providerSystemId(): string | null {
    return this.props.providerSystemId;
  }

  get vendorId(): string | null {
    return this.props.vendorId;
  }

  get lastCheck(): Date | null {
    return this.props.lastCheck;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // For persistence - expose internal state (deep copy to prevent mutation)
  toSnapshot(): AISystemProps {
    return JSON.parse(JSON.stringify(this.props));
  }

  // Allow repository to set ID after persistence
  _setId(id: string): void {
    if (this.props.id && this.props.id !== id) {
      throw new Error('Cannot change existing ID');
    }
    this.props.id = id;
  }
}
