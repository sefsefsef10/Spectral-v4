/**
 * AI System Controller - API Adapter Layer
 * 
 * Bridges Express.js HTTP layer to Clean Architecture use cases.
 * Responsibilities:
 * - Parse HTTP requests into use case DTOs
 * - Call appropriate use cases
 * - Map use case responses to HTTP responses
 * - Handle errors and status codes
 * 
 * This adapter allows the API routes to toggle between legacy and Clean Architecture
 * implementations via feature flags.
 */

import { Request, Response } from 'express';
import { CreateAISystemUseCase } from '../application/ai-systems/CreateAISystemUseCase';
import { UpdateAISystemUseCase } from '../application/ai-systems/UpdateAISystemUseCase';
import { DeleteAISystemUseCase } from '../application/ai-systems/DeleteAISystemUseCase';
import { RiskLevel, SystemStatus, ProviderType } from '../domain/entities/AISystem';

export class AISystemController {
  constructor(
    private readonly createUseCase: CreateAISystemUseCase,
    private readonly updateUseCase: UpdateAISystemUseCase,
    private readonly deleteUseCase: DeleteAISystemUseCase
  ) {}

  /**
   * POST /api/ai-systems
   * Create new AI system
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const healthSystemId = (req as any).healthSystemId; // Set by route handler
      
      // Map HTTP request to use case DTO
      // NOTE: Database uses 'usesPhi' (lowercase 'h'), normalize both casings
      const request = {
        healthSystemId,
        name: req.body.name,
        description: req.body.description,
        riskLevel: req.body.riskLevel as RiskLevel,
        status: req.body.status as SystemStatus,
        usesPHI: req.body.usesPhi ?? req.body.usesPHI, // Accept both casings for backwards compatibility
        fdaClassification: req.body.fdaClassification,
        category: req.body.category,
        clinicalUseCase: req.body.clinicalUseCase,
        department: req.body.department,
        monitoringEnabled: req.body.monitoringEnabled,
        integrationConfig: req.body.integrationConfig,
        providerType: req.body.providerType as ProviderType,
        providerSystemId: req.body.providerSystemId,
        vendorId: req.body.vendorId
      };

      const response = await this.createUseCase.execute(request);

      if (!response.success) {
        // Check if it's a usage limit error
        if (response.usageLimitError) {
          res.status(402).json({
            error: response.error,
            message: response.usageLimitError.message,
            current: response.usageLimitError.current,
            limit: response.usageLimitError.limit,
            upgradeRequired: response.usageLimitError.upgradeRequired
          });
          return;
        }

        // Domain validation error
        res.status(400).json({ error: response.error });
        return;
      }

      // Success - convert domain entity to JSON
      const aiSystem = response.aiSystem!;
      res.status(201).json({
        id: aiSystem.id,
        healthSystemId: aiSystem.healthSystemId,
        name: aiSystem.name,
        description: aiSystem.description,
        riskLevel: aiSystem.riskLevel,
        status: aiSystem.status,
        usesPhi: aiSystem.usesPHI,
        fdaClassification: aiSystem.fdaClassification,
        category: aiSystem.category,
        clinicalUseCase: aiSystem.clinicalUseCase,
        department: aiSystem.department,
        monitoringEnabled: aiSystem.monitoringEnabled,
        integrationConfig: aiSystem.integrationConfig,
        providerType: aiSystem.providerType,
        providerSystemId: aiSystem.providerSystemId,
        vendorId: aiSystem.vendorId,
        lastCheck: aiSystem.lastCheck,
        createdAt: aiSystem.createdAt,
        updatedAt: aiSystem.updatedAt
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * PATCH /api/ai-systems/:id
   * Update existing AI system
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const aiSystemId = req.params.id;
      const healthSystemId = (req as any).healthSystemId; // Set by route handler

      // Map HTTP request to use case DTO
      const request = {
        aiSystemId,
        requestingHealthSystemId: healthSystemId,
        updates: {
          name: req.body.name,
          description: req.body.description,
          riskLevel: req.body.riskLevel as RiskLevel,
          status: req.body.status as SystemStatus,
          usesPHI: req.body.usesPhi ?? req.body.usesPHI, // Accept both casings for backwards compatibility
          fdaClassification: req.body.fdaClassification,
          category: req.body.category,
          clinicalUseCase: req.body.clinicalUseCase,
          department: req.body.department,
          monitoringEnabled: req.body.monitoringEnabled,
          integrationConfig: req.body.integrationConfig,
          vendorId: req.body.vendorId
        }
      };

      const response = await this.updateUseCase.execute(request);

      if (!response.success) {
        // Check error type
        if (response.error === 'AI system not found') {
          res.status(404).json({ error: response.error });
          return;
        }
        if (response.error?.includes('Access denied')) {
          res.status(403).json({ error: response.error });
          return;
        }
        // Domain validation error
        res.status(400).json({ error: response.error });
        return;
      }

      // Success - convert domain entity to JSON
      const aiSystem = response.aiSystem!;
      res.status(200).json({
        id: aiSystem.id,
        healthSystemId: aiSystem.healthSystemId,
        name: aiSystem.name,
        description: aiSystem.description,
        riskLevel: aiSystem.riskLevel,
        status: aiSystem.status,
        usesPhi: aiSystem.usesPHI,
        fdaClassification: aiSystem.fdaClassification,
        category: aiSystem.category,
        clinicalUseCase: aiSystem.clinicalUseCase,
        department: aiSystem.department,
        monitoringEnabled: aiSystem.monitoringEnabled,
        integrationConfig: aiSystem.integrationConfig,
        providerType: aiSystem.providerType,
        providerSystemId: aiSystem.providerSystemId,
        vendorId: aiSystem.vendorId,
        lastCheck: aiSystem.lastCheck,
        createdAt: aiSystem.createdAt,
        updatedAt: aiSystem.updatedAt
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * DELETE /api/ai-systems/:id
   * Delete AI system
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const aiSystemId = req.params.id;
      const healthSystemId = (req as any).healthSystemId; // Set by route handler

      const request = {
        aiSystemId,
        requestingHealthSystemId: healthSystemId
      };

      const response = await this.deleteUseCase.execute(request);

      if (!response.success) {
        // Check error type
        if (response.error === 'AI system not found') {
          res.status(404).json({ error: response.error });
          return;
        }
        if (response.error?.includes('Access denied')) {
          res.status(403).json({ error: response.error });
          return;
        }
        res.status(400).json({ error: response.error });
        return;
      }

      // Success - 204 No Content
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
