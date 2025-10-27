/**
 * CHARACTERIZATION TESTS - Alert Management (Phase 6)
 * 
 * Purpose: Lock down current alert behavior before refactoring to Clean Architecture
 * Scope: Alert creation, severity calculation, routing, resolution, predictive alerts
 * 
 * These tests document existing behavior - DO NOT modify test expectations.
 * If tests fail, the existing code has changed and must be investigated.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../../server/db';
import { monitoringAlerts, predictiveAlerts, aiSystems, healthSystems } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { storage } from '../../server/storage';
import { PredictiveAlertService } from '../../server/services/predictive-alert-service';

describe('Alert Management - Current Behavior', () => {
  let testHealthSystemId: string;
  let testAISystemId: string;

  beforeEach(async () => {
    // Clean up test data
    await db.delete(monitoringAlerts);
    await db.delete(predictiveAlerts);
    await db.delete(aiSystems);
    await db.delete(healthSystems);

    // Create test health system
    const [healthSystem] = await db.insert(healthSystems).values({
      name: 'Test Hospital',
      type: 'hospital',
    }).returning();
    testHealthSystemId = healthSystem.id;

    // Create test AI system
    const [aiSystem] = await db.insert(aiSystems).values({
      name: 'Test AI System',
      description: 'Test system for alert characterization',
      healthSystemId: testHealthSystemId,
      usesPhi: false,
      status: 'active',
      criticalityLevel: 'high',
      deploymentDate: new Date(),
    }).returning();
    testAISystemId = aiSystem.id;
  });

  describe('Monitoring Alert Creation', () => {
    it('should create monitoring alert with required fields', async () => {
      const alert = await storage.createAlert({
        aiSystemId: testAISystemId,
        type: 'compliance_violation',
        severity: 'high',
        message: 'PHI exposure detected in logs',
      });

      expect(alert).toMatchObject({
        aiSystemId: testAISystemId,
        type: 'compliance_violation',
        severity: 'high',
        message: 'PHI exposure detected in logs',
        resolved: false,
      });
      expect(alert.id).toBeDefined();
      expect(alert.createdAt).toBeInstanceOf(Date);
    });

    it('should support all severity levels', async () => {
      const severities = ['low', 'medium', 'high', 'critical'];
      
      for (const severity of severities) {
        const alert = await storage.createAlert({
          aiSystemId: testAISystemId,
          type: 'test_alert',
          severity,
          message: `Test ${severity} alert`,
        });

        expect(alert.severity).toBe(severity);
      }

      const allAlerts = await db.select().from(monitoringAlerts);
      expect(allAlerts).toHaveLength(4);
    });

    it('should support different alert types', async () => {
      const types = [
        'compliance_violation',
        'performance_degradation',
        'phi_exposure',
        'model_drift',
        'bias_detection',
      ];

      for (const type of types) {
        await storage.createAlert({
          aiSystemId: testAISystemId,
          type,
          severity: 'medium',
          message: `${type} detected`,
        });
      }

      const allAlerts = await db.select().from(monitoringAlerts);
      expect(allAlerts).toHaveLength(5);
      expect(allAlerts.map(a => a.type)).toEqual(types);
    });

    it('should default resolved to false', async () => {
      const alert = await storage.createAlert({
        aiSystemId: testAISystemId,
        type: 'test',
        severity: 'low',
        message: 'Test',
      });

      expect(alert.resolved).toBe(false);
      expect(alert.resolvedAt).toBeNull();
      expect(alert.resolvedBy).toBeNull();
      expect(alert.responseTimeSeconds).toBeNull();
    });
  });

  describe('Alert Resolution', () => {
    it('should mark alert as resolved', async () => {
      const alert = await storage.createAlert({
        aiSystemId: testAISystemId,
        type: 'test',
        severity: 'high',
        message: 'Test alert',
      });

      await storage.resolveAlert(alert.id);

      const [updated] = await db
        .select()
        .from(monitoringAlerts)
        .where(eq(monitoringAlerts.id, alert.id));

      expect(updated.resolved).toBe(true);
    });

    it('should not fail when resolving already resolved alert', async () => {
      const alert = await storage.createAlert({
        aiSystemId: testAISystemId,
        type: 'test',
        severity: 'high',
        message: 'Test alert',
      });

      await storage.resolveAlert(alert.id);
      await storage.resolveAlert(alert.id); // Second resolution

      const [updated] = await db
        .select()
        .from(monitoringAlerts)
        .where(eq(monitoringAlerts.id, alert.id));

      expect(updated.resolved).toBe(true);
    });
  });

  describe('Alert Filtering', () => {
    it('should filter unresolved alerts by AI system', async () => {
      // Create alerts for test system
      await storage.createAlert({
        aiSystemId: testAISystemId,
        type: 'test1',
        severity: 'high',
        message: 'Unresolved 1',
      });
      await storage.createAlert({
        aiSystemId: testAISystemId,
        type: 'test2',
        severity: 'high',
        message: 'Unresolved 2',
      });

      const resolved = await storage.createAlert({
        aiSystemId: testAISystemId,
        type: 'test3',
        severity: 'high',
        message: 'Resolved',
      });
      await storage.resolveAlert(resolved.id);

      // Get unresolved alerts
      const unresolved = await db
        .select()
        .from(monitoringAlerts)
        .where(
          and(
            eq(monitoringAlerts.aiSystemId, testAISystemId),
            eq(monitoringAlerts.resolved, false)
          )
        );

      expect(unresolved).toHaveLength(2);
      expect(unresolved.every(a => !a.resolved)).toBe(true);
    });

    it('should retrieve alerts for health system via AI systems', async () => {
      // Create second AI system
      const [aiSystem2] = await db.insert(aiSystems).values({
        name: 'AI System 2',
        description: 'Second test system',
        healthSystemId: testHealthSystemId,
        usesPhi: false,
        status: 'active',
        criticalityLevel: 'medium',
        deploymentDate: new Date(),
      }).returning();

      // Create alerts for both systems
      await storage.createAlert({
        aiSystemId: testAISystemId,
        type: 'test1',
        severity: 'high',
        message: 'Alert 1',
      });
      await storage.createAlert({
        aiSystemId: aiSystem2.id,
        type: 'test2',
        severity: 'medium',
        message: 'Alert 2',
      });

      // Get all AI systems for health system
      const systems = await db
        .select()
        .from(aiSystems)
        .where(eq(aiSystems.healthSystemId, testHealthSystemId));

      expect(systems).toHaveLength(2);

      // Get alerts for all systems
      const systemIds = systems.map(s => s.id);
      const allAlerts = await db
        .select()
        .from(monitoringAlerts)
        .where(eq(monitoringAlerts.aiSystemId, systemIds[0]))
        .union(
          db.select().from(monitoringAlerts).where(eq(monitoringAlerts.aiSystemId, systemIds[1]))
        );

      expect(allAlerts.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Predictive Alerts Generation', () => {
    const predictiveAlertService = new PredictiveAlertService();

    it('should create predictive alert with all required fields', async () => {
      const [alert] = await db.insert(predictiveAlerts).values({
        aiSystemId: testAISystemId,
        predictionType: 'error_spike',
        metric: 'error_rate',
        currentValue: '0.05',
        predictedValue: '0.15',
        threshold: '0.10',
        predictedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        confidenceScore: 85,
        trendDirection: 'increasing',
        trendVelocity: '0.014286', // Per day
        datapointsAnalyzed: 30,
        severity: 'high',
        dismissed: false,
      }).returning();

      expect(alert).toMatchObject({
        aiSystemId: testAISystemId,
        predictionType: 'error_spike',
        metric: 'error_rate',
        currentValue: '0.05',
        predictedValue: '0.15',
        threshold: '0.10',
        confidenceScore: 85,
        trendDirection: 'increasing',
        severity: 'high',
        dismissed: false,
      });
      expect(alert.id).toBeDefined();
      expect(alert.predictedDate).toBeInstanceOf(Date);
    });

    it('should support all prediction types', async () => {
      const predictionTypes = [
        'drift',
        'error_spike',
        'latency_degradation',
        'bias',
        'phi_exposure',
      ];

      for (const predictionType of predictionTypes) {
        await db.insert(predictiveAlerts).values({
          aiSystemId: testAISystemId,
          predictionType,
          metric: 'test_metric',
          currentValue: '1.0',
          predictedValue: '2.0',
          threshold: '1.5',
          predictedDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          confidenceScore: 70,
          trendDirection: 'increasing',
          trendVelocity: '0.01',
          datapointsAnalyzed: 20,
          severity: 'medium',
          dismissed: false,
        });
      }

      const allPredictive = await db.select().from(predictiveAlerts);
      expect(allPredictive).toHaveLength(5);
      expect(allPredictive.map(a => a.predictionType)).toEqual(predictionTypes);
    });

    it('should allow dismissing predictive alerts', async () => {
      const [alert] = await db.insert(predictiveAlerts).values({
        aiSystemId: testAISystemId,
        predictionType: 'drift',
        metric: 'drift_score',
        currentValue: '0.02',
        predictedValue: '0.08',
        threshold: '0.05',
        predictedDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        confidenceScore: 75,
        trendDirection: 'increasing',
        trendVelocity: '0.02',
        datapointsAnalyzed: 15,
        severity: 'medium',
        dismissed: false,
      }).returning();

      const result = await predictiveAlertService.dismissAlert(alert.id);
      expect(result).toBe(true);

      const [dismissed] = await db
        .select()
        .from(predictiveAlerts)
        .where(eq(predictiveAlerts.id, alert.id));

      expect(dismissed.dismissed).toBe(true);
    });

    it('should allow actualizing predictions', async () => {
      const [alert] = await db.insert(predictiveAlerts).values({
        aiSystemId: testAISystemId,
        predictionType: 'error_spike',
        metric: 'error_rate',
        currentValue: '0.03',
        predictedValue: '0.12',
        threshold: '0.10',
        predictedDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        confidenceScore: 90,
        trendDirection: 'increasing',
        trendVelocity: '0.045',
        datapointsAnalyzed: 25,
        severity: 'critical',
        dismissed: false,
      }).returning();

      const result = await predictiveAlertService.actualizeAlert(alert.id);
      expect(result).toBe(true);

      const [actualized] = await db
        .select()
        .from(predictiveAlerts)
        .where(eq(predictiveAlerts.id, alert.id));

      expect(actualized.actualizedAt).toBeInstanceOf(Date);
    });

    it('should filter active (non-dismissed) predictive alerts', async () => {
      await db.insert(predictiveAlerts).values([
        {
          aiSystemId: testAISystemId,
          predictionType: 'drift',
          metric: 'drift_score',
          currentValue: '0.02',
          predictedValue: '0.06',
          threshold: '0.05',
          predictedDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          confidenceScore: 70,
          trendDirection: 'increasing',
          trendVelocity: '0.008',
          datapointsAnalyzed: 20,
          severity: 'low',
          dismissed: false,
        },
        {
          aiSystemId: testAISystemId,
          predictionType: 'bias',
          metric: 'bias_score',
          currentValue: '0.10',
          predictedValue: '0.25',
          threshold: '0.20',
          predictedDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          confidenceScore: 65,
          trendDirection: 'increasing',
          trendVelocity: '0.015',
          datapointsAnalyzed: 18,
          severity: 'high',
          dismissed: true, // This one is dismissed
        },
      ]);

      const active = await predictiveAlertService.getActiveAlerts(testAISystemId);
      
      expect(active).toHaveLength(1);
      expect(active[0].dismissed).toBe(false);
      expect(active[0].predictionType).toBe('drift');
    });
  });

  describe('Severity Calculation', () => {
    it('should use correct severity ordering', async () => {
      const severities = ['low', 'medium', 'high', 'critical'];
      
      for (const severity of severities) {
        await storage.createAlert({
          aiSystemId: testAISystemId,
          type: 'test',
          severity,
          message: `${severity} alert`,
        });
      }

      const alerts = await db
        .select()
        .from(monitoringAlerts)
        .where(eq(monitoringAlerts.aiSystemId, testAISystemId));

      // Verify all severities are stored correctly
      const storedSeverities = alerts.map(a => a.severity);
      expect(storedSeverities).toEqual(expect.arrayContaining(severities));
    });

    it('should maintain severity for predictive alerts', async () => {
      const severities = ['low', 'medium', 'high', 'critical'];
      
      for (const severity of severities) {
        await db.insert(predictiveAlerts).values({
          aiSystemId: testAISystemId,
          predictionType: 'drift',
          metric: 'drift_score',
          currentValue: '0.01',
          predictedValue: '0.05',
          threshold: '0.03',
          predictedDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          confidenceScore: 70,
          trendDirection: 'increasing',
          trendVelocity: '0.001',
          datapointsAnalyzed: 10,
          severity,
          dismissed: false,
        });
      }

      const alerts = await db.select().from(predictiveAlerts);
      expect(alerts).toHaveLength(4);
      expect(alerts.map(a => a.severity)).toEqual(expect.arrayContaining(severities));
    });
  });

  describe('Multi-System Alert Management', () => {
    it('should handle alerts across multiple AI systems', async () => {
      // Create second AI system
      const [aiSystem2] = await db.insert(aiSystems).values({
        name: 'AI System 2',
        description: 'Second test system',
        healthSystemId: testHealthSystemId,
        usesPhi: true,
        status: 'active',
        criticalityLevel: 'critical',
        deploymentDate: new Date(),
      }).returning();

      // Create alerts for both systems
      await storage.createAlert({
        aiSystemId: testAISystemId,
        type: 'test1',
        severity: 'high',
        message: 'Alert for system 1',
      });
      await storage.createAlert({
        aiSystemId: aiSystem2.id,
        type: 'test2',
        severity: 'critical',
        message: 'Alert for system 2',
      });

      // Verify alerts are system-specific
      const system1Alerts = await db
        .select()
        .from(monitoringAlerts)
        .where(eq(monitoringAlerts.aiSystemId, testAISystemId));
      const system2Alerts = await db
        .select()
        .from(monitoringAlerts)
        .where(eq(monitoringAlerts.aiSystemId, aiSystem2.id));

      expect(system1Alerts).toHaveLength(1);
      expect(system2Alerts).toHaveLength(1);
      expect(system1Alerts[0].message).toBe('Alert for system 1');
      expect(system2Alerts[0].message).toBe('Alert for system 2');
    });
  });
});
