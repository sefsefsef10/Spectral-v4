import { spawn } from "child_process";
import { join } from "path";
import type { Logger } from "pino";

export interface BiasTestResult {
  overall_metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
  };
  bias_metrics: Record<string, {
    demographic_parity_difference: number;
    demographic_parity_ratio: number;
    equalized_odds_difference: number;
    equalized_odds_ratio: number;
  }>;
  group_metrics: Record<string, Record<string, {
    accuracy: number;
    precision: number;
    recall: number;
  }>>;
  bias_detected: boolean;
  violations: Array<{
    feature: string;
    metric: string;
    value: number;
    threshold: number;
    severity: "high" | "medium" | "low";
    description: string;
  }>;
}

export interface DisparateImpactResult {
  disparate_impact_ratio: number;
  privileged_positive_rate: number;
  unprivileged_positive_rate: number;
  passes_four_fifths_rule: boolean;
  bias_detected: boolean;
  severity: "none" | "low" | "medium" | "high";
}

export interface BiasTestOptions {
  threshold?: number;
}

export class BiasTestingService {
  private pythonScript: string;
  private logger?: Logger;

  constructor(logger?: Logger) {
    this.pythonScript = join(__dirname, "fairlearn-service.py");
    this.logger = logger;
  }

  async analyzeBias(
    predictions: number[],
    groundTruth: number[],
    sensitiveFeatures: Record<string, any[]>,
    options: BiasTestOptions = {}
  ): Promise<BiasTestResult> {
    const input = {
      operation: "analyze_bias",
      predictions,
      ground_truth: groundTruth,
      sensitive_features: sensitiveFeatures,
      threshold: options.threshold ?? 0.8
    };

    const result = await this.executePython(input);
    
    if (result.error) {
      throw new Error(`Bias analysis failed: ${result.error}`);
    }

    return result as BiasTestResult;
  }

  async calculateDisparateImpact(
    predictions: number[],
    sensitiveFeature: any[],
    privilegedGroup: any
  ): Promise<DisparateImpactResult> {
    const input = {
      operation: "disparate_impact",
      predictions,
      sensitive_feature: sensitiveFeature,
      privileged_group: privilegedGroup
    };

    const result = await this.executePython(input);
    
    if (result.error) {
      throw new Error(`Disparate impact calculation failed: ${result.error}`);
    }

    return result as DisparateImpactResult;
  }

  async testAISystemBias(
    aiSystemId: string,
    testData: {
      predictions: number[];
      groundTruth: number[];
      sensitiveFeatures: Record<string, any[]>;
    },
    options: BiasTestOptions = {}
  ): Promise<BiasTestResult & { ai_system_id: string }> {
    this.logger?.info({ aiSystemId }, "Testing AI system for bias");

    const result = await this.analyzeBias(
      testData.predictions,
      testData.groundTruth,
      testData.sensitiveFeatures,
      options
    );

    return {
      ...result,
      ai_system_id: aiSystemId
    };
  }

  private executePython(input: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const process = spawn("python3", [this.pythonScript, JSON.stringify(input)]);
      
      let stdout = "";
      let stderr = "";

      process.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      process.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      process.on("close", (code) => {
        if (code !== 0) {
          this.logger?.error({ code, stderr }, "Python bias testing process failed");
          reject(new Error(`Bias testing process exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          this.logger?.error({ error, stdout }, "Failed to parse bias testing output");
          reject(new Error(`Failed to parse output: ${error}`));
        }
      });

      process.on("error", (error) => {
        this.logger?.error({ error }, "Failed to spawn bias testing process");
        reject(error);
      });
    });
  }
}

export const biasTestingService = new BiasTestingService();
