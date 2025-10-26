/**
 * Security Scan Test Module
 * 
 * Penetration testing for vendor AI systems
 * Tests: Input validation, rate limiting, authentication, injection attacks
 * 
 * **PRODUCTION VERSION** - Actually calls vendor's API endpoint
 */

import { logger } from "../../logger";
import { storage } from "../../storage";
import type { TestSuiteConfig } from "./testing-suite";

interface SecurityTestResult {
  passed: boolean;
  score: number;
  details: {
    testsRun: number;
    vulnerabilities: Array<{
      type: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      description: string;
      remediation: string;
    }>;
    categories: {
      inputValidation: boolean;
      rateLimiting: boolean;
      authentication: boolean;
      encryption: boolean;
    };
  };
}

class SecurityScanTest {
  async run(config: TestSuiteConfig): Promise<SecurityTestResult> {
    logger.info({ applicationId: config.applicationId }, "Starting security scan test");

    const startedAt = new Date();
    
    // Create test result record in database
    const testResult = await storage.createVendorTestResult({
      applicationId: config.applicationId,
      vendorId: config.vendorId,
      testType: "security_scan",
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
          details: { error: "API endpoint required for security testing" },
        });
        
        return {
          passed: false,
          score: 0,
          details: {
            testsRun: 0,
            vulnerabilities: [],
            categories: {
              inputValidation: false,
              rateLimiting: false,
              authentication: false,
              encryption: false,
            },
          },
        };
      }

      const vulnerabilities: Array<{ type: string; severity: 'critical' | 'high' | 'medium' | 'low'; description: string; remediation: string }> = [];

      // Run security tests
      const inputValidation = await this.testInputValidation(config);
      const rateLimiting = await this.testRateLimiting(config);
      const authentication = await this.testAuthentication(config);
      const encryption = await this.testEncryption(config);

      // Collect vulnerabilities
      if (!inputValidation.passed) vulnerabilities.push(...inputValidation.vulnerabilities);
      if (!rateLimiting.passed) vulnerabilities.push(...rateLimiting.vulnerabilities);
      if (!authentication.passed) vulnerabilities.push(...authentication.vulnerabilities);
      if (!encryption.passed) vulnerabilities.push(...encryption.vulnerabilities);

      // Calculate score based on vulnerabilities
      const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical').length;
      const highVulns = vulnerabilities.filter(v => v.severity === 'high').length;
      const mediumVulns = vulnerabilities.filter(v => v.severity === 'medium').length;
      
      const score = Math.max(0, 100 - (criticalVulns * 30) - (highVulns * 15) - (mediumVulns * 5));
      const passed = criticalVulns === 0 && score >= 80; // No critical vulns and 80%+ score to pass

      // Store test result in database
      await storage.updateVendorTestResult(testResult.id, {
        status: passed ? "passed" : "failed",
        passed,
        score,
        completedAt: new Date(),
        details: {
          testsRun: 12,
          vulnerabilities: vulnerabilities.slice(0, 10), // Store up to 10 vulnerabilities
          categories: {
            inputValidation: inputValidation.passed,
            rateLimiting: rateLimiting.passed,
            authentication: authentication.passed,
            encryption: encryption.passed,
          },
        },
      });

      logger.info({ score, passed, vulnerabilities: vulnerabilities.length }, `Security scan test complete: ${passed ? 'PASSED' : 'FAILED'}`);

      return {
        passed,
        score,
        details: {
          testsRun: 12,
          vulnerabilities,
          categories: {
            inputValidation: inputValidation.passed,
            rateLimiting: rateLimiting.passed,
            authentication: authentication.passed,
            encryption: encryption.passed,
          },
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

  private async testInputValidation(config: TestSuiteConfig) {
    // Test SQL injection, XSS, command injection attacks
    const injectionAttempts = [
      "'; DROP TABLE users; --",
      "<script>alert('XSS')</script>",
      "../../etc/passwd",
    ];

    const vulnerabilities: Array<{ type: string; severity: 'critical' | 'high' | 'medium' | 'low'; description: string; remediation: string }> = [];

    for (const attempt of injectionAttempts) {
      try {
        const response = await this.callVendorAPI(config.aiSystemEndpoint!, attempt, config.apiKey);
        
        // Check if injection succeeded (response contains suspicious patterns)
        if (response.includes("DROP TABLE") || response.includes("alert(") || response.includes("/etc/passwd")) {
          vulnerabilities.push({
            type: "Input Validation",
            severity: "critical",
            description: "API accepts potentially malicious input without sanitization",
            remediation: "Implement input validation and sanitization for all user inputs",
          });
        }
      } catch (error) {
        // If API rejects malicious input, that's good
        logger.debug({ attempt }, "Input rejected (good)");
      }
    }

    return {
      passed: vulnerabilities.length === 0,
      vulnerabilities,
    };
  }

  private async testRateLimiting(config: TestSuiteConfig) {
    // Test if API enforces rate limiting
    const vulnerabilities: Array<{ type: string; severity: 'critical' | 'high' | 'medium' | 'low'; description: string; remediation: string }> = [];

    try {
      // Make rapid requests to test rate limiting
      const requests = Array(20).fill(null).map(() => 
        this.callVendorAPI(config.aiSystemEndpoint!, "test", config.apiKey).catch(() => null)
      );
      
      const responses = await Promise.all(requests);
      const successfulRequests = responses.filter(r => r !== null).length;

      // If all requests succeed, rate limiting may not be enforced
      if (successfulRequests >= 15) {
        vulnerabilities.push({
          type: "Rate Limiting",
          severity: "medium",
          description: "API may not enforce proper rate limiting",
          remediation: "Implement rate limiting to prevent abuse and DDoS attacks",
        });
      }
    } catch (error) {
      logger.error({ err: error }, "Rate limiting test failed");
    }

    return {
      passed: vulnerabilities.length === 0,
      vulnerabilities,
    };
  }

  private async testAuthentication(config: TestSuiteConfig) {
    // Test if API requires authentication
    const vulnerabilities: Array<{ type: string; severity: 'critical' | 'high' | 'medium' | 'low'; description: string; remediation: string }> = [];

    try {
      // Try calling API without credentials
      const response = await this.callVendorAPI(config.aiSystemEndpoint!, "test", undefined);
      
      // If call succeeds without auth, that's a vulnerability
      if (response) {
        vulnerabilities.push({
          type: "Authentication",
          severity: "high",
          description: "API does not require authentication",
          remediation: "Implement API key or token-based authentication",
        });
      }
    } catch (error) {
      // If API rejects unauthenticated requests, that's good
      logger.debug("Authentication required (good)");
    }

    return {
      passed: vulnerabilities.length === 0,
      vulnerabilities,
    };
  }

  private async testEncryption(config: TestSuiteConfig) {
    // Test if API uses HTTPS
    const vulnerabilities: Array<{ type: string; severity: 'critical' | 'high' | 'medium' | 'low'; description: string; remediation: string }> = [];

    if (!config.aiSystemEndpoint?.startsWith("https://")) {
      vulnerabilities.push({
        type: "Encryption",
        severity: "critical",
        description: "API does not use HTTPS encryption",
        remediation: "Enable HTTPS/TLS encryption for all API endpoints",
      });
    }

    return {
      passed: vulnerabilities.length === 0,
      vulnerabilities,
    };
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
        body: JSON.stringify({ prompt, max_tokens: 100 }),
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.output || data.text || data.response || data.completion || JSON.stringify(data);
    } catch (error) {
      throw error;
    }
  }
}

export const securityScanTest = new SecurityScanTest();
