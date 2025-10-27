/**
 * APPLICATION LAYER: List Alerts Use Case
 */

import { Alert } from '../../domain/entities/Alert';
import type { IAlertRepository } from '../../domain/repositories/IAlertRepository';

interface ListAlertsRequest {
  aiSystemId: string;
  severity?: string;
  status?: string;
}

export class ListAlertsUseCase {
  constructor(private alertRepository: IAlertRepository) {}

  async execute(request: ListAlertsRequest): Promise<Alert[]> {
    const { aiSystemId, severity, status } = request;

    let alerts = await this.alertRepository.findByAiSystemId(aiSystemId);

    // Apply filters
    if (severity) {
      alerts = alerts.filter(a => a.severity === severity);
    }
    if (status) {
      alerts = alerts.filter(a => a.status === status);
    }

    return alerts;
  }
}
