/**
 * CertificationApplication Domain Entity
 * 
 * Represents a vendor's application for Spectral certification (Silver/Gold/Platinum).
 * Encapsulates all business logic for validation, scoring, and approval workflows.
 */

import { DomainEvent } from '../events/DomainEvent';

export enum CertificationTier {
  SILVER = 'Silver',
  GOLD = 'Gold',
  PLATINUM = 'Platinum'
}

export enum ApplicationStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export interface ComplianceStatements {
  hipaa: boolean;
  nist: boolean;
  fda?: boolean;
  iso?: boolean;
}

export interface CertificationChecks {
  documentationComplete: boolean;
  complianceStatementsValid: boolean;
  deploymentHistoryValid: boolean;
  phiExposureTest: boolean;
  clinicalAccuracyTest: boolean;
  biasDetectionTest: boolean;
  securityScanTest: boolean;
}

export class CertificationApplication {
  private readonly _domainEvents: DomainEvent[] = [];

  private constructor(
    private readonly _id: string,
    private readonly _vendorId: string,
    private _tierRequested: CertificationTier,
    private _documentationUrls: string[],
    private _complianceStatements: ComplianceStatements,
    private _apiEndpoint: string | null,
    private _status: ApplicationStatus,
    private _automatedChecksPassed: boolean,
    private _automatedChecksResult: string | null,
    private _score: number,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {
    this.validate();
  }

  // Factory method for creating NEW applications
  static create(
    vendorId: string,
    tierRequested: CertificationTier,
    documentationUrls: string[],
    complianceStatements: ComplianceStatements,
    apiEndpoint: string | null = null
  ): CertificationApplication {
    if (!vendorId) {
      throw new CertificationDomainError('Vendor ID is required');
    }

    const now = new Date();
    const application = new CertificationApplication(
      generateId(),
      vendorId,
      tierRequested,
      documentationUrls,
      complianceStatements,
      apiEndpoint,
      ApplicationStatus.PENDING,
      false,
      null,
      0,
      now,
      now
    );

    application.raiseEvent(new ApplicationCreatedEvent(
      application._id,
      application._vendorId,
      application._tierRequested
    ));

    return application;
  }

  // Factory method for RECONSTITUTING from database
  static reconstitute(
    id: string,
    vendorId: string,
    tierRequested: CertificationTier,
    documentationUrls: string[],
    complianceStatements: ComplianceStatements,
    apiEndpoint: string | null,
    status: ApplicationStatus,
    automatedChecksPassed: boolean,
    automatedChecksResult: string | null,
    score: number,
    createdAt: Date,
    updatedAt: Date
  ): CertificationApplication {
    return new CertificationApplication(
      id,
      vendorId,
      tierRequested,
      documentationUrls,
      complianceStatements,
      apiEndpoint,
      status,
      automatedChecksPassed,
      automatedChecksResult,
      score,
      createdAt,
      updatedAt
    );
  }

  // Getters
  get id(): string { return this._id; }
  get vendorId(): string { return this._vendorId; }
  get tierRequested(): CertificationTier { return this._tierRequested; }
  get documentationUrls(): string[] { return [...this._documentationUrls]; }
  get complianceStatements(): ComplianceStatements { return { ...this._complianceStatements }; }
  get apiEndpoint(): string | null { return this._apiEndpoint; }
  get status(): ApplicationStatus { return this._status; }
  get automatedChecksPassed(): boolean { return this._automatedChecksPassed; }
  get automatedChecksResult(): string | null { return this._automatedChecksResult; }
  get score(): number { return this._score; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get domainEvents(): DomainEvent[] { return [...this._domainEvents]; }

  // Business Logic: Documentation Validation

  isDocumentationComplete(): boolean {
    const requiredDocs: Record<CertificationTier, number> = {
      [CertificationTier.SILVER]: 1,
      [CertificationTier.GOLD]: 2,
      [CertificationTier.PLATINUM]: 3
    };

    const required = requiredDocs[this._tierRequested];
    return this._documentationUrls.length >= required;
  }

  getDocumentationRequirement(): number {
    const requirements: Record<CertificationTier, number> = {
      [CertificationTier.SILVER]: 1,
      [CertificationTier.GOLD]: 2,
      [CertificationTier.PLATINUM]: 3
    };
    return requirements[this._tierRequested];
  }

  // Business Logic: Compliance Validation

  areComplianceStatementsValid(): boolean {
    switch (this._tierRequested) {
      case CertificationTier.SILVER:
        return this._complianceStatements.hipaa === true;
      
      case CertificationTier.GOLD:
        return this._complianceStatements.hipaa === true && 
               this._complianceStatements.nist === true;
      
      case CertificationTier.PLATINUM:
        return this._complianceStatements.hipaa === true && 
               this._complianceStatements.nist === true && 
               (this._complianceStatements.fda === true || this._complianceStatements.iso === true);
      
      default:
        return false;
    }
  }

  // Business Logic: Deployment History Validation

  isDeploymentHistoryValid(activeDeploymentCount: number): boolean {
    switch (this._tierRequested) {
      case CertificationTier.SILVER:
        return true; // No deployment history required
      
      case CertificationTier.GOLD:
        return activeDeploymentCount >= 1;
      
      case CertificationTier.PLATINUM:
        return activeDeploymentCount >= 3;
      
      default:
        return false;
    }
  }

  getDeploymentRequirement(): number {
    const requirements: Record<CertificationTier, number> = {
      [CertificationTier.SILVER]: 0,
      [CertificationTier.GOLD]: 1,
      [CertificationTier.PLATINUM]: 3
    };
    return requirements[this._tierRequested];
  }

  // Business Logic: Scoring

  calculateScore(checks: CertificationChecks): number {
    let score = 0;
    
    // Scoring weights (total = 100)
    if (checks.documentationComplete) score += 20;
    if (checks.complianceStatementsValid) score += 20;
    if (checks.deploymentHistoryValid) score += 10;
    if (checks.phiExposureTest) score += 15;
    if (checks.clinicalAccuracyTest) score += 15;
    if (checks.biasDetectionTest) score += 10;
    if (checks.securityScanTest) score += 10;
    
    return score;
  }

  // Business Logic: Overall Pass/Fail

  determineOverallPass(checks: CertificationChecks): boolean {
    return Object.values(checks).every(check => check === true);
  }

  // State Transitions

  processAutomatedChecks(
    checks: CertificationChecks,
    testResults: any,
    recommendations: string[]
  ): void {
    const score = this.calculateScore(checks);
    const passed = this.determineOverallPass(checks);

    this._score = score;
    this._automatedChecksPassed = passed;
    this._automatedChecksResult = JSON.stringify({
      passed,
      checks,
      recommendations,
      score,
      testResults
    });
    this._status = passed ? ApplicationStatus.IN_REVIEW : ApplicationStatus.PENDING;
    this._updatedAt = new Date();

    this.raiseEvent(new AutomatedChecksCompletedEvent(
      this._id,
      passed,
      score,
      checks
    ));
  }

  approve(): void {
    if (this._status !== ApplicationStatus.IN_REVIEW) {
      throw new CertificationDomainError('Can only approve applications in review');
    }

    if (!this._automatedChecksPassed) {
      throw new CertificationDomainError('Cannot approve application that failed automated checks');
    }

    this._status = ApplicationStatus.APPROVED;
    this._updatedAt = new Date();

    this.raiseEvent(new ApplicationApprovedEvent(
      this._id,
      this._vendorId,
      this._tierRequested
    ));
  }

  reject(reason: string): void {
    if (this._status === ApplicationStatus.APPROVED) {
      throw new CertificationDomainError('Cannot reject approved application');
    }

    this._status = ApplicationStatus.REJECTED;
    this._updatedAt = new Date();

    this.raiseEvent(new ApplicationRejectedEvent(
      this._id,
      this._vendorId,
      reason
    ));
  }

  // Query Methods

  canBeApproved(): boolean {
    return this._status === ApplicationStatus.IN_REVIEW && 
           this._automatedChecksPassed;
  }

  canBeRejected(): boolean {
    return this._status !== ApplicationStatus.APPROVED;
  }

  isInReview(): boolean {
    return this._status === ApplicationStatus.IN_REVIEW;
  }

  isPending(): boolean {
    return this._status === ApplicationStatus.PENDING;
  }

  // Domain Event Management

  private raiseEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  clearEvents(): void {
    this._domainEvents.length = 0;
  }

  // Validation

  private validate(): void {
    if (!this._id) {
      throw new CertificationDomainError('Application ID is required');
    }

    if (!this._vendorId) {
      throw new CertificationDomainError('Vendor ID is required');
    }

    if (!Object.values(CertificationTier).includes(this._tierRequested)) {
      throw new CertificationDomainError(`Invalid certification tier: ${this._tierRequested}`);
    }

    if (!Object.values(ApplicationStatus).includes(this._status)) {
      throw new CertificationDomainError(`Invalid status: ${this._status}`);
    }
  }
}

// Domain Events

export class ApplicationCreatedEvent implements DomainEvent {
  readonly occurredAt: Date = new Date();
  readonly eventType = 'certification.application.created' as const;

  constructor(
    readonly applicationId: string,
    readonly vendorId: string,
    readonly tierRequested: CertificationTier
  ) {}
}

export class AutomatedChecksCompletedEvent implements DomainEvent {
  readonly occurredAt: Date = new Date();
  readonly eventType = 'certification.automated_checks_completed' as const;

  constructor(
    readonly applicationId: string,
    readonly passed: boolean,
    readonly score: number,
    readonly checks: CertificationChecks
  ) {}
}

export class ApplicationApprovedEvent implements DomainEvent {
  readonly occurredAt: Date = new Date();
  readonly eventType = 'certification.application.approved' as const;

  constructor(
    readonly applicationId: string,
    readonly vendorId: string,
    readonly tierAwarded: CertificationTier
  ) {}
}

export class ApplicationRejectedEvent implements DomainEvent {
  readonly occurredAt: Date = new Date();
  readonly eventType = 'certification.application.rejected' as const;

  constructor(
    readonly applicationId: string,
    readonly vendorId: string,
    readonly reason: string
  ) {}
}

// Custom Domain Error

export class CertificationDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CertificationDomainError';
  }
}

// Helper function

function generateId(): string {
  return crypto.randomUUID();
}
