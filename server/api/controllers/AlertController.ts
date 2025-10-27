/**
 * API LAYER: Alert Controller
 * RESTful endpoints for alert management with Clean Architecture integration
 */

import { Request, Response } from 'express';
import { CreateAlertUseCase } from '../../application/alert-management/CreateAlertUseCase';
import { ListAlertsUseCase } from '../../application/alert-management/ListAlertsUseCase';
import { GetAlertUseCase } from '../../application/alert-management/GetAlertUseCase';
import { AcknowledgeAlertUseCase } from '../../application/alert-management/AcknowledgeAlertUseCase';
import { ResolveAlertUseCase } from '../../application/alert-management/ResolveAlertUseCase';
import { DrizzleAlertRepository } from '../../infrastructure/repositories/DrizzleAlertRepository';
import type { Severity } from '../../domain/entities/Alert';
import { db } from '../../db';

const alertRepository = DrizzleAlertRepository.getInstance(db);

// Mock notification gateway for now
const mockNotificationGateway = {
  send: async () => { /* no-op */ }
};

export class AlertController {
  /**
   * Create a new alert
   * @route POST /api/alerts
   */
  static async createAlert(req: Request, res: Response): Promise<void> {
    try {
      const { aiSystemId, type, message, details, severity } = req.body;

      if (!aiSystemId || !type || !message) {
        res.status(400).json({
          error: 'Missing required fields: aiSystemId, type, message'
        });
        return;
      }

      const createAlertUseCase = new CreateAlertUseCase(alertRepository, mockNotificationGateway);
      
      const result = await createAlertUseCase.execute({
        aiSystemId,
        healthSystemId: 'default-health-system',
        type,
        message,
        metadata: details ? { details } : undefined
      });

      // Fetch the created alert to return full details
      const getAlertUseCase = new GetAlertUseCase(alertRepository);
      const alert = await getAlertUseCase.execute({ alertId: result.alertId });

      res.status(201).json({
        id: alert.id,
        aiSystemId: alert.aiSystemId,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        status: alert.status,
        slaDeadline: alert.slaDeadline?.toISOString(),
        notificationsSent: result.notificationChannels,
        createdAt: alert.createdAt.toISOString(),
        message_text: result.isDuplicate ? 'Duplicate alert detected' : 'Alert created successfully'
      });
    } catch (error: any) {
      if (error.message.includes('required') || error.message.includes('Invalid')) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (error.message.includes('duplicate')) {
        res.status(409).json({ error: error.message });
        return;
      }

      console.error('Create alert error:', error);
      res.status(500).json({ error: 'Failed to create alert' });
    }
  }

  /**
   * List all alerts
   * @route GET /api/alerts
   */
  static async listAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { aiSystemId, severity, status } = req.query;

      if (!aiSystemId) {
        res.status(400).json({ error: 'aiSystemId query parameter is required' });
        return;
      }

      const listAlertsUseCase = new ListAlertsUseCase(alertRepository);
      
      const alerts = await listAlertsUseCase.execute({
        aiSystemId: aiSystemId as string,
        severity: severity as string,
        status: status as string
      });

      res.status(200).json({
        alerts: alerts.map(a => ({
          id: a.id,
          aiSystemId: a.aiSystemId,
          type: a.type,
          severity: a.severity,
          message: a.message,
          status: a.status,
          slaDeadline: a.slaDeadline?.toISOString(),
          acknowledgedAt: a.acknowledgedAt?.toISOString(),
          acknowledgedBy: a.acknowledgedBy,
          resolvedAt: a.resolvedAt?.toISOString(),
          resolvedBy: a.resolvedBy,
          createdAt: a.createdAt.toISOString()
        })),
        total: alerts.length
      });
    } catch (error: any) {
      console.error('List alerts error:', error);
      res.status(500).json({ error: 'Failed to list alerts' });
    }
  }

  /**
   * Get alert details
   * @route GET /api/alerts/:id
   */
  static async getAlert(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const getAlertUseCase = new GetAlertUseCase(alertRepository);
      
      const alert = await getAlertUseCase.execute({ alertId: id });

      res.status(200).json({
        id: alert.id,
        aiSystemId: alert.aiSystemId,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        status: alert.status,
        acknowledgedAt: alert.acknowledgedAt?.toISOString(),
        acknowledgedBy: alert.acknowledgedBy,
        resolvedAt: alert.resolvedAt?.toISOString(),
        resolvedBy: alert.resolvedBy,
        slaDeadline: alert.slaDeadline?.toISOString(),
        createdAt: alert.createdAt.toISOString()
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({ error: 'Alert not found' });
        return;
      }
      
      console.error('Get alert error:', error);
      res.status(500).json({ error: 'Failed to retrieve alert' });
    }
  }

  /**
   * Acknowledge an alert
   * @route PUT /api/alerts/:id/acknowledge
   */
  static async acknowledgeAlert(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = 'system'; // Default user ID

      const acknowledgeUseCase = new AcknowledgeAlertUseCase(alertRepository);
      
      const result = await acknowledgeUseCase.execute({
        alertId: id,
        userId
      });

      // Fetch updated alert to return full details
      const getAlertUseCase = new GetAlertUseCase(alertRepository);
      const alert = await getAlertUseCase.execute({ alertId: id });

      res.status(200).json({
        id: alert.id,
        status: alert.status,
        acknowledgedAt: alert.acknowledgedAt?.toISOString(),
        acknowledgedBy: alert.acknowledgedBy,
        message_text: 'Alert acknowledged successfully'
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({ error: 'Alert not found' });
        return;
      }
      if (error.message.includes('already')) {
        res.status(400).json({ error: error.message });
        return;
      }

      console.error('Acknowledge alert error:', error);
      res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
  }

  /**
   * Resolve an alert
   * @route PUT /api/alerts/:id/resolve
   */
  static async resolveAlert(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = 'system'; // Default user ID

      const resolveUseCase = new ResolveAlertUseCase(alertRepository);
      
      const result = await resolveUseCase.execute({
        alertId: id,
        userId
      });

      // Fetch updated alert to return full details
      const getAlertUseCase = new GetAlertUseCase(alertRepository);
      const alert = await getAlertUseCase.execute({ alertId: id });

      res.status(200).json({
        id: alert.id,
        status: alert.status,
        resolvedAt: alert.resolvedAt?.toISOString(),
        resolvedBy: alert.resolvedBy,
        message_text: 'Alert resolved successfully'
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({ error: 'Alert not found' });
        return;
      }
      if (error.message.includes('Cannot resolve')) {
        res.status(400).json({ error: error.message });
        return;
      }

      console.error('Resolve alert error:', error);
      res.status(500).json({ error: 'Failed to resolve alert' });
    }
  }
}
