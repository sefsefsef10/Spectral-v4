/**
 * APPLICATION LAYER: Get Alert Use Case
 */

import { Alert } from '../../domain/entities/Alert';

export interface AlertRepository {
  findById(id: string): Promise<Alert | null>;
}

interface GetAlertRequest {
  alertId: string;
}

export class GetAlertUseCase {
  constructor(private alertRepository: AlertRepository) {}

  async execute(request: GetAlertRequest): Promise<Alert> {
    const { alertId } = request;

    const alert = await this.alertRepository.findById(alertId);

    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    return alert;
  }
}
