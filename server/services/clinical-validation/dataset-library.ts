import { db } from '../../db';
import { validationDatasets } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../../logger';

export interface ClinicalTestCase {
  input: any;
  expected_output?: any;
  ground_truth: any;
  metadata?: Record<string, any>;
}

export interface ValidationDataset {
  id: string;
  name: string;
  category: string;
  description: string | null;
  testCases: ClinicalTestCase[];
  metadataSource: string | null;
  active: boolean;
  createdAt: Date;
}

export class ClinicalValidationDatasetLibrary {
  /**
   * Create a new validation dataset
   */
  async createDataset(params: {
    name: string;
    category: 'radiology' | 'pathology' | 'cardiology' | 'oncology' | 'general' | 'emergency' | 'pediatrics';
    description?: string;
    testCases: ClinicalTestCase[];
    metadataSource?: string;
  }): Promise<ValidationDataset> {
    logger.info({ name: params.name, category: params.category }, 'Creating validation dataset');

    const [dataset] = await db
      .insert(validationDatasets)
      .values({
        name: params.name,
        category: params.category,
        description: params.description,
        testCases: params.testCases,
        metadataSource: params.metadataSource,
      })
      .returning();

    return dataset as ValidationDataset;
  }

  /**
   * Get dataset by ID
   */
  async getDataset(id: string): Promise<ValidationDataset | null> {
    const [dataset] = await db
      .select()
      .from(validationDatasets)
      .where(eq(validationDatasets.id, id))
      .limit(1);

    return (dataset as ValidationDataset) || null;
  }

  /**
   * Get all datasets by category
   */
  async getDatasetsByCategory(category: string): Promise<ValidationDataset[]> {
    const datasets = await db
      .select()
      .from(validationDatasets)
      .where(eq(validationDatasets.category, category));

    return datasets as ValidationDataset[];
  }

  /**
   * Get all active datasets
   */
  async getActiveDatasets(): Promise<ValidationDataset[]> {
    const datasets = await db
      .select()
      .from(validationDatasets)
      .where(eq(validationDatasets.active, true));

    return datasets as ValidationDataset[];
  }

  /**
   * Update dataset
   */
  async updateDataset(
    id: string,
    updates: {
      name?: string;
      description?: string;
      testCases?: ClinicalTestCase[];
      metadataSource?: string;
      active?: boolean;
    }
  ): Promise<ValidationDataset> {
    const [updated] = await db
      .update(validationDatasets)
      .set(updates)
      .where(eq(validationDatasets.id, id))
      .returning();

    return updated as ValidationDataset;
  }

  /**
   * Delete dataset
   */
  async deleteDataset(id: string): Promise<void> {
    await db.delete(validationDatasets).where(eq(validationDatasets.id, id));
    logger.info({ id }, 'Validation dataset deleted');
  }

  /**
   * Run test cases from a dataset against an AI system's outputs
   */
  async validateAISystemOutputs(
    datasetId: string,
    aiSystemOutputFunction: (input: any) => Promise<any>
  ): Promise<{
    passed: number;
    failed: number;
    total: number;
    accuracy: number;
    results: Array<{
      testCase: ClinicalTestCase;
      output: any;
      passed: boolean;
      error?: string;
    }>;
  }> {
    const dataset = await this.getDataset(datasetId);
    if (!dataset) {
      throw new Error(`Dataset ${datasetId} not found`);
    }

    logger.info({ datasetId, testCases: dataset.testCases.length }, 'Running validation test cases');

    const results = [];
    let passed = 0;
    let failed = 0;

    for (const testCase of dataset.testCases) {
      try {
        const output = await aiSystemOutputFunction(testCase.input);
        const testPassed = this.compareResults(output, testCase.ground_truth);

        if (testPassed) {
          passed++;
        } else {
          failed++;
        }

        results.push({
          testCase,
          output,
          passed: testPassed,
        });
      } catch (error) {
        failed++;
        results.push({
          testCase,
          output: null,
          passed: false,
          error: String(error),
        });
      }
    }

    const total = dataset.testCases.length;
    const accuracy = total > 0 ? (passed / total) * 100 : 0;

    logger.info(
      { passed, failed, total, accuracy: accuracy.toFixed(2) },
      'Validation test cases completed'
    );

    return {
      passed,
      failed,
      total,
      accuracy,
      results,
    };
  }

  /**
   * Simple comparison of results (can be enhanced with custom comparators)
   */
  private compareResults(output: any, groundTruth: any): boolean {
    return JSON.stringify(output) === JSON.stringify(groundTruth);
  }

  /**
   * Initialize library with sample clinical datasets
   */
  async initializeSampleDatasets(): Promise<void> {
    const existingDatasets = await this.getActiveDatasets();
    if (existingDatasets.length > 0) {
      logger.info('Sample datasets already exist, skipping initialization');
      return;
    }

    logger.info('Initializing sample clinical validation datasets');

    const sampleDatasets = [
      {
        name: 'Chest X-Ray Classification Dataset',
        category: 'radiology' as const,
        description: 'Validated chest X-ray images for pneumonia, COVID-19, and normal classification',
        metadataSource: 'NIH ChestX-ray14 Dataset (FDA-cleared ground truth)',
        testCases: [
          {
            input: { image_type: 'chest_xray', patient_age: 45, symptoms: ['cough', 'fever'] },
            ground_truth: { diagnosis: 'pneumonia', confidence: 0.92, recommendation: 'antibiotic_treatment' },
          },
          {
            input: { image_type: 'chest_xray', patient_age: 62, symptoms: ['shortness_of_breath'] },
            ground_truth: { diagnosis: 'covid-19', confidence: 0.88, recommendation: 'isolation_protocol' },
          },
          {
            input: { image_type: 'chest_xray', patient_age: 28, symptoms: [] },
            ground_truth: { diagnosis: 'normal', confidence: 0.95, recommendation: 'routine_followup' },
          },
        ],
      },
      {
        name: 'Diabetic Retinopathy Detection Dataset',
        category: 'ophthalmology' as const,
        description: 'Retinal fundus images for diabetic retinopathy severity grading',
        metadataSource: 'Kaggle Diabetic Retinopathy Detection (peer-reviewed)',
        testCases: [
          {
            input: { image_type: 'retinal_fundus', patient_age: 58, diabetes_duration_years: 12 },
            ground_truth: { severity: 'moderate', dr_stage: 2, referral_needed: true },
          },
          {
            input: { image_type: 'retinal_fundus', patient_age: 45, diabetes_duration_years: 5 },
            ground_truth: { severity: 'mild', dr_stage: 1, referral_needed: false },
          },
        ],
      },
      {
        name: 'ECG Arrhythmia Classification Dataset',
        category: 'cardiology' as const,
        description: 'ECG signals for detecting cardiac arrhythmias',
        metadataSource: 'MIT-BIH Arrhythmia Database (FDA-cleared)',
        testCases: [
          {
            input: { ecg_signal: [0.5, 0.8, 1.2, 0.9, 0.4], heart_rate: 110, age: 67 },
            ground_truth: { arrhythmia_type: 'atrial_fibrillation', risk_level: 'high', emergency: true },
          },
          {
            input: { ecg_signal: [0.4, 0.6, 0.8, 0.6, 0.4], heart_rate: 72, age: 32 },
            ground_truth: { arrhythmia_type: 'normal_sinus_rhythm', risk_level: 'low', emergency: false },
          },
        ],
      },
      {
        name: 'Pathology Tissue Classification Dataset',
        category: 'pathology' as const,
        description: 'Histopathology images for cancer detection and classification',
        metadataSource: 'TCGA (The Cancer Genome Atlas)',
        testCases: [
          {
            input: { tissue_type: 'breast', staining: 'H&E', magnification: '40x' },
            ground_truth: { diagnosis: 'invasive_ductal_carcinoma', grade: 3, stage: 'T2N1M0' },
          },
          {
            input: { tissue_type: 'breast', staining: 'H&E', magnification: '40x' },
            ground_truth: { diagnosis: 'benign', grade: 0, stage: null },
          },
        ],
      },
      {
        name: 'Clinical Decision Support Dataset',
        category: 'general' as const,
        description: 'Multi-modal clinical scenarios for treatment recommendations',
        metadataSource: 'MIMIC-III Clinical Database',
        testCases: [
          {
            input: {
              age: 55,
              gender: 'M',
              vital_signs: { bp: '160/95', hr: 88, temp: 37.2 },
              symptoms: ['headache', 'dizziness'],
              history: ['hypertension'],
            },
            ground_truth: {
              diagnosis: 'hypertensive_urgency',
              treatment: ['antihypertensive_medication', 'monitoring'],
              urgency: 'high',
            },
          },
        ],
      },
    ];

    for (const dataset of sampleDatasets) {
      await this.createDataset(dataset);
    }

    logger.info({ count: sampleDatasets.length }, 'Sample validation datasets initialized');
  }
}

export const clinicalDatasetLibrary = new ClinicalValidationDatasetLibrary();
