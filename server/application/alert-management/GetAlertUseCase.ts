/**
 * APPLICATION LAYER: Get Alert Use Case
 */

import { Alert } from '../../domain/entities/Alert';
import type { IAlertRepository } from '../../domain/repositories/IAlertRepository';

interface GetAlertRequest {
  alertId: string;
}

export class GetAlertUseCase {
  constructor(private alertRepository: IAlertRepository) {}

  async execute(request: GetAlertRequest): Promise<Alert> {
    const { alertId } = request;

    const alert = await this.alertRepository.findById(alertId);

    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    return alert;
  }
}
