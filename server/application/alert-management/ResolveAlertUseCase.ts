/**
 * APPLICATION LAYER USE CASE: Resolve Alert
 * 
 * Orchestrates alert resolution with validation and audit logging.
 */

import { Alert } from '../../domain/entities/Alert';

/**
 * Repository interface for alert persistence
 */
export interface AlertRepository {
  findById(id: string): Promise<Alert | null>;
  save(alert: Alert): Promise<void>;
}

/**
 * Audit logger interface
 */
export interface AuditLogger {
  logAlertResolution(alertId: string, userId: string, responseTimeSeconds: number): Promise<void>;
}

/**
 * Input data for resolving an alert
 */
export interface ResolveAlertInput {
  alertId: string;
  userId: string;
}

/**
 * Result of alert resolution
 */
export interface ResolveAlertResult {
  alertId: string;
  responseTimeSeconds: number;
  exceededSLA: boolean;
}

/**
 * ResolveAlertUseCase
 * 
 * Business Flow:
 * 1. Load alert from repository
 * 2. Resolve using domain logic
 * 3. Check SLA compliance
 * 4. Save updated alert
 * 5. Log resolution for audit trail
 */
export class ResolveAlertUseCase {
  constructor(
    private alertRepository: AlertRepository,
    private auditLogger: AuditLogger
  ) {}

  async execute(input: ResolveAlertInput): Promise<ResolveAlertResult> {
    // Step 1: Load alert from repository
    const alert = await this.alertRepository.findById(input.alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${input.alertId}`);
    }

    // Step 2: Check SLA before resolution
    const exceededSLA = alert.hasExceededSLA();

    // Step 3: Resolve using domain logic (validates business rules)
    alert.resolve(input.userId);

    // Step 4: Save updated alert
    await this.alertRepository.save(alert);

    // Step 5: Log resolution for audit trail
    await this.auditLogger.logAlertResolution(
      input.alertId,
      input.userId,
      alert.responseTimeSeconds!
    );

    return {
      alertId: input.alertId,
      responseTimeSeconds: alert.responseTimeSeconds!,
      exceededSLA,
    };
  }
}
