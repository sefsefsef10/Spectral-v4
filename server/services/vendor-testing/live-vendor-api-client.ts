/**
 * Live Vendor API Integration for Certification Pipeline
 * 
 * Connects to real AI observability platforms during certification testing
 * to validate AI systems against clinical datasets using their production APIs
 */

import { logger } from '../../logger';
import type { ClinicalTestCase } from '../clinical-validation/datasets';

export interface VendorAPICredentials {
  platform: 'langsmith' | 'arize' | 'langfuse' | 'wandb';
  apiKey: string;
  projectId?: string;
  endpoint?: string;
}

export interface VendorTestResult {
  testCaseId: string;
  platform: string;
  prediction: string;
  confidence: number;
  latencyMs: number;
  success: boolean;
  error?: string;
  rawResponse?: any;
}

/**
 * LangSmith API Client
 */
export class LangSmithAPIClient {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string, endpoint?: string) {
    this.apiKey = apiKey;
    this.baseURL = endpoint || 'https://api.smith.langchain.com';
  }

  async runClinicalTest(testCase: ClinicalTestCase, modelName: string): Promise<VendorTestResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseURL}/v1/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          name: `clinical-test-${testCase.id}`,
          run_type: 'chain',
          inputs: {
            scenario: testCase.scenario,
            specialty: testCase.specialty,
          },
          extra: {
            model: modelName,
            test_case_id: testCase.id,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`LangSmith API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const latencyMs = Date.now() - startTime;

      return {
        testCaseId: testCase.id,
        platform: 'langsmith',
        prediction: data.outputs?.diagnosis || '',
        confidence: data.outputs?.confidence || 0,
        latencyMs,
        success: true,
        rawResponse: data,
      };
    } catch (error) {
      logger.error({ error, testCaseId: testCase.id }, 'LangSmith API test failed');
      return {
        testCaseId: testCase.id,
        platform: 'langsmith',
        prediction: '',
        confidence: 0,
        latencyMs: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Arize AI API Client
 */
export class ArizeAPIClient {
  private apiKey: string;
  private spaceId: string;
  private baseURL: string;

  constructor(apiKey: string, spaceId: string, endpoint?: string) {
    this.apiKey = apiKey;
    this.spaceId = spaceId;
    this.baseURL = endpoint || 'https://api.arize.com/v1';
  }

  async runClinicalTest(testCase: ClinicalTestCase, modelName: string): Promise<VendorTestResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseURL}/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          space_id: this.spaceId,
          model_id: modelName,
          model_version: '1.0',
          prediction_id: `clinical-${testCase.id}-${Date.now()}`,
          features: {
            scenario: testCase.scenario,
            specialty: testCase.specialty,
            difficulty: testCase.difficulty,
          },
          prediction_label: '', // Will be filled by model
          actual_label: testCase.groundTruth.diagnosis,
        }),
      });

      if (!response.ok) {
        throw new Error(`Arize API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const latencyMs = Date.now() - startTime;

      return {
        testCaseId: testCase.id,
        platform: 'arize',
        prediction: data.prediction || '',
        confidence: data.confidence || 0,
        latencyMs,
        success: true,
        rawResponse: data,
      };
    } catch (error) {
      logger.error({ error, testCaseId: testCase.id }, 'Arize API test failed');
      return {
        testCaseId: testCase.id,
        platform: 'arize',
        prediction: '',
        confidence: 0,
        latencyMs: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * LangFuse API Client
 */
export class LangFuseAPIClient {
  private publicKey: string;
  private secretKey: string;
  private baseURL: string;

  constructor(publicKey: string, secretKey: string, endpoint?: string) {
    this.publicKey = publicKey;
    this.secretKey = secretKey;
    this.baseURL = endpoint || 'https://cloud.langfuse.com';
  }

  async runClinicalTest(testCase: ClinicalTestCase, modelName: string): Promise<VendorTestResult> {
    const startTime = Date.now();
    
    try {
      const auth = Buffer.from(`${this.publicKey}:${this.secretKey}`).toString('base64');
      
      const response = await fetch(`${this.baseURL}/api/public/traces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`,
        },
        body: JSON.stringify({
          name: `clinical-test-${testCase.id}`,
          metadata: {
            test_case_id: testCase.id,
            specialty: testCase.specialty,
            difficulty: testCase.difficulty,
          },
          input: {
            scenario: testCase.scenario,
          },
          model: modelName,
        }),
      });

      if (!response.ok) {
        throw new Error(`LangFuse API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const latencyMs = Date.now() - startTime;

      return {
        testCaseId: testCase.id,
        platform: 'langfuse',
        prediction: data.output?.diagnosis || '',
        confidence: data.output?.confidence || 0,
        latencyMs,
        success: true,
        rawResponse: data,
      };
    } catch (error) {
      logger.error({ error, testCaseId: testCase.id }, 'LangFuse API test failed');
      return {
        testCaseId: testCase.id,
        platform: 'langfuse',
        prediction: '',
        confidence: 0,
        latencyMs: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Weights & Biases API Client
 */
export class WandBAPIClient {
  private apiKey: string;
  private entity: string;
  private project: string;
  private baseURL: string;

  constructor(apiKey: string, entity: string, project: string, endpoint?: string) {
    this.apiKey = apiKey;
    this.entity = entity;
    this.project = project;
    this.baseURL = endpoint || 'https://api.wandb.ai';
  }

  async runClinicalTest(testCase: ClinicalTestCase, modelName: string): Promise<VendorTestResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseURL}/api/v1/runs/${this.entity}/${this.project}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          name: `clinical-test-${testCase.id}`,
          config: {
            model: modelName,
            test_case_id: testCase.id,
            specialty: testCase.specialty,
            difficulty: testCase.difficulty,
          },
          summary: {
            scenario: testCase.scenario,
            ground_truth: testCase.groundTruth.diagnosis,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`W&B API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const latencyMs = Date.now() - startTime;

      return {
        testCaseId: testCase.id,
        platform: 'wandb',
        prediction: data.summary?.prediction || '',
        confidence: data.summary?.confidence || 0,
        latencyMs,
        success: true,
        rawResponse: data,
      };
    } catch (error) {
      logger.error({ error, testCaseId: testCase.id }, 'W&B API test failed');
      return {
        testCaseId: testCase.id,
        platform: 'wandb',
        prediction: '',
        confidence: 0,
        latencyMs: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Unified Vendor API Client Factory
 */
export class VendorAPIClientFactory {
  static createClient(credentials: VendorAPICredentials) {
    switch (credentials.platform) {
      case 'langsmith':
        return new LangSmithAPIClient(credentials.apiKey, credentials.endpoint);
      
      case 'arize':
        if (!credentials.projectId) {
          throw new Error('Arize requires projectId (spaceId)');
        }
        return new ArizeAPIClient(credentials.apiKey, credentials.projectId, credentials.endpoint);
      
      case 'langfuse':
        // LangFuse uses public/secret key pair - parse from apiKey (format: "public:secret")
        const [publicKey, secretKey] = credentials.apiKey.split(':');
        if (!publicKey || !secretKey) {
          throw new Error('LangFuse requires apiKey in format "publicKey:secretKey"');
        }
        return new LangFuseAPIClient(publicKey, secretKey, credentials.endpoint);
      
      case 'wandb':
        if (!credentials.projectId) {
          throw new Error('W&B requires projectId (format: "entity/project")');
        }
        const [entity, project] = credentials.projectId.split('/');
        if (!entity || !project) {
          throw new Error('W&B projectId must be in format "entity/project"');
        }
        return new WandBAPIClient(credentials.apiKey, entity, project, credentials.endpoint);
      
      default:
        throw new Error(`Unsupported platform: ${credentials.platform}`);
    }
  }

  static async runBatchClinicalTests(
    credentials: VendorAPICredentials,
    testCases: ClinicalTestCase[],
    modelName: string
  ): Promise<VendorTestResult[]> {
    const client = this.createClient(credentials);
    const results: VendorTestResult[] = [];

    for (const testCase of testCases) {
      const result = await (client as any).runClinicalTest(testCase, modelName);
      results.push(result);
      
      // Rate limiting: 100ms delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }
}
