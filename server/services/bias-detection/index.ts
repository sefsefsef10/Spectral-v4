/**
 * Fairlearn-based Bias Detection Service
 * 
 * Integrates Microsoft's Fairlearn library for algorithmic fairness testing
 * Detects bias across protected demographic groups (race, gender, age)
 */

import { spawn } from 'child_process';
import path from 'path';
import { logger } from '../../logger';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface BiasMetrics {
  demographic_parity_difference: number;
  equalized_odds_difference: number;
  disparate_impact_ratio: number;
}

export interface BiasDetectionResult {
  bias_detected: boolean;
  severity: 'none' | 'low' | 'medium' | 'high';
  metrics: BiasMetrics;
  group_accuracies: Record<string, number>;
  overall_accuracy: number;
  positive_rates: Record<string, number>;
  recommendations: string[];
}

export interface BiasDetectionInput {
  predictions: number[]; // Binary predictions (0 or 1)
  labels: number[]; // Ground truth labels (0 or 1)
  sensitive_features: string[]; // Protected group membership
}

export class BiasDetectionService {
  private pythonScriptPath: string;

  constructor() {
    this.pythonScriptPath = path.join(__dirname, 'fairlearn-service.py');
  }

  private async runPythonScript(input: BiasDetectionInput): Promise<string> {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', [this.pythonScriptPath]);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Fairlearn script exited with code ${code}: ${stderr}`));
        } else {
          if (stderr && !stderr.includes('FutureWarning')) {
            logger.warn({ stderr }, 'Fairlearn detection stderr output');
          }
          resolve(stdout);
        }
      });
      
      python.on('error', (error) => {
        reject(error);
      });
      
      python.stdin.write(JSON.stringify(input));
      python.stdin.end();
    });
  }

  /**
   * Detect algorithmic bias using Fairlearn
   * 
   * @param input Predictions, labels, and protected group features
   * @returns Bias detection results with fairness metrics
   */
  async detectBias(input: BiasDetectionInput): Promise<BiasDetectionResult> {
    try {
      // Validate input
      if (input.predictions.length !== input.labels.length || 
          input.predictions.length !== input.sensitive_features.length) {
        throw new Error('Predictions, labels, and sensitive features must have same length');
      }

      const stdout = await this.runPythonScript(input);
      const result = JSON.parse(stdout);

      if (result.error) {
        throw new Error(`Fairlearn bias detection error: ${result.error}`);
      }

      logger.info(
        {
          bias_detected: result.bias_detected,
          severity: result.severity,
          metrics: result.metrics,
        },
        'Bias detection complete'
      );

      return result;
    } catch (error) {
      logger.error({ err: error }, 'Fairlearn bias detection failed');
      throw new Error(`Failed to detect bias: ${error}`);
    }
  }

  /**
   * Batch bias detection for multiple test scenarios
   */
  async detectBiasBatch(
    scenarios: BiasDetectionInput[]
  ): Promise<BiasDetectionResult[]> {
    const results: BiasDetectionResult[] = [];
    
    for (const scenario of scenarios) {
      try {
        const result = await this.detectBias(scenario);
        results.push(result);
      } catch (error) {
        logger.error({ err: error }, 'Batch bias detection failed for scenario');
        // Continue with other scenarios
        results.push({
          bias_detected: true,
          severity: 'high',
          metrics: {
            demographic_parity_difference: 1.0,
            equalized_odds_difference: 1.0,
            disparate_impact_ratio: 0.0,
          },
          group_accuracies: {},
          overall_accuracy: 0,
          positive_rates: {},
          recommendations: ['Bias detection failed - manual review required'],
        });
      }
    }
    
    return results;
  }
}

// Singleton instance
export const biasDetectionService = new BiasDetectionService();
