/**
 * Process Certification Application Use Case
 * 
 * Orchestrates the automated certification testing workflow:
 * 1. Load application from repository
 * 2. Validate documentation, compliance, deployments
 * 3. Run automated vendor testing suite
 * 4. Calculate score and determine pass/fail
 * 5. Save updated application
 * 
 * This is the application layer - it coordinates domain entities,
 * repositories, and external services WITHOUT containing business logic.
 */

import { 
  CertificationApplication, 
  CertificationChecks 
} from '@server/domain/entities/CertificationApplication';
import { 
  CertificationApplicationRepository, 
  DeploymentRepository 
} from '@server/domain/repositories/CertificationApplicationRepository';
import { Logger } from '@server/logger';

// Request/Response DTOs (Data Transfer Objects)

export interface ProcessCertificationRequest {
  applicationId: string;
}

export interface ProcessCertificationResponse {
  success: boolean;
  applicationId: string;
  passed: boolean;
  score: number;
  status: string;
  checks: CertificationChecks;
  recommendations: string[];
  testResults?: any;
  error?: string;
}

// Vendor Testing Suite Interface (external dependency)

export interface VendorTestingSuite {
  runAllTests(config: VendorTestConfig): Promise<VendorTestResult[]>;
}

export interface VendorTestConfig {
  applicationId: string;
  vendorId: string;
  aiSystemEndpoint?: string;
}

export interface VendorTestResult {
  testType: string;
  passed: boolean;
  score: number;
  details?: any;
  errorMessage?: string;
}

/**
 * Use Case Implementation
 */
export class ProcessCertificationApplicationUseCase {
  constructor(
    private readonly applicationRepository: CertificationApplicationRepository,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly vendorTestingSuite: VendorTestingSuite,
    private readonly logger: Logger
  ) {}

  async execute(request: ProcessCertificationRequest): Promise<ProcessCertificationResponse> {
    const { applicationId } = request;

    this.logger.info({ applicationId }, `Processing certification application: ${applicationId}`);

    // 1. Load application
    const application = await this.applicationRepository.findById(applicationId);
    
    if (!application) {
      return {
        success: false,
        applicationId,
        passed: false,
        score: 0,
        status: 'not_found',
        checks: this.createEmptyChecks(),
        recommendations: [],
        error: `Application not found: ${applicationId}`
      };
    }

    try {
      // 2. Perform automated checks using domain logic
      const checks = await this.performAutomatedChecks(application);

      // 3. Build recommendations
      const recommendations = this.buildRecommendations(application, checks);

      // 4. Run vendor testing suite
      const rawTestResults = await this.runVendorTests(application);

      // 5. Process test results (updates checks and recommendations)
      this.processTestResults(rawTestResults, checks, recommendations);

      // 6. Format test results for storage
      const formattedTestResults = this.formatTestResults(rawTestResults);

      // 7. Update application using domain entity
      application.processAutomatedChecks(checks, formattedTestResults, recommendations);

      // 8. Save to repository
      await this.applicationRepository.save(application);

      // 9. Log completion
      this.logger.info(
        { applicationId, passed: application.automatedChecksPassed, score: application.score },
        `Certification application ${applicationId}: ${application.automatedChecksPassed ? 'PASSED' : 'FAILED'} automated checks (score: ${application.score})`
      );

      // 10. Return response
      return {
        success: true,
        applicationId: application.id,
        passed: application.automatedChecksPassed,
        score: application.score,
        status: application.status,
        checks,
        recommendations,
        testResults: formattedTestResults
      };

    } catch (error) {
      this.logger.error({ applicationId, error }, 'Failed to process certification application');
      
      return {
        success: false,
        applicationId,
        passed: false,
        score: 0,
        status: application.status,
        checks: this.createEmptyChecks(),
        recommendations: ['Processing failed - please try again'],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Perform automated checks using domain logic
   */
  private async performAutomatedChecks(
    application: CertificationApplication
  ): Promise<CertificationChecks> {
    // Documentation check (domain logic)
    const documentationComplete = application.isDocumentationComplete();

    // Compliance statements check (domain logic)
    const complianceStatementsValid = application.areComplianceStatementsValid();

    // Deployment history check (domain logic + repository query)
    const activeDeployments = await this.deploymentRepository.countActiveByVendorId(
      application.vendorId
    );
    const deploymentHistoryValid = application.isDeploymentHistoryValid(activeDeployments);

    // Test results start as false (will be updated after vendor testing)
    return {
      documentationComplete,
      complianceStatementsValid,
      deploymentHistoryValid,
      phiExposureTest: false,
      clinicalAccuracyTest: false,
      biasDetectionTest: false,
      securityScanTest: false
    };
  }

  /**
   * Build recommendations based on failed checks
   */
  private buildRecommendations(
    application: CertificationApplication,
    checks: CertificationChecks
  ): string[] {
    const recommendations: string[] = [];

    if (!checks.documentationComplete) {
      recommendations.push('Please upload complete documentation for all requested compliance frameworks');
    }

    if (!checks.complianceStatementsValid) {
      recommendations.push('Compliance statements must align with requested certification tier');
    }

    if (!checks.deploymentHistoryValid) {
      const requirement = application.getDeploymentRequirement();
      const tierName = application.tierRequested;
      
      if (requirement === 1) {
        recommendations.push(`${tierName} tier requires at least 1 active deployment with a health system`);
      } else if (requirement > 1) {
        recommendations.push(`${tierName} tier requires at least ${requirement} active deployments with health systems`);
      }
    }

    return recommendations;
  }

  /**
   * Run vendor testing suite
   */
  private async runVendorTests(
    application: CertificationApplication
  ): Promise<VendorTestResult[]> {
    this.logger.info({ applicationId: application.id }, 'Running vendor testing suite...');

    try {
      const testConfig: VendorTestConfig = {
        applicationId: application.id,
        vendorId: application.vendorId,
        aiSystemEndpoint: application.apiEndpoint || undefined
      };

      const results = await this.vendorTestingSuite.runAllTests(testConfig);

      this.logger.info(
        { applicationId: application.id, testResults: this.formatTestResults(results) },
        'Vendor testing suite completed'
      );

      return results;

    } catch (error) {
      this.logger.error(
        { applicationId: application.id, error },
        'Vendor testing suite failed'
      );
      return [];
    }
  }

  /**
   * Process test results and update checks
   */
  private processTestResults(
    testResults: VendorTestResult[],
    checks: CertificationChecks,
    recommendations: string[]
  ): void {
    for (const result of testResults) {
      switch (result.testType) {
        case 'phi_exposure':
          checks.phiExposureTest = result.passed;
          if (!result.passed) {
            const violations = result.details?.violations || 0;
            recommendations.push(
              `PHI Exposure Test: ${violations} violations detected${result.errorMessage ? ' - ' + result.errorMessage : ''}`
            );
          }
          break;

        case 'clinical_accuracy':
          checks.clinicalAccuracyTest = result.passed;
          if (!result.passed) {
            recommendations.push(
              `Clinical Accuracy Test: Score ${result.score}% (minimum 90% required)`
            );
          }
          break;

        case 'bias_detection':
          checks.biasDetectionTest = result.passed;
          if (!result.passed) {
            const biasedGroups = result.details?.biasedGroups || [];
            recommendations.push(
              `Bias Detection Test: Bias detected in ${biasedGroups.join(', ')}`
            );
          }
          break;

        case 'security_scan':
          checks.securityScanTest = result.passed;
          if (!result.passed) {
            const vulnerabilities = result.details?.vulnerabilities || 0;
            recommendations.push(
              `Security Scan: ${vulnerabilities} vulnerabilities found${result.errorMessage ? ' - ' + result.errorMessage : ''}`
            );
          }
          break;
      }
    }

    // If testing suite failed entirely, add generic recommendation
    if (testResults.length === 0) {
      recommendations.push('Automated testing suite encountered errors - manual review required');
    }
  }

  /**
   * Format test results for storage
   */
  private formatTestResults(results: VendorTestResult[]): any {
    const formatted: any = {};

    for (const result of results) {
      const key = result.testType.replace('_', '') + 'Test';
      formatted[this.toCamelCase(result.testType)] = result;
    }

    return formatted;
  }

  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
  }

  private createEmptyChecks(): CertificationChecks {
    return {
      documentationComplete: false,
      complianceStatementsValid: false,
      deploymentHistoryValid: false,
      phiExposureTest: false,
      clinicalAccuracyTest: false,
      biasDetectionTest: false,
      securityScanTest: false
    };
  }
}
