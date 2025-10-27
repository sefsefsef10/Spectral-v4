/**
 * APPLICATION LAYER USE CASE: Acknowledge Alert
 * 
 * Marks alert as acknowledged (someone is working on it).
 */

import { Alert } from '../../domain/entities/Alert';
import type { IAlertRepository } from '../../domain/repositories/IAlertRepository';

/**
 * Input data for acknowledging an alert
 */
export interface AcknowledgeAlertInput {
  alertId: string;
  userId: string;
}

/**
 * Result of alert acknowledgment
 */
export interface AcknowledgeAlertResult {
  alertId: string;
  acknowledgedAt: Date;
  acknowledgedBy: string;
}

/**
 * AcknowledgeAlertUseCase
 * 
 * Business Flow:
 * 1. Load alert from repository
 * 2. Acknowledge using domain logic
 * 3. Save updated alert
 */
export class AcknowledgeAlertUseCase {
  constructor(private alertRepository: IAlertRepository) {}

  async execute(input: AcknowledgeAlertInput): Promise<AcknowledgeAlertResult> {
    // Step 1: Load alert from repository
    const alert = await this.alertRepository.findById(input.alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${input.alertId}`);
    }

    // Step 2: Acknowledge using domain logic (validates business rules)
    alert.acknowledge(input.userId);

    // Step 3: Save updated alert
    await this.alertRepository.save(alert);

    return {
      alertId: input.alertId,
      acknowledgedAt: alert.acknowledgedAt!,
      acknowledgedBy: alert.acknowledgedBy!,
    };
  }
}
