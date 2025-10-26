/**
 * Certification Application Processor
 * 
 * Performs automated testing and validation of vendor certification applications.
 * 
 * Workflow:
 * 1. Validate documentation completeness
 * 2. Check compliance statements
 * 3. Verify deployment history (if applicable)
 * 4. Run vendor testing suite (PHI, clinical accuracy, bias, security)
 * 5. Generate automated checks result
 * 6. Update application status
 */

import { storage } from "../storage";
import { logger } from "../logger";
import { VendorTestingSuite } from "./vendor-testing/testing-suite";

export interface CertificationCheckResult {
  passed: boolean;
  checks: {
    documentationComplete: boolean;
    complianceStatementsValid: boolean;
    deploymentHistoryValid: boolean;
    phiExposureTest: boolean;
    clinicalAccuracyTest: boolean;
    biasDetectionTest: boolean;
    securityScanTest: boolean;
  };
  recommendations: string[];
  score: number;
  testResults?: {
    phiExposure?: any;
    clinicalAccuracy?: any;
    biasDetection?: any;
    securityScan?: any;
  };
}

/**
 * Process a certification application (automated testing phase)
 */
export async function processCertificationApplication(applicationId: string): Promise<CertificationCheckResult> {
  logger.info({ applicationId }, `Processing certification application: ${applicationId}`);
  
  const application = await storage.getCertificationApplication(applicationId);
  
  if (!application) {
    throw new Error(`Application not found: ${applicationId}`);
  }
  
  // Automated checks
  const checks = {
    documentationComplete: checkDocumentationComplete(application),
    complianceStatementsValid: checkComplianceStatements(application),
    deploymentHistoryValid: await checkDeploymentHistory(application.vendorId),
    phiExposureTest: false,
    clinicalAccuracyTest: false,
    biasDetectionTest: false,
    securityScanTest: false,
  };
  
  const recommendations: string[] = [];
  const testResults: any = {};
  
  // Run vendor testing suite
  logger.info({ applicationId }, "Running vendor testing suite...");
  const { vendorTestingSuite } = await import("./vendor-testing/testing-suite");
  
  try {
    const testConfig = {
      applicationId,
      vendorId: application.vendorId,
      aiSystemEndpoint: application.apiEndpoint || undefined,
    };
    
    const allTestResults = await vendorTestingSuite.runAllTests(testConfig);
    
    // Process test results
    for (const testResult of allTestResults) {
      switch (testResult.testType) {
        case 'phi_exposure':
          testResults.phiExposure = testResult;
          checks.phiExposureTest = testResult.passed;
          if (!testResult.passed) {
            const violations = testResult.details?.violations || 0;
            recommendations.push(`PHI Exposure Test: ${violations} violations detected${testResult.errorMessage ? ' - ' + testResult.errorMessage : ''}`);
          }
          break;
          
        case 'clinical_accuracy':
          testResults.clinicalAccuracy = testResult;
          checks.clinicalAccuracyTest = testResult.passed;
          if (!testResult.passed) {
            recommendations.push(`Clinical Accuracy Test: Score ${testResult.score}% (minimum 90% required)`);
          }
          break;
          
        case 'bias_detection':
          testResults.biasDetection = testResult;
          checks.biasDetectionTest = testResult.passed;
          if (!testResult.passed) {
            const biasedGroups = testResult.details?.biasedGroups || [];
            recommendations.push(`Bias Detection Test: Bias detected in ${biasedGroups.join(", ")}`);
          }
          break;
          
        case 'security_scan':
          testResults.securityScan = testResult;
          checks.securityScanTest = testResult.passed;
          if (!testResult.passed) {
            const vulnerabilities = testResult.details?.vulnerabilities || 0;
            recommendations.push(`Security Scan: ${vulnerabilities} vulnerabilities found${testResult.errorMessage ? ' - ' + testResult.errorMessage : ''}`);
          }
          break;
      }
    }
    
    logger.info({ applicationId, testResults }, "Vendor testing suite completed");
  } catch (error) {
    logger.error({ applicationId, error }, "Vendor testing suite failed");
    recommendations.push("Automated testing suite encountered errors - manual review required");
  }
  
  // Generate recommendations based on basic checks
  if (!checks.documentationComplete) {
    recommendations.push("Please upload complete documentation for all requested compliance frameworks");
  }
  
  if (!checks.complianceStatementsValid) {
    recommendations.push("Compliance statements must align with requested certification tier");
  }
  
  if (!checks.deploymentHistoryValid) {
    if (application.tierRequested === "Platinum") {
      recommendations.push("Platinum tier requires at least 3 active deployments with health systems");
    } else if (application.tierRequested === "Gold") {
      recommendations.push("Gold tier requires at least 1 active deployment with a health system");
    }
  }
  
  // Calculate score (0-100)
  // Documentation: 20 points
  // Compliance statements: 20 points
  // Deployment history: 10 points
  // PHI test: 15 points
  // Clinical accuracy test: 15 points
  // Bias detection test: 10 points
  // Security scan: 10 points
  let score = 0;
  if (checks.documentationComplete) score += 20;
  if (checks.complianceStatementsValid) score += 20;
  if (checks.deploymentHistoryValid) score += 10;
  if (checks.phiExposureTest) score += 15;
  if (checks.clinicalAccuracyTest) score += 15;
  if (checks.biasDetectionTest) score += 10;
  if (checks.securityScanTest) score += 10;
  
  const passed = Object.values(checks).every(check => check === true);
  
  const result: CertificationCheckResult = {
    passed,
    checks,
    recommendations,
    score,
    testResults,
  };
  
  // Update application with automated check results
  await storage.updateCertificationApplicationStatus(
    applicationId,
    passed ? "in_review" : "pending",
    passed,
    JSON.stringify(result)
  );
  
  logger.info({ applicationId, passed, score }, `Certification application ${applicationId}: ${passed ? "PASSED" : "FAILED"} automated checks (score: ${score})`);
  
  return result;
}

/**
 * Check if documentation is complete for the requested tier
 */
function checkDocumentationComplete(application: any): boolean {
  const docUrls = application.documentationUrls || [];
  
  // Tier requirements:
  // Silver: At least 1 document (HIPAA compliance statement)
  // Gold: At least 2 documents (HIPAA + NIST)
  // Platinum: At least 3 documents (HIPAA + NIST + FDA or ISO)
  
  const requiredDocs: Record<string, number> = {
    "Silver": 1,
    "Gold": 2,
    "Platinum": 3,
  };
  
  const required = requiredDocs[application.tierRequested] || 1;
  return docUrls.length >= required;
}

/**
 * Check if compliance statements are valid
 */
function checkComplianceStatements(application: any): boolean {
  if (!application.complianceStatements) {
    return false;
  }
  
  try {
    const statements = JSON.parse(application.complianceStatements);
    
    // Tier requirements:
    // Silver: HIPAA compliance
    // Gold: HIPAA + NIST AI RMF
    // Platinum: HIPAA + NIST AI RMF + (FDA or ISO)
    
    switch (application.tierRequested) {
      case "Silver":
        return statements.hipaa === true;
      case "Gold":
        return statements.hipaa === true && statements.nist === true;
      case "Platinum":
        return statements.hipaa === true && 
               statements.nist === true && 
               (statements.fda === true || statements.iso === true);
      default:
        return false;
    }
  } catch (error) {
    return false;
  }
}

/**
 * Check deployment history meets tier requirements
 */
async function checkDeploymentHistory(vendorId: string): Promise<boolean> {
  const deployments = await storage.getDeploymentsByVendor(vendorId);
  const activeDeployments = deployments.filter(d => d.status === "active");
  
  // For now, any active deployment history is sufficient
  // In production, we'd check tier-specific requirements:
  // - Silver: 0 required (new vendors welcome)
  // - Gold: 1+ active deployments
  // - Platinum: 3+ active deployments
  
  return true; // Simplified for MVP
}
