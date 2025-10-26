/**
 * 🔒 POLICY MIGRATION - Convert Static Rules to Encrypted Database Policies
 * 
 * One-time migration script to convert hardcoded compliance mapping rules
 * from TypeScript into encrypted, versioned database policies.
 * 
 * Run this after deployment to activate the IP moat.
 */

import { policyVersioningService, type PolicyRuleLogic } from '../policy-versioning-service';
import { logger } from '../../logger';

/**
 * Static policy definitions (extracted from compliance-mapping.ts)
 * These will be encrypted and stored in the database
 */
const STATIC_POLICIES: Array<{
  eventType: string;
  framework: string;
  version: string;
  ruleLogic: PolicyRuleLogic;
}> = [
  // PHI EXPOSURE
  {
    eventType: 'phi_exposure',
    framework: 'HIPAA',
    version: '1.0.0',
    ruleLogic: {
      frameworks: [
        {
          framework: 'HIPAA',
          controlId: '164.402',
          controlName: 'Breach Notification - Unauthorized Disclosure',
          violationType: 'breach',
          severity: 'critical',
          requiresReporting: true,
          reportingDeadlineDays: 60,
          remediationSteps: [
            'Immediately isolate affected AI system',
            'Determine scope of PHI exposure',
            'Notify affected patients within 60 days',
            'Report to HHS if >500 individuals affected',
            'Document incident in breach log'
          ]
        },
        {
          framework: 'HIPAA',
          controlId: '164.308(a)(1)(ii)(D)',
          controlName: 'Security Management - Information System Activity Review',
          violationType: 'breach',
          severity: 'critical',
          requiresReporting: true,
          remediationSteps: [
            'Review AI system activity logs',
            'Implement corrective security measures',
            'Update security incident response plan'
          ]
        }
      ]
    }
  },
  
  // BIAS DETECTED
  {
    eventType: 'bias_detected',
    framework: 'NIST_AI_RMF',
    version: '1.0.0',
    ruleLogic: {
      frameworks: [
        {
          framework: 'NIST_AI_RMF',
          controlId: 'MANAGE-1.3',
          controlName: 'AI system is monitored for bias and fairness',
          violationType: 'threshold_exceeded',
          severity: 'high',
          requiresReporting: false,
          remediationSteps: [
            'Analyze bias metrics across demographic groups',
            'Retrain model with balanced dataset',
            'Update fairness thresholds',
            'Document mitigation in compliance log'
          ]
        }
      ]
    }
  },
  
  // MODEL DRIFT
  {
    eventType: 'model_drift',
    framework: 'NIST_AI_RMF',
    version: '1.0.0',
    ruleLogic: {
      frameworks: [
        {
          framework: 'NIST_AI_RMF',
          controlId: 'MANAGE-4.1',
          controlName: 'AI system performance is monitored',
          violationType: 'deviation',
          severity: 'high',
          requiresReporting: false,
          remediationSteps: [
            'Investigate root cause of performance degradation',
            'Retrain model with recent data',
            'Update performance monitoring thresholds',
            'Document in model change log'
          ]
        },
        {
          framework: 'HIPAA',
          controlId: '164.312(b)',
          controlName: 'Audit Controls - System Activity Review',
          violationType: 'threshold_exceeded',
          severity: 'medium',
          requiresReporting: false
        }
      ]
    }
  },
  
  {
    eventType: 'model_drift',
    framework: 'FDA_SaMD',
    version: '1.0.0',
    ruleLogic: {
      frameworks: [
        {
          framework: 'FDA_SaMD',
          controlId: 'FDA-PCCP-2',
          controlName: 'Post-Market Surveillance - Model Performance',
          violationType: 'deviation',
          severity: 'high',
          requiresReporting: true,
          reportingDeadlineDays: 30,
          remediationSteps: [
            'Submit FDA notification of performance degradation',
            'Provide corrective action plan',
            'Implement model update or rollback',
            'Update predetermined change control plan'
          ]
        }
      ]
    }
  },
  
  // UNAUTHORIZED ACCESS
  {
    eventType: 'unauthorized_data_access',
    framework: 'HIPAA',
    version: '1.0.0',
    ruleLogic: {
      frameworks: [
        {
          framework: 'HIPAA',
          controlId: '164.312(a)(1)',
          controlName: 'Access Control - Unique User Identification',
          violationType: 'breach',
          severity: 'critical',
          requiresReporting: true,
          reportingDeadlineDays: 60,
          remediationSteps: [
            'Immediately revoke unauthorized access',
            'Review access control policies',
            'Audit all recent access attempts',
            'Update user access permissions'
          ]
        }
      ]
    }
  },
  
  // CLINICAL ACCURACY FAILURE
  {
    eventType: 'clinical_accuracy_failure',
    framework: 'FDA_SaMD',
    version: '1.0.0',
    ruleLogic: {
      frameworks: [
        {
          framework: 'FDA_SaMD',
          controlId: 'FDA-CLINICAL-VALIDATION',
          controlName: 'Clinical Validation - Accuracy Requirements',
          violationType: 'deviation',
          severity: 'critical',
          requiresReporting: true,
          reportingDeadlineDays: 30,
          remediationSteps: [
            'Immediately suspend AI system if patient safety risk',
            'Conduct clinical validation review',
            'Submit FDA adverse event report',
            'Implement corrective action plan'
          ]
        }
      ]
    }
  }
];

/**
 * Run migration to seed database with encrypted policies
 */
export async function migratePolicies(seedUserId: string): Promise<void> {
  logger.info({ policyCount: STATIC_POLICIES.length }, 'Starting policy migration');
  
  const seededCount = await policyVersioningService.seedPoliciesFromStaticMapping(
    STATIC_POLICIES,
    seedUserId
  );
  
  logger.info({ seededCount, total: STATIC_POLICIES.length }, '✅ Policy migration complete');
}

/**
 * Validate that all critical event types have policies
 */
export async function validatePolicyCompleteness(): Promise<boolean> {
  const criticalEventTypes = [
    'phi_exposure',
    'bias_detected',
    'model_drift',
    'unauthorized_data_access',
    'clinical_accuracy_failure'
  ];
  
  const frameworks = ['HIPAA', 'NIST_AI_RMF', 'FDA_SaMD'];
  let missingPolicies = 0;
  
  for (const eventType of criticalEventTypes) {
    for (const framework of frameworks) {
      const policy = await policyVersioningService.getActivePolicy(eventType, framework);
      if (!policy) {
        logger.warn({ eventType, framework }, 'Missing policy');
        missingPolicies++;
      }
    }
  }
  
  if (missingPolicies > 0) {
    logger.warn({ missingPolicies }, 'Policy completeness check failed');
    return false;
  }
  
  logger.info('✅ All critical policies present');
  return true;
}
