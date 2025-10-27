/**
 * Clinical Validation Datasets
 * 
 * Evidence-based medical scenarios with ground truth for AI system validation
 * Covers multiple specialties with varying complexity levels
 * 
 * Sources: Clinical practice guidelines, peer-reviewed medical literature
 */

export interface ClinicalTestCase {
  id: string;
  category: string;
  specialty: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  scenario: string;
  groundTruth: {
    diagnosis: string;
    urgency: 'routine' | 'urgent' | 'emergency';
    recommendedAction: string;
    reasoning: string;
  };
  validationCriteria: {
    mustInclude: string[];
    mustNotInclude: string[];
    conceptsRequired: string[];
  };
}

/**
 * Cardiology Test Cases
 */
export const cardiologyDataset: ClinicalTestCase[] = [
  {
    id: 'card-001',
    category: 'cardiology',
    specialty: 'Cardiology',
    difficulty: 'advanced',
    scenario: '68-year-old male presents with crushing substernal chest pain radiating to left arm, diaphoresis, nausea. Pain started 45 minutes ago. ECG shows ST-segment elevation in leads II, III, aVF. Troponin elevated at 0.8 ng/mL.',
    groundTruth: {
      diagnosis: 'ST-Elevation Myocardial Infarction (STEMI)',
      urgency: 'emergency',
      recommendedAction: 'Immediate cardiac catheterization, aspirin 325mg, anticoagulation, consider thrombolysis if PCI not available within 120 minutes',
      reasoning: 'ST-elevation in inferior leads (II, III, aVF) with elevated troponin indicates acute coronary syndrome requiring immediate reperfusion therapy',
    },
    validationCriteria: {
      mustInclude: ['STEMI', 'myocardial infarction', 'emergency', 'catheterization', 'reperfusion'],
      mustNotInclude: ['observation', 'outpatient', 'wait', 'schedule'],
      conceptsRequired: ['immediate intervention', 'cardiac emergency', 'time-critical'],
    },
  },
  {
    id: 'card-002',
    category: 'cardiology',
    specialty: 'Cardiology',
    difficulty: 'intermediate',
    scenario: '55-year-old female with blood pressure readings of 158/96, 162/98, and 156/94 over past 2 weeks. No symptoms. No history of hypertension. BMI 28, otherwise healthy.',
    groundTruth: {
      diagnosis: 'Stage 2 Hypertension',
      urgency: 'routine',
      recommendedAction: 'Initiate antihypertensive medication, lifestyle modification (diet, exercise, weight loss), recheck BP in 1 month, screen for secondary causes',
      reasoning: 'Persistent BP ≥140/90 on multiple readings meets diagnostic criteria for hypertension requiring pharmacological intervention, but asymptomatic with no end-organ damage allows outpatient management',
    },
    validationCriteria: {
      mustInclude: ['hypertension', 'medication', 'lifestyle', 'follow-up'],
      mustNotInclude: ['emergency', 'immediate hospitalization'],
      conceptsRequired: ['blood pressure control', 'cardiovascular risk reduction'],
    },
  },
];

/**
 * Endocrinology Test Cases
 */
export const endocrinologyDataset: ClinicalTestCase[] = [
  {
    id: 'endo-001',
    category: 'endocrinology',
    specialty: 'Endocrinology',
    difficulty: 'intermediate',
    scenario: '42-year-old male with polyuria, polydipsia, fatigue for 3 months. Fasting glucose 142 mg/dL, repeat 138 mg/dL. HbA1c 7.2%. BMI 32. Family history of diabetes.',
    groundTruth: {
      diagnosis: 'Type 2 Diabetes Mellitus',
      urgency: 'routine',
      recommendedAction: 'Initiate metformin, diabetes education, lifestyle modification, monitor for complications, consider referral to diabetes educator',
      reasoning: 'Fasting glucose ≥126 mg/dL on two occasions AND HbA1c ≥6.5% confirms diabetes diagnosis; stable presentation allows outpatient initiation of therapy',
    },
    validationCriteria: {
      mustInclude: ['diabetes', 'metformin', 'lifestyle', 'monitoring'],
      mustNotInclude: ['prediabetes', 'observation only'],
      conceptsRequired: ['glycemic control', 'complication prevention'],
    },
  },
  {
    id: 'endo-002',
    category: 'endocrinology',
    specialty: 'Endocrinology',
    difficulty: 'advanced',
    scenario: '28-year-old female with weight loss, heat intolerance, palpitations, tremor. TSH <0.01 mIU/L, Free T4 3.8 ng/dL (elevated). No eye symptoms. Diffuse thyroid enlargement on exam.',
    groundTruth: {
      diagnosis: 'Hyperthyroidism (likely Graves disease)',
      urgency: 'urgent',
      recommendedAction: 'Thyroid ultrasound, radioactive iodine uptake scan, initiate beta-blocker for symptoms, consider antithyroid medication (methimazole), endocrinology referral',
      reasoning: 'Suppressed TSH with elevated Free T4 confirms hyperthyroidism; diffuse enlargement suggests Graves disease',
    },
    validationCriteria: {
      mustInclude: ['hyperthyroidism', 'thyroid', 'beta-blocker', 'antithyroid', 'endocrinology'],
      mustNotInclude: ['hypothyroidism', 'normal thyroid', 'no treatment'],
      conceptsRequired: ['thyroid dysfunction', 'symptom control', 'specialist referral'],
    },
  },
];

/**
 * Infectious Disease Test Cases
 */
export const infectiousDiseaseDataset: ClinicalTestCase[] = [
  {
    id: 'id-001',
    category: 'infectious_disease',
    specialty: 'Infectious Disease',
    difficulty: 'basic',
    scenario: '24-year-old previously healthy male with fever 101.5°F, rhinorrhea, dry cough, myalgias for 2 days. No shortness of breath. Lungs clear to auscultation. Rapid flu test negative.',
    groundTruth: {
      diagnosis: 'Viral Upper Respiratory Infection',
      urgency: 'routine',
      recommendedAction: 'Symptomatic treatment (rest, fluids, acetaminophen/ibuprofen for fever), return if symptoms worsen or persist >7-10 days',
      reasoning: 'Classic viral URI symptoms in immunocompetent patient; self-limited condition requiring supportive care only',
    },
    validationCriteria: {
      mustInclude: ['viral', 'upper respiratory', 'symptomatic treatment', 'self-limited'],
      mustNotInclude: ['antibiotics', 'hospitalization', 'emergency'],
      conceptsRequired: ['conservative management', 'antibiotic stewardship'],
    },
  },
  {
    id: 'id-002',
    category: 'infectious_disease',
    specialty: 'Infectious Disease',
    difficulty: 'intermediate',
    scenario: '72-year-old female nursing home resident with fever 102.8°F, productive cough with yellow sputum, confusion. Respiratory rate 28, oxygen saturation 88% on room air. CXR shows right lower lobe infiltrate.',
    groundTruth: {
      diagnosis: 'Community-Acquired Pneumonia (CAP)',
      urgency: 'emergency',
      recommendedAction: 'Hospital admission, blood cultures, sputum culture, empiric antibiotics (ceftriaxone + azithromycin or fluoroquinolone), oxygen therapy, IV fluids',
      reasoning: 'Pneumonia with hypoxia, tachypnea, and altered mental status indicates severe CAP requiring inpatient treatment',
    },
    validationCriteria: {
      mustInclude: ['pneumonia', 'admission', 'antibiotics', 'oxygen', 'severe'],
      mustNotInclude: ['outpatient', 'observation', 'oral antibiotics only'],
      conceptsRequired: ['sepsis risk', 'respiratory failure', 'empiric coverage'],
    },
  },
];

/**
 * Neurology Test Cases
 */
export const neurologyDataset: ClinicalTestCase[] = [
  {
    id: 'neuro-001',
    category: 'neurology',
    specialty: 'Neurology',
    difficulty: 'advanced',
    scenario: '65-year-old male with sudden onset right-sided weakness and slurred speech 90 minutes ago. Alert, BP 165/95, glucose 110 mg/dL. NIH Stroke Scale 8. CT head negative for hemorrhage.',
    groundTruth: {
      diagnosis: 'Acute Ischemic Stroke',
      urgency: 'emergency',
      recommendedAction: 'Immediate IV alteplase (tPA) if no contraindications, admit to stroke unit, neurology consultation, consider mechanical thrombectomy, aspirin after tPA window',
      reasoning: 'Acute stroke presentation within tPA window (<4.5 hours) with no hemorrhage on CT - time-critical intervention',
    },
    validationCriteria: {
      mustInclude: ['stroke', 'tPA', 'alteplase', 'immediate', 'neurology'],
      mustNotInclude: ['observation', 'wait', 'outpatient'],
      conceptsRequired: ['time is brain', 'thrombolysis', 'neurological emergency'],
    },
  },
  {
    id: 'neuro-002',
    category: 'neurology',
    specialty: 'Neurology',
    difficulty: 'intermediate',
    scenario: '78-year-old female with progressive memory loss over 18 months. Difficulty with word-finding, getting lost in familiar places, forgetting recent conversations. MMSE score 19/30. MRI shows hippocampal atrophy.',
    groundTruth: {
      diagnosis: 'Probable Alzheimer\'s Disease',
      urgency: 'routine',
      recommendedAction: 'Comprehensive cognitive assessment, consider cholinesterase inhibitor (donepezil), caregiver education and support, advance care planning, exclude reversible causes (B12, TSH)',
      reasoning: 'Progressive cognitive decline with memory impairment and hippocampal atrophy consistent with Alzheimer\'s disease',
    },
    validationCriteria: {
      mustInclude: ['dementia', 'Alzheimer', 'cognitive', 'cholinesterase inhibitor', 'caregiver'],
      mustNotInclude: ['normal aging', 'no intervention', 'reversible'],
      conceptsRequired: ['neurodegenerative disease', 'supportive care', 'family support'],
    },
  },
];

/**
 * Emergency Medicine Test Cases
 */
export const emergencyMedicineDataset: ClinicalTestCase[] = [
  {
    id: 'em-001',
    category: 'emergency_medicine',
    specialty: 'Emergency Medicine',
    difficulty: 'advanced',
    scenario: '35-year-old male involved in motor vehicle collision. Glasgow Coma Scale 8, BP 80/50, HR 130. Obvious deformity of right femur, rigid abdomen. FAST exam positive for free fluid.',
    groundTruth: {
      diagnosis: 'Polytrauma with Hemorrhagic Shock',
      urgency: 'emergency',
      recommendedAction: 'Activate trauma team, airway management, massive transfusion protocol, immediate surgery consultation, exploratory laparotomy for intra-abdominal bleeding, femur stabilization',
      reasoning: 'Severe hypotension, tachycardia, altered mental status, and positive FAST indicating life-threatening hemorrhage',
    },
    validationCriteria: {
      mustInclude: ['trauma', 'shock', 'hemorrhage', 'surgery', 'emergency', 'transfusion'],
      mustNotInclude: ['observation', 'discharge', 'stable'],
      conceptsRequired: ['life-threatening', 'immediate intervention', 'trauma protocol'],
    },
  },
];

/**
 * Pediatrics Test Cases
 */
export const pediatricsDataset: ClinicalTestCase[] = [
  {
    id: 'peds-001',
    category: 'pediatrics',
    specialty: 'Pediatrics',
    difficulty: 'intermediate',
    scenario: '3-year-old previously healthy child with fever 104°F for 5 days, bilateral non-exudative conjunctivitis, strawberry tongue, cracked lips, polymorphous rash, swelling of hands and feet.',
    groundTruth: {
      diagnosis: 'Kawasaki Disease',
      urgency: 'emergency',
      recommendedAction: 'Immediate admission, echocardiogram to assess for coronary artery aneurysms, IVIG infusion, high-dose aspirin, cardiology consultation',
      reasoning: 'Meets criteria for Kawasaki disease (fever ≥5 days + 4/5 clinical features); risk of coronary complications requires urgent treatment',
    },
    validationCriteria: {
      mustInclude: ['Kawasaki', 'IVIG', 'echocardiogram', 'coronary', 'admission'],
      mustNotInclude: ['viral infection', 'discharge', 'observation'],
      conceptsRequired: ['vasculitis', 'cardiac complications', 'time-sensitive'],
    },
  },
];

/**
 * Radiology Test Cases
 */
export const radiologyDataset: ClinicalTestCase[] = [
  {
    id: 'rad-001',
    category: 'radiology',
    specialty: 'Radiology',
    difficulty: 'intermediate',
    scenario: 'Chest X-ray shows large right-sided pleural effusion with mediastinal shift. Patient is 72-year-old with shortness of breath, decreased breath sounds on right.',
    groundTruth: {
      diagnosis: 'Large pleural effusion',
      urgency: 'urgent',
      recommendedAction: 'Thoracentesis for diagnostic and therapeutic purposes, pleural fluid analysis, rule out malignancy, consider chest CT',
      reasoning: 'Large pleural effusion with mediastinal shift indicates significant fluid accumulation requiring drainage',
    },
    validationCriteria: {
      mustInclude: ['pleural effusion', 'thoracentesis', 'fluid analysis', 'urgent'],
      mustNotInclude: ['normal', 'observation only', 'discharge'],
      conceptsRequired: ['diagnostic procedure', 'therapeutic intervention'],
    },
  },
  {
    id: 'rad-002',
    category: 'radiology',
    specialty: 'Radiology',
    difficulty: 'advanced',
    scenario: 'CT head shows hyperdense lesion in right middle cerebral artery territory, loss of gray-white differentiation, 6mm midline shift.',
    groundTruth: {
      diagnosis: 'Acute ischemic stroke with mass effect',
      urgency: 'emergency',
      recommendedAction: 'Neurosurgery consultation for possible decompressive hemicraniectomy, ICU admission, blood pressure management, consider mechanical thrombectomy',
      reasoning: 'Large stroke with significant mass effect and midline shift indicates increased intracranial pressure requiring urgent intervention',
    },
    validationCriteria: {
      mustInclude: ['stroke', 'mass effect', 'neurosurgery', 'emergency', 'ICU'],
      mustNotInclude: ['observation', 'outpatient'],
      conceptsRequired: ['life-threatening', 'surgical intervention'],
    },
  },
];

/**
 * Oncology Test Cases
 */
export const oncologyDataset: ClinicalTestCase[] = [
  {
    id: 'onc-001',
    category: 'oncology',
    specialty: 'Oncology',
    difficulty: 'advanced',
    scenario: '58-year-old female with new breast mass, mammogram shows 3cm spiculated mass with microcalcifications, biopsy confirms invasive ductal carcinoma ER+/PR+/HER2-.',
    groundTruth: {
      diagnosis: 'Invasive Ductal Carcinoma (Hormone Receptor Positive)',
      urgency: 'urgent',
      recommendedAction: 'Oncology referral, staging workup (chest/abdomen CT, bone scan), discuss surgical options (lumpectomy vs mastectomy), consider neoadjuvant endocrine therapy',
      reasoning: 'Newly diagnosed breast cancer requires prompt multidisciplinary evaluation for treatment planning',
    },
    validationCriteria: {
      mustInclude: ['breast cancer', 'oncology', 'staging', 'surgery', 'treatment plan'],
      mustNotInclude: ['benign', 'observation', 'routine follow-up'],
      conceptsRequired: ['cancer treatment', 'multidisciplinary care'],
    },
  },
];

/**
 * Gastroenterology Test Cases
 */
export const gastroenterologyDataset: ClinicalTestCase[] = [
  {
    id: 'gi-001',
    category: 'gastroenterology',
    specialty: 'Gastroenterology',
    difficulty: 'intermediate',
    scenario: '45-year-old with hematemesis, melena, heart rate 115, blood pressure 95/60, hemoglobin dropped from 14 to 8 g/dL.',
    groundTruth: {
      diagnosis: 'Upper GI Bleed with Hemorrhagic Shock',
      urgency: 'emergency',
      recommendedAction: 'Large-bore IV access, aggressive fluid resuscitation, blood transfusion, emergent upper endoscopy, PPI infusion, gastroenterology consultation',
      reasoning: 'Active GI bleeding with hemodynamic instability and significant anemia requires immediate intervention',
    },
    validationCriteria: {
      mustInclude: ['GI bleed', 'emergency', 'endoscopy', 'transfusion', 'resuscitation'],
      mustNotInclude: ['outpatient', 'elective', 'observation'],
      conceptsRequired: ['hemorrhage control', 'hemodynamic support'],
    },
  },
];

/**
 * Psychiatry Test Cases
 */
export const psychiatryDataset: ClinicalTestCase[] = [
  {
    id: 'psych-001',
    category: 'psychiatry',
    specialty: 'Psychiatry',
    difficulty: 'advanced',
    scenario: '28-year-old male brought by police, agitated, delusional beliefs of being followed by FBI, auditory hallucinations commanding him to harm others, not eating for 3 days, no prior psychiatric history.',
    groundTruth: {
      diagnosis: 'First Episode Psychosis',
      urgency: 'emergency',
      recommendedAction: 'Involuntary psychiatric hold, safety assessment, rule out medical causes (toxicology, metabolic panel, brain imaging), antipsychotic medication, inpatient psychiatric admission',
      reasoning: 'Acute psychosis with command hallucinations and potential danger to others requires immediate psychiatric intervention and medical clearance',
    },
    validationCriteria: {
      mustInclude: ['psychosis', 'psychiatric hold', 'safety', 'antipsychotic', 'admission'],
      mustNotInclude: ['outpatient therapy', 'discharge', 'observation only'],
      conceptsRequired: ['psychiatric emergency', 'safety risk', 'involuntary treatment'],
    },
  },
  {
    id: 'psych-002',
    category: 'psychiatry',
    specialty: 'Psychiatry',
    difficulty: 'intermediate',
    scenario: '42-year-old female with 6-month history of depressed mood, anhedonia, weight loss of 15 pounds, insomnia, passive suicidal ideation without plan. Denies active intent, has family support.',
    groundTruth: {
      diagnosis: 'Major Depressive Disorder (Moderate)',
      urgency: 'urgent',
      recommendedAction: 'Initiate SSRI antidepressant, establish safety plan, outpatient psychiatry referral within 1 week, consider psychotherapy, follow-up in 2 weeks to assess treatment response',
      reasoning: 'Moderate depression with passive SI requires prompt treatment initiation, but patient has protective factors allowing outpatient management with close follow-up',
    },
    validationCriteria: {
      mustInclude: ['depression', 'antidepressant', 'safety plan', 'follow-up', 'psychiatry'],
      mustNotInclude: ['emergency admission', 'immediate hospitalization'],
      conceptsRequired: ['suicide risk assessment', 'pharmacotherapy', 'outpatient management'],
    },
  },
];

/**
 * Dermatology Test Cases
 */
export const dermatologyDataset: ClinicalTestCase[] = [
  {
    id: 'derm-001',
    category: 'dermatology',
    specialty: 'Dermatology',
    difficulty: 'advanced',
    scenario: '62-year-old with new 1.2cm pigmented lesion on back. Asymmetric borders, multiple colors (black, brown, red), irregular edges, recent growth. Patient works outdoors, history of severe sunburns.',
    groundTruth: {
      diagnosis: 'Suspicious Melanoma',
      urgency: 'urgent',
      recommendedAction: 'Urgent excisional biopsy with margin, dermatopathology review, if confirmed melanoma proceed with sentinel lymph node biopsy and staging workup, dermatology/oncology referral',
      reasoning: 'ABCDE criteria positive for melanoma - asymmetry, border irregularity, color variation, diameter >6mm, evolution. High-risk features require prompt biopsy',
    },
    validationCriteria: {
      mustInclude: ['melanoma', 'biopsy', 'urgent', 'oncology', 'staging'],
      mustNotInclude: ['benign', 'observation', 'routine follow-up'],
      conceptsRequired: ['skin cancer', 'early intervention', 'malignancy risk'],
    },
  },
  {
    id: 'derm-002',
    category: 'dermatology',
    specialty: 'Dermatology',
    difficulty: 'basic',
    scenario: '25-year-old with painful red nodules on shins bilaterally, fever 100.8°F, recent strep throat infection 2 weeks ago, no other systemic symptoms.',
    groundTruth: {
      diagnosis: 'Erythema Nodosum (Post-Streptococcal)',
      urgency: 'routine',
      recommendedAction: 'NSAIDs for pain control, leg elevation, rest, rule out other causes (chest X-ray to exclude sarcoidosis), clinical follow-up in 2-4 weeks, should self-resolve',
      reasoning: 'Erythema nodosum is often self-limited, commonly triggered by streptococcal infection, requires symptomatic treatment and workup for other causes',
    },
    validationCriteria: {
      mustInclude: ['erythema nodosum', 'NSAIDs', 'self-limited', 'workup'],
      mustNotInclude: ['emergency', 'admission', 'biopsy required'],
      conceptsRequired: ['inflammatory condition', 'symptomatic treatment'],
    },
  },
];

/**
 * Orthopedics Test Cases
 */
export const orthopedicsDataset: ClinicalTestCase[] = [
  {
    id: 'ortho-001',
    category: 'orthopedics',
    specialty: 'Orthopedics',
    difficulty: 'advanced',
    scenario: '75-year-old female fell from standing height, severe hip pain, unable to bear weight, externally rotated and shortened left leg, X-ray shows displaced femoral neck fracture.',
    groundTruth: {
      diagnosis: 'Displaced Femoral Neck Fracture',
      urgency: 'emergency',
      recommendedAction: 'NPO status, orthopedic surgery consultation for urgent operative fixation (likely hemiarthroplasty or total hip replacement), pain control, DVT prophylaxis, surgery within 24-48 hours to reduce complications',
      reasoning: 'Displaced femoral neck fractures in elderly require surgical intervention within 24-48 hours to minimize complications (AVN, nonunion, mortality)',
    },
    validationCriteria: {
      mustInclude: ['fracture', 'surgery', 'urgent', 'orthopedic', 'operative'],
      mustNotInclude: ['conservative management', 'outpatient', 'observation'],
      conceptsRequired: ['surgical emergency', 'hip fracture', 'geriatric trauma'],
    },
  },
  {
    id: 'ortho-002',
    category: 'orthopedics',
    specialty: 'Orthopedics',
    difficulty: 'intermediate',
    scenario: '35-year-old athlete with acute knee pain after twisting injury, positive Lachman test, positive anterior drawer, MRI shows complete ACL tear, no other ligament involvement.',
    groundTruth: {
      diagnosis: 'Complete Anterior Cruciate Ligament (ACL) Tear',
      urgency: 'routine',
      recommendedAction: 'Orthopedic surgery referral for ACL reconstruction discussion, initial RICE protocol (rest, ice, compression, elevation), physical therapy for pre-operative strengthening, elective surgery timing based on patient goals',
      reasoning: 'Complete ACL tears in active patients typically require surgical reconstruction, but this is elective timing allowing for pre-hab and patient decision-making',
    },
    validationCriteria: {
      mustInclude: ['ACL tear', 'reconstruction', 'orthopedic', 'physical therapy'],
      mustNotInclude: ['emergency surgery', 'immediate', 'urgent'],
      conceptsRequired: ['sports injury', 'elective surgery', 'rehabilitation'],
    },
  },
];

/**
 * Pulmonology Test Cases
 */
export const pulmonologyDataset: ClinicalTestCase[] = [
  {
    id: 'pulm-001',
    category: 'pulmonology',
    specialty: 'Pulmonology',
    difficulty: 'advanced',
    scenario: '58-year-old with sudden onset severe dyspnea, unilateral absent breath sounds on right, hyperresonance to percussion, oxygen saturation 88%, tracheal deviation to left, recent thoracentesis 6 hours ago.',
    groundTruth: {
      diagnosis: 'Tension Pneumothorax (Iatrogenic)',
      urgency: 'emergency',
      recommendedAction: 'Immediate needle decompression (2nd intercostal space, midclavicular line), followed by chest tube placement, 100% oxygen, continuous monitoring, chest X-ray post-intervention',
      reasoning: 'Tension pneumothorax with tracheal deviation and hemodynamic compromise is life-threatening emergency requiring immediate needle decompression',
    },
    validationCriteria: {
      mustInclude: ['tension pneumothorax', 'emergency', 'needle decompression', 'chest tube'],
      mustNotInclude: ['observation', 'oxygen alone', 'outpatient'],
      conceptsRequired: ['life-threatening', 'immediate intervention', 'procedural complication'],
    },
  },
];

/**
 * Combined Dataset - 21 Clinical Scenarios Across 13 Specialties
 * Comprehensive coverage for AI system certification
 */
export const clinicalValidationDataset: ClinicalTestCase[] = [
  ...cardiologyDataset,        // 2 scenarios
  ...endocrinologyDataset,     // 2 scenarios
  ...infectiousDiseaseDataset, // 2 scenarios
  ...neurologyDataset,         // 2 scenarios
  ...emergencyMedicineDataset, // 1 scenario
  ...pediatricsDataset,        // 1 scenario
  ...radiologyDataset,         // 2 scenarios
  ...oncologyDataset,          // 1 scenario
  ...gastroenterologyDataset,  // 1 scenario
  ...psychiatryDataset,        // 2 scenarios
  ...dermatologyDataset,       // 2 scenarios
  ...orthopedicsDataset,       // 2 scenarios
  ...pulmonologyDataset,       // 1 scenario
];

// Total: 21 comprehensive clinical validation scenarios across 13 medical specialties

/**
 * Get dataset by specialty
 */
export function getDatasetBySpecialty(specialty: string): ClinicalTestCase[] {
  return clinicalValidationDataset.filter(tc => tc.specialty === specialty);
}

/**
 * Get dataset by difficulty
 */
export function getDatasetByDifficulty(difficulty: 'basic' | 'intermediate' | 'advanced'): ClinicalTestCase[] {
  return clinicalValidationDataset.filter(tc => tc.difficulty === difficulty);
}

/**
 * Get dataset by urgency
 */
export function getDatasetByUrgency(urgency: 'routine' | 'urgent' | 'emergency'): ClinicalTestCase[] {
  return clinicalValidationDataset.filter(tc => tc.groundTruth.urgency === urgency);
}

/**
 * Get random sample for testing
 */
export function getRandomSample(count: number): ClinicalTestCase[] {
  const shuffled = [...clinicalValidationDataset].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
