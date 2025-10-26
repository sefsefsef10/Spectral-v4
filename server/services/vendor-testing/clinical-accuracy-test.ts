/**
 * Clinical Accuracy Test Module
 * 
 * Validates AI predictions against ground truth medical datasets
 * Tests diagnostic accuracy, treatment recommendations, risk assessments
 * 
 * **PRODUCTION VERSION** - Actually calls vendor's API endpoint
 */

import { logger } from "../../logger";
import { storage } from "../../storage";
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

      // Test cases with known ground truth
      const testCases = this.generateTestCases();
      const results = await this.runTestCases(testCases, config);

      const correct = results.filter(r => r.correct).length;
      const incorrect = results.filter(r => !r.correct).length;
      const accuracy = (correct / results.length) * 100;
      
      // Must achieve 90% accuracy to pass
      const passed = accuracy >= 90;
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
   * Generate test cases with known ground truth
   * In production, these would be validated medical scenarios
   */
  private generateTestCases() {
    return [
      {
        scenario: "Patient with fever 102°F, productive cough, body aches",
        expected: "Likely viral respiratory infection - recommend rest and fluids",
        expectedKeywords: ["viral", "respiratory", "infection", "rest"],
      },
      {
        scenario: "Blood pressure 180/110 on two separate occasions",
        expected: "Hypertension - requires immediate intervention",
        expectedKeywords: ["hypertension", "high", "blood pressure", "immediate"],
      },
      {
        scenario: "Fasting glucose 126 mg/dL, HbA1c 6.8%",
        expected: "Type 2 diabetes - requires treatment and lifestyle modification",
        expectedKeywords: ["diabetes", "glucose", "treatment", "lifestyle"],
      },
      {
        scenario: "Severe chest pain radiating to left arm, shortness of breath",
        expected: "Possible cardiac event - emergency medical attention required",
        expectedKeywords: ["cardiac", "heart", "emergency", "chest pain"],
      },
      {
        scenario: "Gradual memory loss, confusion, difficulty with daily tasks",
        expected: "Possible cognitive decline - comprehensive evaluation recommended",
        expectedKeywords: ["cognitive", "memory", "evaluation", "dementia"],
      },
    ];
  }

  /**
   * Run test cases against vendor AI system
   * Actually calls vendor's API endpoint
   */
  private async runTestCases(testCases: any[], config: TestSuiteConfig) {
    const results: Array<{ scenario: string; expected: string; actual: string; correct: boolean }> = [];

    for (const tc of testCases) {
      try {
        const actual = await this.callVendorAPI(config.aiSystemEndpoint!, tc.scenario, config.apiKey);
        
        // Check if response contains expected clinical keywords
        const correct = this.validateResponse(actual, tc.expectedKeywords);
        
        results.push({
          scenario: tc.scenario,
          expected: tc.expected,
          actual,
          correct,
        });
      } catch (error) {
        logger.error({ err: error, scenario: tc.scenario }, "Failed to call vendor API for clinical test");
        results.push({
          scenario: tc.scenario,
          expected: tc.expected,
          actual: "API call failed",
          correct: false,
        });
      }
    }

    return results;
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

  /**
   * Validate that response contains expected medical keywords
   */
  private validateResponse(response: string, expectedKeywords: string[]): boolean {
    const responseLower = response.toLowerCase();
    
    // Response must contain at least 2 of the expected keywords to be considered correct
    const matchCount = expectedKeywords.filter(keyword => 
      responseLower.includes(keyword.toLowerCase())
    ).length;
    
    return matchCount >= 2;
  }
}

export const clinicalAccuracyTest = new ClinicalAccuracyTest();
