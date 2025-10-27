/**
 * API LAYER: Deployment Controller
 * RESTful endpoints for deployment management with Clean Architecture integration
 */

import { Request, Response } from 'express';
import { ValidateDeploymentUseCase } from '../../application/deployment/ValidateDeploymentUseCase';
import { ExecuteHealthCheckUseCase } from '../../application/deployment/ExecuteHealthCheckUseCase';
import { RollbackDeploymentUseCase } from '../../application/deployment/RollbackDeploymentUseCase';
import { DrizzleDeploymentRepository } from '../../infrastructure/repositories/DrizzleDeploymentRepository';
import { Deployment } from '../../domain/entities/Deployment';
import type { DeploymentStrategy } from '../../domain/entities/Deployment';
import { db } from '../../db';

const deploymentRepository = new DrizzleDeploymentRepository(db);

export class DeploymentController {
  /**
   * Create and execute a new deployment
   * @route POST /api/deployments
   */
  static async createDeployment(req: Request, res: Response): Promise<void> {
    try {
      const { aiSystemId, version, strategy, healthChecks, rollbackPolicy, canaryPercentage } = req.body;
      const createdBy = req.user?.id || 'system';

      if (!aiSystemId || !version || !strategy || !healthChecks || !Array.isArray(healthChecks) || !rollbackPolicy) {
        res.status(400).json({
          error: 'Missing required fields: aiSystemId, version, strategy, healthChecks (array), rollbackPolicy'
        });
        return;
      }

      const deployment = Deployment.create({
        aiSystemId,
        version,
        strategy: strategy as DeploymentStrategy,
        healthChecks,
        rollbackPolicy,
        canaryPercentage,
        createdBy
      });

      await deploymentRepository.save(deployment);

      res.status(201).json({
        id: deployment.id,
        aiSystemId: deployment.aiSystemId,
        version: deployment.version,
        strategy: deployment.strategy,
        status: deployment.status,
        canaryPercentage: deployment.canaryPercentage,
        healthChecks: deployment.healthChecks,
        message: 'Deployment created successfully'
      });
    } catch (error: any) {
      if (error.message.includes('required') || error.message.includes('Invalid')) {
        res.status(400).json({ error: error.message });
        return;
      }

      console.error('Create deployment error:', error);
      res.status(500).json({ error: 'Failed to create deployment' });
    }
  }

  /**
   * Get deployment status
   * @route GET /api/deployments/:id/status
   */
  static async getDeploymentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const deployment = await deploymentRepository.findById(id);

      if (!deployment) {
        res.status(404).json({ error: 'Deployment not found' });
        return;
      }

      res.status(200).json({
        id: deployment.id,
        aiSystemId: deployment.aiSystemId,
        version: deployment.version,
        strategy: deployment.strategy,
        status: deployment.status,
        canaryPercentage: deployment.canaryPercentage,
        errorRate: deployment.errorRate,
        healthChecksPassed: deployment.healthChecks.filter(hc => hc.isHealthy === true).length,
        totalHealthChecks: deployment.healthChecks.length,
        healthChecks: deployment.healthChecks,
        rollbackPolicy: deployment.rollbackPolicy,
        deployedAt: deployment.deployedAt?.toISOString(),
        completedAt: deployment.completedAt?.toISOString(),
        rolledBackAt: deployment.rolledBackAt?.toISOString(),
        rollbackReason: deployment.rollbackReason
      });
    } catch (error: any) {
      console.error('Get deployment status error:', error);
      res.status(500).json({ error: 'Failed to retrieve deployment status' });
    }
  }

  /**
   * Execute health checks for deployment
   * @route POST /api/deployments/:id/health-check
   */
  static async executeHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const deployment = await deploymentRepository.findById(id);

      if (!deployment) {
        res.status(404).json({ error: 'Deployment not found' });
        return;
      }

      const healthCheckUseCase = new ExecuteHealthCheckUseCase(deploymentRepository);
      
      const updatedDeployment = await healthCheckUseCase.execute({
        deploymentId: id,
        mockResults: req.body.mockResults
      });

      res.status(200).json({
        id: updatedDeployment.id,
        status: updatedDeployment.status,
        healthChecksPassed: updatedDeployment.healthChecks.filter(hc => hc.isHealthy === true).length,
        totalHealthChecks: updatedDeployment.healthChecks.length,
        healthChecks: updatedDeployment.healthChecks,
        consecutiveFailures: updatedDeployment.consecutiveHealthCheckFailures,
        message: 'Health checks executed'
      });
    } catch (error: any) {
      console.error('Execute health check error:', error);
      res.status(500).json({ error: 'Failed to execute health checks' });
    }
  }

  /**
   * Rollback deployment
   * @route POST /api/deployments/:id/rollback
   */
  static async rollbackDeployment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        res.status(400).json({ error: 'Rollback reason is required' });
        return;
      }

      const rollbackUseCase = new RollbackDeploymentUseCase(deploymentRepository);
      
      const rolledBackDeployment = await rollbackUseCase.execute({
        deploymentId: id,
        reason
      });

      res.status(200).json({
        id: rolledBackDeployment.id,
        status: rolledBackDeployment.status,
        version: rolledBackDeployment.version,
        rollbackReason: rolledBackDeployment.rollbackReason,
        rolledBackAt: rolledBackDeployment.rolledBackAt?.toISOString(),
        message: `Deployment rolled back: ${reason}`
      });
    } catch (error: any) {
      if (error.message.includes('already rolled back') || error.message.includes('Cannot rollback')) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (error.message.includes('not found')) {
        res.status(404).json({ error: 'Deployment not found' });
        return;
      }

      console.error('Rollback deployment error:', error);
      res.status(500).json({ error: 'Failed to rollback deployment' });
    }
  }

  /**
   * Advance canary deployment
   * @route POST /api/deployments/:id/advance-canary
   */
  static async advanceCanary(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const deployment = await deploymentRepository.findById(id);

      if (!deployment) {
        res.status(404).json({ error: 'Deployment not found' });
        return;
      }

      deployment.advanceCanary();
      await deploymentRepository.save(deployment);

      res.status(200).json({
        id: deployment.id,
        canaryPercentage: deployment.canaryPercentage,
        status: deployment.status,
        message: deployment.canaryPercentage === 100 
          ? 'Canary deployment completed' 
          : `Canary advanced to ${deployment.canaryPercentage}%`
      });
    } catch (error: any) {
      if (error.message.includes('Cannot advance canary') || error.message.includes('not a canary')) {
        res.status(400).json({ error: error.message });
        return;
      }

      console.error('Advance canary error:', error);
      res.status(500).json({ error: 'Failed to advance canary deployment' });
    }
  }

  /**
   * List all deployments
   * @route GET /api/deployments
   */
  static async listDeployments(req: Request, res: Response): Promise<void> {
    try {
      const { aiSystemId, status } = req.query;

      const deployments = await deploymentRepository.findByAiSystemId(aiSystemId as string || '');

      let filtered = deployments;
      if (status) {
        filtered = deployments.filter(d => d.status === status);
      }

      res.status(200).json({
        deployments: filtered.map(d => ({
          id: d.id,
          aiSystemId: d.aiSystemId,
          version: d.version,
          strategy: d.strategy,
          status: d.status,
          canaryPercentage: d.canaryPercentage,
          errorRate: d.errorRate,
          deployedAt: d.deployedAt?.toISOString(),
          completedAt: d.completedAt?.toISOString(),
          rolledBackAt: d.rolledBackAt?.toISOString()
        })),
        total: filtered.length
      });
    } catch (error: any) {
      console.error('List deployments error:', error);
      res.status(500).json({ error: 'Failed to list deployments' });
    }
  }
}
