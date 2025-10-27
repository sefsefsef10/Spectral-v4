/**
 * Clinical Accuracy Test Module
 * 
 * Validates AI predictions against ground truth medical datasets
 * Tests diagnostic accuracy, treatment recommendations, risk assessments
 * 
 * **PRODUCTION VERSION** - Actually calls vendor's API endpoint
 * Uses evidence-based clinical datasets with structured validation
 */

import { logger } from "../../logger";
import { storage } from "../../storage";
import { clinicalValidationDataset, getRandomSample } from "../clinical-validation/datasets";
import { clinicalValidator } from "../clinical-validation/validator";
import { VendorAPIClientFactory, type VendorAPICredentials } from "./live-vendor-api-client";
import type { TestSuiteConfig } from "./testing-suite";

interface ClinicalAccuracyTestResult {
  passed: boolean;
  score: number;
  details: {
    testsRun: number;
    correct: number;
    incorrect: number;
    accuracy: number;
    cases: Array<{
      scenario: string;
      expected: string;
      actual: string;
      correct: boolean;
    }>;
  };
}

class ClinicalAccuracyTest {
  async run(config: TestSuiteConfig): Promise<ClinicalAccuracyTestResult> {
    logger.info({ applicationId: config.applicationId }, "Starting clinical accuracy test");

    const startedAt = new Date();
    
    // Create test result record in database
    const testResult = await storage.createVendorTestResult({
      applicationId: config.applicationId,
      vendorId: config.vendorId,
      testType: "clinical_accuracy",
      status: "running",
      startedAt,
    });

    try {
      // Validate API endpoint is configured
      if (!config.aiSystemEndpoint) {
        logger.warn({ applicationId: config.applicationId }, "No API endpoint configured - failing test");
        
        await storage.updateVendorTestResult(testResult.id, {
          status: "error",
          passed: false,
          score: 0,
          errorMessage: "No API endpoint configured for testing",
          completedAt: new Date(),
          details: { error: "API endpoint required for clinical accuracy testing" },
        });
        
        return {
          passed: false,
          score: 0,
          details: {
            testsRun: 0,
            correct: 0,
            incorrect: 0,
            accuracy: 0,
            cases: [],
          },
        };
      }

      // Use production clinical validation datasets (random sample of 10 cases)
      const testCases = getRandomSample(10);
      
      // Try live vendor API integration if credentials provided
      let results;
      if (config.vendorPlatformCredentials) {
        logger.info({ platform: config.vendorPlatformCredentials.platform }, 'Using live vendor API integration');
        results = await this.runVendorAPITests(testCases, config);
      } else {
        logger.info('Using direct API endpoint testing');
        results = await this.runTestCases(testCases, config);
      }

      const correct = results.filter(r => r.correct).length;
      const incorrect = results.filter(r => !r.correct).length;
      const accuracy = (correct / results.length) * 100;
      
      // Must achieve 75% accuracy to pass (matching validator threshold)
      const passed = accuracy >= 75;
      const score = Math.round(accuracy);

      // Store test result in database
      await storage.updateVendorTestResult(testResult.id, {
        status: passed ? "passed" : "failed",
        passed,
        score,
        completedAt: new Date(),
        details: {
          testsRun: testCases.length,
          correct,
          incorrect,
          accuracy,
          cases: results.slice(0, 5), // Store up to 5 sample cases
        },
      });

      logger.info({ score, passed, accuracy, correct, incorrect }, `Clinical accuracy test complete: ${passed ? 'PASSED' : 'FAILED'}`);

      return {
        passed,
        score,
        details: {
          testsRun: testCases.length,
          correct,
          incorrect,
          accuracy,
          cases: results,
        },
      };
    } catch (error) {
      // Update test result with error status
      await storage.updateVendorTestResult(testResult.id, {
        status: "error",
        passed: false,
        score: 0,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date(),
      });
      
      throw error;
    }
  }

  /**
   * Run test cases against vendor AI system using clinical validator
   * Actually calls vendor's API endpoint
   */
  private async runTestCases(testCases: any[], config: TestSuiteConfig) {
    const results: Array<{ scenario: string; expected: string; actual: string; correct: boolean }> = [];

    for (const tc of testCases) {
      try {
        const actual = await this.callVendorAPI(config.aiSystemEndpoint!, tc.scenario, config.apiKey);
        
        // Use clinical validator for evidence-based assessment
        const validationResult = clinicalValidator.validateResponse(tc, actual);
        
        results.push({
          scenario: tc.scenario,
          expected: tc.groundTruth.diagnosis + ': ' + tc.groundTruth.recommendedAction,
          actual,
          correct: validationResult.correct,
        });
      } catch (error) {
        logger.error({ err: error, scenario: tc.scenario }, "Failed to call vendor API for clinical test");
        results.push({
          scenario: tc.scenario,
          expected: tc.groundTruth?.diagnosis || 'Unknown',
          actual: "API call failed",
          correct: false,
        });
      }
    }

    return results;
  }

  /**
   * Run tests using live vendor API integration (LangSmith, Arize, LangFuse, W&B)
   */
  private async runVendorAPITests(testCases: any[], config: TestSuiteConfig) {
    const results: Array<{ scenario: string; expected: string; actual: string; correct: boolean }> = [];

    if (!config.vendorPlatformCredentials) {
      throw new Error('Vendor platform credentials required for live API testing');
    }

    try {
      const vendorResults = await VendorAPIClientFactory.runBatchClinicalTests(
        config.vendorPlatformCredentials,
        testCases,
        config.aiSystemEndpoint || 'default-model'
      );

      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        const vendorResult = vendorResults[i];

        if (vendorResult.success && vendorResult.prediction) {
          // Use clinical validator for evidence-based assessment
          const validationResult = clinicalValidator.validateResponse(tc, vendorResult.prediction);
          
          results.push({
            scenario: tc.scenario,
            expected: tc.groundTruth.diagnosis + ': ' + tc.groundTruth.recommendedAction,
            actual: vendorResult.prediction,
            correct: validationResult.correct,
          });
        } else {
          results.push({
            scenario: tc.scenario,
            expected: tc.groundTruth?.diagnosis || 'Unknown',
            actual: vendorResult.error || "API call failed",
            correct: false,
          });
        }
      }

      return results;
    } catch (error) {
      logger.error({ err: error }, "Failed to run vendor API tests");
      throw error;
    }
  }

  /**
   * Call vendor's AI API endpoint
   */
  private async callVendorAPI(endpoint: string, prompt: string, apiKey?: string): Promise<string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt, max_tokens: 500 }),
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.output || data.text || data.response || data.completion || JSON.stringify(data);
    } catch (error) {
      logger.error({ err: error, endpoint }, "Vendor API call failed");
      throw error;
    }
  }

}

export const clinicalAccuracyTest = new ClinicalAccuracyTest();
