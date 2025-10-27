/**
 * 🔒 REGULATORY GUARDRAILS
 * 
 * Enforces mandatory compliance controls that cannot be disabled/modified
 * Prevents dangerous customizations that would violate HIPAA, NIST, or FDA regulations
 */

import { logger } from '../logger';

/**
 * MANDATORY HIPAA CONTROLS - Cannot be disabled under any circumstances
 * These are legally required for PHI protection and carry civil/criminal penalties
 */
export const MANDATORY_HIPAA_CONTROLS = [
  '164.308(a)(1)', // Security Management Process - REQUIRED BY LAW
  '164.308(a)(3)', // Workforce Security - REQUIRED BY LAW
  '164.308(a)(4)', // Information Access Management - REQUIRED BY LAW
  '164.308(a)(6)', // Security Incident Procedures - REQUIRED FOR BREACH NOTIFICATION
  '164.310(a)(1)', // Facility Access Controls - REQUIRED FOR PHYSICAL SAFEGUARDS
  '164.312(a)(1)', // Access Control - REQUIRED FOR ePHI
  '164.312(a)(2)(iv)', // Encryption - ADDRESSABLE BUT STRONGLY REQUIRED
  '164.312(b)', // Audit Controls - REQUIRED FOR COMPLIANCE
  '164.312(c)(1)', // Integrity Controls - REQUIRED FOR ePHI
  '164.312(d)', // Person Authentication - REQUIRED BY LAW
  '164.312(e)(1)', // Transmission Security - REQUIRED FOR ePHI IN TRANSIT
  '164.402', // Breach Notification - FEDERAL LAW REQUIREMENT
  '164.404', // Notification to Individuals - FEDERAL LAW REQUIREMENT
  '164.408', // Notification to HHS - FEDERAL LAW REQUIREMENT
];

/**
 * MANDATORY NIST AI RMF CONTROLS - Cannot be disabled for AI systems
 */
export const MANDATORY_NIST_CONTROLS = [
  'GOVERN-1.1', // AI Risk Management Strategy
  'GOVERN-1.2', // Legal and Regulatory Requirements
  'MAP-1.1', // AI System Context Documentation
  'MEASURE-2.1', // AI System Performance Monitoring
  'MANAGE-1.1', // AI System Risk Response
];

/**
 * MANDATORY FDA SaMD CONTROLS - Cannot be disabled for medical AI
 */
export const MANDATORY_FDA_CONTROLS = [
  'samd-510k', // Premarket Notification
  'samd-clinical-validation', // Clinical Validation Requirements
  'samd-software-validation', // Software Validation
  'samd-adverse-event-reporting', // Adverse Event Reporting
];

/**
 * Check if a control ID is mandatory and cannot be disabled
 */
export function isMandatoryControl(controlId: string): boolean {
  return (
    MANDATORY_HIPAA_CONTROLS.includes(controlId) ||
    MANDATORY_NIST_CONTROLS.includes(controlId) ||
    MANDATORY_FDA_CONTROLS.includes(controlId)
  );
}

/**
 * Get the regulatory reason why a control cannot be disabled
 */
export function getMandatoryControlReason(controlId: string): string {
  if (MANDATORY_HIPAA_CONTROLS.includes(controlId)) {
    return `HIPAA control ${controlId} is legally required and cannot be disabled. Disabling this control would violate federal law (HIPAA) and expose your organization to civil penalties up to $1.5M per violation and potential criminal charges.`;
  }
  
  if (MANDATORY_NIST_CONTROLS.includes(controlId)) {
    return `NIST AI RMF control ${controlId} is required for AI system governance and cannot be disabled. This control ensures AI systems meet federal AI risk management standards.`;
  }
  
  if (MANDATORY_FDA_CONTROLS.includes(controlId)) {
    return `FDA SaMD control ${controlId} is required for medical device software and cannot be disabled. Disabling this control would violate FDA regulations (21 CFR Part 820).`;
  }
  
  return 'This control is mandatory for regulatory compliance and cannot be disabled.';
}

/**
 * Validate control toggle request against regulatory guardrails
 * Throws error if toggle would violate mandatory requirements
 */
export function validateControlToggle(controlId: string, enabled: boolean): void {
  // If attempting to disable a mandatory control, reject
  if (!enabled && isMandatoryControl(controlId)) {
    const reason = getMandatoryControlReason(controlId);
    logger.error({ controlId }, `Attempted to disable mandatory control: ${controlId}`);
    throw new Error(`REGULATORY GUARDRAIL VIOLATION: ${reason}`);
  }
}

/**
 * Validate threshold override request against regulatory guardrails
 * Rejects overrides that would weaken mandatory controls
 */
export function validateThresholdOverride(
  eventType: string, 
  newThreshold: string,
  controlId?: string
): void {
  const threshold = parseFloat(newThreshold);
  
  // PHI exposure controls cannot have thresholds raised above 0
  const phiRelatedEvents = [
    'phi_exposure',
    'phi_leak',
    'unauthorized_phi_access',
    'phi_disclosure',
  ];
  
  if (phiRelatedEvents.includes(eventType) && threshold > 0) {
    logger.error({ eventType, newThreshold }, 'Attempted to weaken PHI protection threshold');
    throw new Error(
      `REGULATORY GUARDRAIL VIOLATION: PHI exposure threshold cannot be raised above 0. ` +
      `HIPAA requires immediate detection and response to any PHI exposure. ` +
      `Setting threshold to ${threshold} would allow ${threshold} PHI exposures before alerting, violating HIPAA 164.308(a)(6).`
    );
  }
  
  // Critical severity violations cannot have thresholds weakened
  if (controlId && isMandatoryControl(controlId) && threshold > 0) {
    const reason = getMandatoryControlReason(controlId);
    logger.error({ controlId, newThreshold }, 'Attempted to weaken mandatory control threshold');
    throw new Error(
      `REGULATORY GUARDRAIL VIOLATION: Cannot weaken threshold for mandatory control. ${reason}`
    );
  }
}

/**
 * Validate custom control request against regulatory guardrails
 * Ensures custom controls don't conflict with mandatory requirements
 */
export function validateCustomControl(
  controlId: string,
  mappedEventTypes: string[]
): void {
  // Custom controls cannot override or conflict with mandatory controls
  if (isMandatoryControl(controlId)) {
    logger.error({ controlId }, 'Attempted to create custom control with mandatory control ID');
    throw new Error(
      `REGULATORY GUARDRAIL VIOLATION: Control ID ${controlId} is reserved for mandatory regulatory controls. ` +
      `Please use a different control ID for your custom control.`
    );
  }
  
  // Custom controls cannot disable PHI protection
  const phiRelatedEvents = [
    'phi_exposure',
    'phi_leak',
    'unauthorized_phi_access',
    'phi_disclosure',
  ];
  
  const conflicts = mappedEventTypes.filter(e => phiRelatedEvents.includes(e));
  if (conflicts.length > 0) {
    logger.error({ mappedEventTypes, conflicts }, 'Custom control attempts to override PHI protection');
    throw new Error(
      `REGULATORY GUARDRAIL VIOLATION: Custom control cannot map to PHI-related event types: ${conflicts.join(', ')}. ` +
      `PHI protection is governed by mandatory HIPAA controls that cannot be customized.`
    );
  }
}

/**
 * Get list of all controls that can be customized
 * Returns controls that are NOT mandatory
 */
export function getCustomizableControls(allControlIds: string[]): string[] {
  return allControlIds.filter(id => !isMandatoryControl(id));
}

/**
 * Audit log for guardrail violations
 * Called when a customization is blocked by regulatory guardrails
 */
export function logGuardrailViolation(
  userId: string,
  healthSystemId: string,
  violationType: 'control_toggle' | 'threshold_override' | 'custom_control',
  details: {
    controlId?: string;
    eventType?: string;
    newThreshold?: string;
    reason: string;
  }
): void {
  logger.warn({
    userId,
    healthSystemId,
    violationType,
    details,
  }, 'REGULATORY GUARDRAIL BLOCKED CUSTOMIZATION ATTEMPT');
}
