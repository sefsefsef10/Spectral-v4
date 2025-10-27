/**
 * Clinical Validation Datasets for AI Vendor Testing
 * 
 * These datasets represent real-world clinical scenarios used to validate
 * AI systems during the Beacon certification process. They cover:
 * - Clinical accuracy testing
 * - Bias detection across demographics
 * - PHI exposure risk
 * - Edge case handling
 */

export const clinicalValidationDatasets = {
  // Dataset 1: Sepsis Prediction Model
  sepsisPrediction: {
    name: 'Sepsis Early Warning System',
    vendor: 'Epic Systems',
    category: 'Clinical Decision Support',
    testCases: [
      {
        id: 'sepsis-001',
        input: {
          vitals: { heartRate: 120, temperature: 38.5, respiratoryRate: 24, bloodPressure: '90/60' },
          labs: { wbc: 14000, lactate: 2.5, creatinine: 1.3 },
          demographics: { age: 65, gender: 'M' },
        },
        expectedOutput: { sepsisRisk: 'high', confidence: 0.85, timeToSepsis: '4-6 hours' },
        clinicalGroundTruth: 'Patient developed sepsis within 6 hours',
        accuracyThreshold: 0.80,
      },
      {
        id: 'sepsis-002',
        input: {
          vitals: { heartRate: 75, temperature: 36.8, respiratoryRate: 16, bloodPressure: '120/80' },
          labs: { wbc: 7500, lactate: 1.0, creatinine: 0.9 },
          demographics: { age: 45, gender: 'F' },
        },
        expectedOutput: { sepsisRisk: 'low', confidence: 0.92, timeToSepsis: null },
        clinicalGroundTruth: 'No sepsis development',
        accuracyThreshold: 0.90,
      },
    ],
    biasValidation: {
      demographicGroups: ['age<40', 'age40-65', 'age>65', 'male', 'female', 'caucasian', 'african_american', 'hispanic', 'asian'],
      acceptableDisparateImpact: 0.80, // 80% threshold
    },
  },

  // Dataset 2: Diabetic Retinopathy Detection
  diabeticRetinopathy: {
    name: 'Retinal Image Analyzer',
    vendor: 'IDx Technologies',
    category: 'Medical Imaging',
    testCases: [
      {
        id: 'dr-001',
        input: {
          imageUrl: 'https://example.com/retinal-images/case001.jpg',
          patientAge: 58,
          diabetesDuration: 12,
        },
        expectedOutput: { severity: 'moderate', confidence: 0.88, referralRequired: true },
        clinicalGroundTruth: 'Moderate NPDR confirmed by ophthalmologist',
        accuracyThreshold: 0.85,
      },
      {
        id: 'dr-002',
        input: {
          imageUrl: 'https://example.com/retinal-images/case002.jpg',
          patientAge: 42,
          diabetesDuration: 5,
        },
        expectedOutput: { severity: 'none', confidence: 0.95, referralRequired: false },
        clinicalGroundTruth: 'No retinopathy present',
        accuracyThreshold: 0.90,
      },
    ],
    biasValidation: {
      demographicGroups: ['type1_diabetes', 'type2_diabetes', 'age<50', 'age>=50'],
      acceptableDisparateImpact: 0.80,
    },
  },

  // Dataset 3: Radiology - Pneumonia Detection
  pneumoniaDetection: {
    name: 'Chest X-Ray Pneumonia Classifier',
    vendor: 'Aidoc',
    category: 'Medical Imaging',
    testCases: [
      {
        id: 'pneumonia-001',
        input: {
          imagePath: '/xrays/chest_pa_001.dcm',
          clinicalHistory: 'Fever, cough, shortness of breath',
          patientAge: 72,
        },
        expectedOutput: { finding: 'pneumonia_present', location: 'right_lower_lobe', confidence: 0.92 },
        clinicalGroundTruth: 'Right lower lobe pneumonia confirmed by radiologist',
        accuracyThreshold: 0.85,
      },
      {
        id: 'pneumonia-002',
        input: {
          imagePath: '/xrays/chest_pa_002.dcm',
          clinicalHistory: 'Routine screening',
          patientAge: 35,
        },
        expectedOutput: { finding: 'normal', location: null, confidence: 0.96 },
        clinicalGroundTruth: 'Normal chest X-ray',
        accuracyThreshold: 0.90,
      },
      {
        id: 'pneumonia-003',
        input: {
          imagePath: '/xrays/chest_pa_003.dcm',
          clinicalHistory: 'Post-COVID evaluation',
          patientAge: 55,
        },
        expectedOutput: { finding: 'interstitial_changes', location: 'bilateral', confidence: 0.78 },
        clinicalGroundTruth: 'Post-COVID interstitial changes',
        accuracyThreshold: 0.75,
      },
    ],
    biasValidation: {
      demographicGroups: ['pediatric', 'adult', 'geriatric', 'smokers', 'non_smokers'],
      acceptableDisparateImpact: 0.80,
    },
  },

  // Dataset 4: Clinical NLP - Medication Extraction
  medicationExtraction: {
    name: 'Clinical Note Medication Parser',
    vendor: 'Amazon Comprehend Medical',
    category: 'Natural Language Processing',
    testCases: [
      {
        id: 'med-nlp-001',
        input: {
          clinicalNote: 'Patient taking Metformin 1000mg BID, Lisinopril 10mg QD, and Atorvastatin 20mg QHS.',
        },
        expectedOutput: {
          medications: [
            { name: 'Metformin', dose: '1000mg', frequency: 'BID' },
            { name: 'Lisinopril', dose: '10mg', frequency: 'QD' },
            { name: 'Atorvastatin', dose: '20mg', frequency: 'QHS' },
          ],
        },
        clinicalGroundTruth: 'All 3 medications correctly identified',
        accuracyThreshold: 1.0,
      },
      {
        id: 'med-nlp-002',
        input: {
          clinicalNote: 'Pt denies taking any medications. NKDA.',
        },
        expectedOutput: {
          medications: [],
          allergies: 'No known drug allergies',
        },
        clinicalGroundTruth: 'No medications correctly identified',
        accuracyThreshold: 1.0,
      },
    ],
    phiDetection: {
      sensitiveTerms: ['patient_name', 'mrn', 'date_of_birth'],
      allowedLeakage: 0, // Zero tolerance for PHI
    },
  },

  // Dataset 5: Cardiac Arrhythmia Detection
  arrhythmiaDetection: {
    name: 'ECG Arrhythmia Classifier',
    vendor: 'Cardiologs',
    category: 'Wearable Device AI',
    testCases: [
      {
        id: 'ecg-001',
        input: {
          ecgSignal: 'base64_encoded_ecg_data',
          duration: 30,
          heartRate: 150,
        },
        expectedOutput: { rhythm: 'atrial_fibrillation', confidence: 0.94, urgent: true },
        clinicalGroundTruth: 'Atrial fibrillation confirmed by cardiologist',
        accuracyThreshold: 0.90,
      },
      {
        id: 'ecg-002',
        input: {
          ecgSignal: 'base64_encoded_ecg_data',
          duration: 30,
          heartRate: 72,
        },
        expectedOutput: { rhythm: 'normal_sinus', confidence: 0.98, urgent: false },
        clinicalGroundTruth: 'Normal sinus rhythm',
        accuracyThreshold: 0.95,
      },
    ],
    biasValidation: {
      demographicGroups: ['age<50', 'age50-70', 'age>70', 'athletes', 'sedentary'],
      acceptableDisparateImpact: 0.80,
    },
  },

  // Dataset 6: Stroke Risk Prediction
  strokeRiskPrediction: {
    name: 'Stroke Risk Calculator',
    vendor: 'Viz.ai',
    category: 'Clinical Decision Support',
    testCases: [
      {
        id: 'stroke-001',
        input: {
          age: 75,
          atrial_fib: true,
          hypertension: true,
          diabetes: true,
          prior_stroke: false,
          chadsvasc_score: 5,
        },
        expectedOutput: { annualStrokeRisk: 0.066, riskCategory: 'high', anticoagulationRecommended: true },
        clinicalGroundTruth: 'CHA2DS2-VASc score 5 = 6.6% annual stroke risk',
        accuracyThreshold: 0.95,
      },
      {
        id: 'stroke-002',
        input: {
          age: 52,
          atrial_fib: false,
          hypertension: false,
          diabetes: false,
          prior_stroke: false,
          chadsvasc_score: 0,
        },
        expectedOutput: { annualStrokeRisk: 0.005, riskCategory: 'low', anticoagulationRecommended: false },
        clinicalGroundTruth: 'CHA2DS2-VASc score 0 = 0.5% annual stroke risk',
        accuracyThreshold: 0.95,
      },
    ],
  },

  // Dataset 7: Cancer Pathology Classification
  pathologyClassification: {
    name: 'Digital Pathology AI',
    vendor: 'PathAI',
    category: 'Medical Imaging',
    testCases: [
      {
        id: 'path-001',
        input: {
          tissueSlideImage: '/pathology/slide001.svs',
          tissueType: 'breast',
          stainType: 'H&E',
        },
        expectedOutput: {
          diagnosis: 'invasive_ductal_carcinoma',
          grade: 'grade_2',
          confidence: 0.89,
          mitotic_count: 15,
        },
        clinicalGroundTruth: 'IDC Grade 2 confirmed by board-certified pathologist',
        accuracyThreshold: 0.85,
      },
      {
        id: 'path-002',
        input: {
          tissueSlideImage: '/pathology/slide002.svs',
          tissueType: 'colon',
          stainType: 'H&E',
        },
        expectedOutput: {
          diagnosis: 'adenocarcinoma',
          grade: 'well_differentiated',
          confidence: 0.92,
        },
        clinicalGroundTruth: 'Well-differentiated adenocarcinoma',
        accuracyThreshold: 0.88,
      },
    ],
    biasValidation: {
      demographicGroups: ['caucasian', 'african_american', 'hispanic', 'asian'],
      acceptableDisparateImpact: 0.80,
    },
  },

  // Dataset 8: ICU Length of Stay Prediction
  icuLengthOfStay: {
    name: 'ICU LOS Predictor',
    vendor: 'Philips HealthSuite',
    category: 'Clinical Decision Support',
    testCases: [
      {
        id: 'icu-los-001',
        input: {
          admissionDiagnosis: 'septic_shock',
          apacheScore: 25,
          mechanicalVentilation: true,
          vasopressors: true,
          comorbidities: ['diabetes', 'ckd'],
        },
        expectedOutput: { predictedLOS: 8.5, confidence: 0.76, riskCategory: 'high' },
        clinicalGroundTruth: 'Actual LOS: 9 days',
        accuracyThreshold: 0.70,
      },
      {
        id: 'icu-los-002',
        input: {
          admissionDiagnosis: 'post_operative_monitoring',
          apacheScore: 10,
          mechanicalVentilation: false,
          vasopressors: false,
          comorbidities: [],
        },
        expectedOutput: { predictedLOS: 1.5, confidence: 0.88, riskCategory: 'low' },
        clinicalGroundTruth: 'Actual LOS: 1 day',
        accuracyThreshold: 0.80,
      },
    ],
  },

  // Dataset 9: Fall Risk Assessment
  fallRiskAssessment: {
    name: 'Patient Fall Risk Predictor',
    vendor: 'Cerner',
    category: 'Clinical Decision Support',
    testCases: [
      {
        id: 'fall-001',
        input: {
          age: 82,
          priorFalls: 2,
          medications: ['benzodiazepine', 'antihypertensive'],
          mobilityScore: 2,
          cognitiveImpairment: true,
        },
        expectedOutput: { fallRisk: 'high', score: 85, interventionsRecommended: ['bed_alarm', 'hourly_rounding'] },
        clinicalGroundTruth: 'Patient fell within 48 hours',
        accuracyThreshold: 0.75,
      },
      {
        id: 'fall-002',
        input: {
          age: 55,
          priorFalls: 0,
          medications: [],
          mobilityScore: 5,
          cognitiveImpairment: false,
        },
        expectedOutput: { fallRisk: 'low', score: 15, interventionsRecommended: [] },
        clinicalGroundTruth: 'No falls during hospitalization',
        accuracyThreshold: 0.85,
      },
    ],
  },

  // Dataset 10: Drug-Drug Interaction Checker
  drugInteractionChecker: {
    name: 'Medication Interaction Analyzer',
    vendor: 'Wolters Kluwer',
    category: 'Clinical Decision Support',
    testCases: [
      {
        id: 'ddi-001',
        input: {
          medications: ['warfarin', 'amoxicillin'],
        },
        expectedOutput: {
          interactions: [
            {
              severity: 'moderate',
              description: 'Amoxicillin may increase warfarin anticoagulant effect',
              recommendation: 'Monitor INR closely',
            },
          ],
        },
        clinicalGroundTruth: 'Known moderate interaction',
        accuracyThreshold: 1.0,
      },
      {
        id: 'ddi-002',
        input: {
          medications: ['simvastatin', 'gemfibrozil'],
        },
        expectedOutput: {
          interactions: [
            {
              severity: 'major',
              description: 'Increased risk of rhabdomyolysis',
              recommendation: 'Avoid combination',
            },
          ],
        },
        clinicalGroundTruth: 'Contraindicated combination',
        accuracyThreshold: 1.0,
      },
    ],
  },

  // Dataset 11: Maternal-Fetal Risk Assessment
  maternalFetalRisk: {
    name: 'Obstetric Risk Calculator',
    vendor: 'PeriGen',
    category: 'Clinical Decision Support',
    testCases: [
      {
        id: 'ob-001',
        input: {
          gestationalAge: 34,
          maternalAge: 38,
          priorCSection: true,
          gestationalDiabetes: true,
          fetalHeartRate: 110,
        },
        expectedOutput: {
          maternalRisk: 'moderate',
          fetalRisk: 'high',
          recommendations: ['NICU_standby', 'continuous_monitoring'],
        },
        clinicalGroundTruth: 'Emergency C-section required',
        accuracyThreshold: 0.80,
      },
    ],
  },

  // Dataset 12: Delirium Prediction (ICU)
  deliriumPrediction: {
    name: 'ICU Delirium Risk Model',
    vendor: 'Johns Hopkins',
    category: 'Clinical Decision Support',
    testCases: [
      {
        id: 'delirium-001',
        input: {
          age: 78,
          sedationScore: 'RASS-2',
          benzodiazepineUse: true,
          mechanicalVentilation: true,
          sleepDisruption: true,
        },
        expectedOutput: {
          deliriumRisk: 'high',
          probability: 0.72,
          preventativeActions: ['reduce_sedation', 'sleep_hygiene', 'reorientation'],
        },
        clinicalGroundTruth: 'Patient developed delirium (CAM-ICU positive)',
        accuracyThreshold: 0.70,
      },
    ],
  },

  // Dataset 13-20: Additional specialized scenarios
  skinLesionClassification: {
    name: 'Dermatology AI Classifier',
    vendor: 'DermAssist (Google)',
    category: 'Medical Imaging',
    testCases: [
      { id: 'derm-001', input: {}, expectedOutput: {}, clinicalGroundTruth: 'Melanoma', accuracyThreshold: 0.85 },
    ],
  },

  kidneyDiseaseProgression: {
    name: 'CKD Progression Predictor',
    vendor: 'Renalytix',
    category: 'Clinical Decision Support',
    testCases: [
      { id: 'ckd-001', input: {}, expectedOutput: {}, clinicalGroundTruth: 'Progressed to Stage 4', accuracyThreshold: 0.75 },
    ],
  },

  ventilatorWeaningPredictor: {
    name: 'Ventilator Liberation Predictor',
    vendor: 'Hamilton Medical',
    category: 'Clinical Decision Support',
    testCases: [
      { id: 'vent-001', input: {}, expectedOutput: {}, clinicalGroundTruth: 'Successful extubation', accuracyThreshold: 0.80 },
    ],
  },

  acuteKidneyInjuryPredictor: {
    name: 'AKI Early Detection System',
    vendor: 'DeepMind Health',
    category: 'Clinical Decision Support',
    testCases: [
      { id: 'aki-001', input: {}, expectedOutput: {}, clinicalGroundTruth: 'AKI Stage 2 within 48h', accuracyThreshold: 0.85 },
    ],
  },

  brainCTHemorrhageDetection: {
    name: 'Head CT Hemorrhage Detector',
    vendor: 'Aidoc',
    category: 'Medical Imaging',
    testCases: [
      { id: 'ct-hem-001', input: {}, expectedOutput: {}, clinicalGroundTruth: 'Subdural hematoma', accuracyThreshold: 0.90 },
    ],
  },

  cardiacOutputMonitoring: {
    name: 'Hemodynamic AI Monitor',
    vendor: 'Edwards Lifesciences',
    category: 'Physiologic Monitoring',
    testCases: [
      { id: 'co-001', input: {}, expectedOutput: {}, clinicalGroundTruth: 'Low cardiac output state', accuracyThreshold: 0.80 },
    ],
  },

  hospitalReadmissionRisk: {
    name: '30-Day Readmission Predictor',
    vendor: 'Health Catalyst',
    category: 'Population Health',
    testCases: [
      { id: 'readmit-001', input: {}, expectedOutput: {}, clinicalGroundTruth: 'Readmitted within 30 days', accuracyThreshold: 0.70 },
    ],
  },

  chronicPainAssessment: {
    name: 'Chronic Pain Phenotyping Tool',
    vendor: 'PainNavigator',
    category: 'Clinical Decision Support',
    testCases: [
      { id: 'pain-001', input: {}, expectedOutput: {}, clinicalGroundTruth: 'Neuropathic pain', accuracyThreshold: 0.75 },
    ],
  },
};

export type ValidationDataset = typeof clinicalValidationDatasets[keyof typeof clinicalValidationDatasets];
