/**
 * AISystem Domain Entity Tests
 * 
 * Tests business logic encapsulated in the AISystem entity.
 */

import { describe, it, expect } from 'vitest';
import {
  AISystem,
  RiskLevel,
  SystemStatus,
  ProviderType
} from '../../../../server/domain/entities/AISystem';

describe('AISystem Domain Entity', () => {
  describe('create', () => {
    it('should create AISystem with required fields', () => {
      const system = AISystem.create('hs-123', 'Clinical AI Assistant');

      expect(system.healthSystemId).toBe('hs-123');
      expect(system.name).toBe('Clinical AI Assistant');
      expect(system.riskLevel).toBe(RiskLevel.MEDIUM); // Default
      expect(system.status).toBe(SystemStatus.TESTING); // Default
      expect(system.usesPHI).toBe(false); // Default
      expect(system.monitoringEnabled).toBe(false); // Default
    });

    it('should create AISystem with all optional fields', () => {
      const system = AISystem.create('hs-123', 'Radiology AI', {
        description: 'Automated chest X-ray analysis',
        riskLevel: RiskLevel.HIGH,
        status: SystemStatus.ACTIVE,
        usesPHI: true,
        fdaClassification: 'Class II',
        category: 'Medical Imaging',
        clinicalUseCase: 'Diagnostic Support',
        department: 'Radiology',
        monitoringEnabled: true,
        vendorId: 'vendor-456'
      });

      expect(system.description).toBe('Automated chest X-ray analysis');
      expect(system.riskLevel).toBe(RiskLevel.HIGH);
      expect(system.status).toBe(SystemStatus.ACTIVE);
      expect(system.usesPHI).toBe(true);
      expect(system.fdaClassification).toBe('Class II');
      expect(system.monitoringEnabled).toBe(true);
    });

    it('should throw error if name is less than 3 characters', () => {
      expect(() => {
        AISystem.create('hs-123', 'AI');
      }).toThrow('AI system name must be at least 3 characters');
    });

    it('should throw error if high risk system created without monitoring', () => {
      expect(() => {
        AISystem.create('hs-123', 'Critical System', {
          riskLevel: RiskLevel.HIGH,
          monitoringEnabled: false
        });
      }).toThrow('High and critical risk AI systems must have monitoring enabled');
    });

    it('should throw error if critical risk system created without monitoring', () => {
      expect(() => {
        AISystem.create('hs-123', 'Life Support AI', {
          riskLevel: RiskLevel.CRITICAL,
          monitoringEnabled: false
        });
      }).toThrow('High and critical risk AI systems must have monitoring enabled');
    });

    it('should allow low/medium risk systems without monitoring', () => {
      const lowRisk = AISystem.create('hs-123', 'Low Risk System', {
        riskLevel: RiskLevel.LOW,
        monitoringEnabled: false
      });

      const mediumRisk = AISystem.create('hs-123', 'Medium Risk System', {
        riskLevel: RiskLevel.MEDIUM,
        monitoringEnabled: false
      });

      expect(lowRisk.monitoringEnabled).toBe(false);
      expect(mediumRisk.monitoringEnabled).toBe(false);
    });

    it('should throw error if providerType set without providerSystemId', () => {
      expect(() => {
        AISystem.create('hs-123', 'Synced System', {
          providerType: ProviderType.EPIC
          // Missing providerSystemId
        });
      }).toThrow('Provider-synced systems must have both providerType and providerSystemId');
    });

    it('should throw error if providerSystemId set without providerType', () => {
      expect(() => {
        AISystem.create('hs-123', 'Synced System', {
          providerSystemId: 'epic-ai-123'
          // Missing providerType
        });
      }).toThrow('Provider-synced systems must have both providerType and providerSystemId');
    });

    it('should allow provider-synced system with both fields', () => {
      const system = AISystem.create('hs-123', 'Epic AI System', {
        providerType: ProviderType.EPIC,
        providerSystemId: 'epic-ai-123'
      });

      expect(system.providerType).toBe(ProviderType.EPIC);
      expect(system.providerSystemId).toBe('epic-ai-123');
    });
  });

  describe('status transitions', () => {
    it('should allow testing → active transition', () => {
      const system = AISystem.create('hs-123', 'Test System', {
        status: SystemStatus.TESTING
      });

      expect(system.canTransitionTo(SystemStatus.ACTIVE)).toBe(true);
      system.updateStatus(SystemStatus.ACTIVE);
      expect(system.status).toBe(SystemStatus.ACTIVE);
    });

    it('should allow testing → deprecated transition', () => {
      const system = AISystem.create('hs-123', 'Test System', {
        status: SystemStatus.TESTING
      });

      expect(system.canTransitionTo(SystemStatus.DEPRECATED)).toBe(true);
      system.updateStatus(SystemStatus.DEPRECATED);
      expect(system.status).toBe(SystemStatus.DEPRECATED);
    });

    it('should allow active → paused transition', () => {
      const system = AISystem.create('hs-123', 'Active System', {
        status: SystemStatus.ACTIVE,
        monitoringEnabled: true
      });

      expect(system.canTransitionTo(SystemStatus.PAUSED)).toBe(true);
      system.updateStatus(SystemStatus.PAUSED);
      expect(system.status).toBe(SystemStatus.PAUSED);
    });

    it('should allow active → deprecated transition', () => {
      const system = AISystem.create('hs-123', 'Active System', {
        status: SystemStatus.ACTIVE,
        monitoringEnabled: true
      });

      expect(system.canTransitionTo(SystemStatus.DEPRECATED)).toBe(true);
      system.updateStatus(SystemStatus.DEPRECATED);
      expect(system.status).toBe(SystemStatus.DEPRECATED);
    });

    it('should allow paused → active transition', () => {
      const system = AISystem.create('hs-123', 'Paused System', {
        status: SystemStatus.PAUSED,
        monitoringEnabled: true
      });

      expect(system.canTransitionTo(SystemStatus.ACTIVE)).toBe(true);
      system.updateStatus(SystemStatus.ACTIVE);
      expect(system.status).toBe(SystemStatus.ACTIVE);
    });

    it('should NOT allow testing → paused transition', () => {
      const system = AISystem.create('hs-123', 'Test System', {
        status: SystemStatus.TESTING
      });

      expect(system.canTransitionTo(SystemStatus.PAUSED)).toBe(false);
      expect(() => {
        system.updateStatus(SystemStatus.PAUSED);
      }).toThrow('Invalid status transition');
    });

    it('should NOT allow deprecated → any transition (terminal state)', () => {
      const system = AISystem.create('hs-123', 'Deprecated System', {
        status: SystemStatus.DEPRECATED
      });

      expect(system.canTransitionTo(SystemStatus.ACTIVE)).toBe(false);
      expect(system.canTransitionTo(SystemStatus.PAUSED)).toBe(false);
      expect(system.canTransitionTo(SystemStatus.TESTING)).toBe(false);
    });
  });

  describe('risk level updates', () => {
    it('should update risk level', () => {
      const system = AISystem.create('hs-123', 'Low Risk System', {
        riskLevel: RiskLevel.LOW
      });

      system.updateRiskLevel(RiskLevel.MEDIUM);
      expect(system.riskLevel).toBe(RiskLevel.MEDIUM);
    });

    it('should auto-enable monitoring when upgrading to HIGH risk', () => {
      const system = AISystem.create('hs-123', 'Medium Risk System', {
        riskLevel: RiskLevel.MEDIUM,
        monitoringEnabled: false
      });

      system.updateRiskLevel(RiskLevel.HIGH);
      expect(system.riskLevel).toBe(RiskLevel.HIGH);
      expect(system.monitoringEnabled).toBe(true); // Auto-enabled
    });

    it('should auto-enable monitoring when upgrading to CRITICAL risk', () => {
      const system = AISystem.create('hs-123', 'High Risk System', {
        riskLevel: RiskLevel.HIGH,
        monitoringEnabled: true
      });

      system.updateRiskLevel(RiskLevel.CRITICAL);
      expect(system.riskLevel).toBe(RiskLevel.CRITICAL);
      expect(system.monitoringEnabled).toBe(true);
    });

    it('should update updatedAt timestamp when risk level changes', () => {
      const system = AISystem.create('hs-123', 'Test System');
      const originalUpdatedAt = system.updatedAt;

      // Wait a tiny bit to ensure timestamp changes
      setTimeout(() => {
        system.updateRiskLevel(RiskLevel.HIGH);
        expect(system.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
      }, 10);
    });
  });

  describe('property updates', () => {
    it('should update basic properties', () => {
      const system = AISystem.create('hs-123', 'Original Name');

      system.updateProperties({
        name: 'Updated Name',
        description: 'New description',
        category: 'Diagnostics',
        department: 'Emergency'
      });

      expect(system.name).toBe('Updated Name');
      expect(system.description).toBe('New description');
      expect(system.category).toBe('Diagnostics');
      expect(system.department).toBe('Emergency');
    });

    it('should validate name length after update', () => {
      const system = AISystem.create('hs-123', 'Valid Name');

      expect(() => {
        system.updateProperties({ name: 'AI' });
      }).toThrow('AI system name must be at least 3 characters');
    });

    it('should update PHI flag', () => {
      const system = AISystem.create('hs-123', 'Test System', {
        usesPHI: false
      });

      system.updateProperties({ usesPHI: true });
      expect(system.usesPHI).toBe(true);
    });

    it('should update FDA classification', () => {
      const system = AISystem.create('hs-123', 'Medical Device');

      system.updateProperties({ fdaClassification: 'Class II' });
      expect(system.fdaClassification).toBe('Class II');
    });

    it('should update integration config', () => {
      const system = AISystem.create('hs-123', 'Monitored System');

      const config = {
        apiKey: 'sk-test-123',
        baseUrl: 'https://api.vendor.com'
      };

      system.updateProperties({ integrationConfig: config });
      expect(system.integrationConfig).toEqual(config);
    });

    it('should update vendorId', () => {
      const system = AISystem.create('hs-123', 'Vendor System');

      system.updateProperties({ vendorId: 'vendor-789' });
      expect(system.vendorId).toBe('vendor-789');
    });
  });

  describe('monitoring checks', () => {
    it('should record monitoring check with timestamp', () => {
      const system = AISystem.create('hs-123', 'Test System');

      expect(system.lastCheck).toBeNull();

      system.recordCheck();
      expect(system.lastCheck).toBeInstanceOf(Date);
      expect(system.lastCheck!.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should update updatedAt when recording check', () => {
      const system = AISystem.create('hs-123', 'Test System');
      const originalUpdatedAt = system.updatedAt;

      setTimeout(() => {
        system.recordCheck();
        expect(system.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
      }, 10);
    });
  });

  describe('business logic - requiresMonitoring', () => {
    it('should require monitoring for HIGH risk systems', () => {
      const system = AISystem.create('hs-123', 'High Risk System', {
        riskLevel: RiskLevel.HIGH,
        monitoringEnabled: true
      });

      expect(system.requiresMonitoring()).toBe(true);
    });

    it('should require monitoring for CRITICAL risk systems', () => {
      const system = AISystem.create('hs-123', 'Critical System', {
        riskLevel: RiskLevel.CRITICAL,
        monitoringEnabled: true
      });

      expect(system.requiresMonitoring()).toBe(true);
    });

    it('should require monitoring for PHI-using systems', () => {
      const system = AISystem.create('hs-123', 'PHI System', {
        riskLevel: RiskLevel.LOW,
        usesPHI: true,
        monitoringEnabled: true
      });

      expect(system.requiresMonitoring()).toBe(true);
    });

    it('should NOT require monitoring for LOW risk, no PHI systems', () => {
      const system = AISystem.create('hs-123', 'Low Risk System', {
        riskLevel: RiskLevel.LOW,
        usesPHI: false
      });

      expect(system.requiresMonitoring()).toBe(false);
    });
  });

  describe('business logic - isProductionReady', () => {
    it('should be production-ready if active with monitoring', () => {
      const system = AISystem.create('hs-123', 'Production System', {
        status: SystemStatus.ACTIVE,
        monitoringEnabled: true
      });

      expect(system.isProductionReady()).toBe(true);
    });

    it('should NOT be production-ready if still testing', () => {
      const system = AISystem.create('hs-123', 'Test System', {
        status: SystemStatus.TESTING,
        monitoringEnabled: true
      });

      expect(system.isProductionReady()).toBe(false);
    });

    it('should NOT be production-ready if monitoring disabled', () => {
      const system = AISystem.create('hs-123', 'Active System', {
        status: SystemStatus.ACTIVE,
        monitoringEnabled: false
      });

      expect(system.isProductionReady()).toBe(false);
    });

    it('should NOT be production-ready if paused', () => {
      const system = AISystem.create('hs-123', 'Paused System', {
        status: SystemStatus.PAUSED,
        monitoringEnabled: true
      });

      expect(system.isProductionReady()).toBe(false);
    });
  });

  describe('business logic - needsAttention', () => {
    it('should need attention if high-risk system not checked in 24+ hours', () => {
      const system = AISystem.create('hs-123', 'High Risk System', {
        riskLevel: RiskLevel.HIGH,
        monitoringEnabled: true
      });

      // Manually set lastCheck to 25 hours ago
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const snapshot = system.toSnapshot();
      snapshot.lastCheck = twentyFiveHoursAgo;
      const oldSystem = AISystem.fromPersistence(snapshot);

      expect(oldSystem.needsAttention()).toBe(true);
    });

    it('should NOT need attention if high-risk system checked recently', () => {
      const system = AISystem.create('hs-123', 'High Risk System', {
        riskLevel: RiskLevel.HIGH,
        monitoringEnabled: true
      });

      system.recordCheck(); // Check now
      expect(system.needsAttention()).toBe(false);
    });

    it('should NOT need attention if low-risk system never checked', () => {
      const system = AISystem.create('hs-123', 'Low Risk System', {
        riskLevel: RiskLevel.LOW
      });

      expect(system.needsAttention()).toBe(false);
    });
  });

  describe('persistence', () => {
    it('should convert to snapshot for persistence', () => {
      const system = AISystem.create('hs-123', 'Test System', {
        description: 'Test description',
        riskLevel: RiskLevel.HIGH,
        monitoringEnabled: true
      });

      const snapshot = system.toSnapshot();

      expect(snapshot.healthSystemId).toBe('hs-123');
      expect(snapshot.name).toBe('Test System');
      expect(snapshot.description).toBe('Test description');
      expect(snapshot.riskLevel).toBe(RiskLevel.HIGH);
      expect(snapshot.monitoringEnabled).toBe(true);
    });

    it('should reconstitute from persistence snapshot', () => {
      const originalSystem = AISystem.create('hs-123', 'Original System', {
        description: 'Original description',
        riskLevel: RiskLevel.CRITICAL,
        monitoringEnabled: true
      });

      const snapshot = originalSystem.toSnapshot();
      snapshot.id = 'ai-456'; // Repository would set this

      const reconstituted = AISystem.fromPersistence(snapshot);

      expect(reconstituted.id).toBe('ai-456');
      expect(reconstituted.healthSystemId).toBe('hs-123');
      expect(reconstituted.name).toBe('Original System');
      expect(reconstituted.description).toBe('Original description');
      expect(reconstituted.riskLevel).toBe(RiskLevel.CRITICAL);
    });
  });
});
