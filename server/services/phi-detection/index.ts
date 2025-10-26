import { spawn } from 'child_process';
import { logger } from '../../logger';
import path from 'path';

export interface PHIEntity {
  type: string;
  start: number;
  end: number;
  score: number;
  text: string;
}

export interface PHIDetectionResult {
  has_phi: boolean;
  phi_count: number;
  entities: PHIEntity[];
  risk_score: number;
  anonymized_text: string;
  threshold_used: number;
}

export interface PHIDetectionOptions {
  language?: string;
  threshold?: number;
}

export class PHIDetectionService {
  private pythonScriptPath: string;

  constructor() {
    this.pythonScriptPath = path.join(__dirname, 'presidio-service.py');
  }

  private async runPythonScript(input: object): Promise<string> {
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
          reject(new Error(`Python script exited with code ${code}: ${stderr}`));
        } else {
          if (stderr && !stderr.includes('FutureWarning')) {
            logger.warn({ stderr }, 'PHI detection stderr output');
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

  async detectPHI(
    text: string,
    options: PHIDetectionOptions = {}
  ): Promise<PHIDetectionResult> {
    const { language = 'en', threshold = 0.5 } = options;

    try {
      const input = {
        text,
        language,
        threshold,
      };

      const stdout = await this.runPythonScript(input);
      const result = JSON.parse(stdout);

      if (result.error) {
        throw new Error(`PHI detection error: ${result.error}`);
      }

      logger.info(
        {
          has_phi: result.has_phi,
          phi_count: result.phi_count,
          risk_score: result.risk_score,
        },
        'PHI detection complete'
      );

      return result;
    } catch (error) {
      logger.error({ err: error }, 'PHI detection failed');
      throw new Error(`Failed to detect PHI: ${error}`);
    }
  }

  async detectPHIBatch(
    texts: string[],
    options: PHIDetectionOptions = {}
  ): Promise<PHIDetectionResult[]> {
    const { language = 'en', threshold = 0.5 } = options;

    try {
      const input = {
        texts,
        language,
        threshold,
      };

      const stdout = await this.runPythonScript(input);
      const results = JSON.parse(stdout);

      if (Array.isArray(results) && results[0]?.error) {
        throw new Error(`PHI detection error: ${results[0].error}`);
      }

      logger.info(
        { batch_size: texts.length },
        'PHI detection batch complete'
      );

      return results;
    } catch (error) {
      logger.error({ err: error }, 'PHI detection batch failed');
      throw new Error(`Failed to detect PHI in batch: ${error}`);
    }
  }

  async scanAIOutput(aiSystemId: string, output: string): Promise<{
    passed: boolean;
    phi_detected: boolean;
    details: PHIDetectionResult;
  }> {
    logger.info({ aiSystemId }, 'Scanning AI output for PHI');

    const result = await this.detectPHI(output, { threshold: 0.5 });

    return {
      passed: !result.has_phi,
      phi_detected: result.has_phi,
      details: result,
    };
  }
}

export const phiDetectionService = new PHIDetectionService();
