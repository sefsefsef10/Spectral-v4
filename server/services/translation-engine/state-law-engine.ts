import { db } from "../../db";
import { aiSystems, stateRegulations } from "../../../shared/schema";
import { eq, and, lte, or, isNull, gte, sql } from "drizzle-orm";
import type { ParsedEvent } from "./types";
import { logger } from "../../logger";

export interface StateLawViolation {
  state: string;
  regulationName: string;
  controlId: string;
  controlName: string;
  description: string;
  requiresReporting: boolean;
  reportingDeadlineDays?: number;
  detectedAt: Date;
  affectedSystem: {
    id: string;
    name: string;
    department: string;
  };
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface AISystemContext {
  id: string;
  name: string;
  department: string;
  location?: string;
  aiSystemType?: string;
  isHighRisk?: boolean;
  isEmploymentAI?: boolean;
}

export class StateLawEngine {
  constructor() {
    logger.info("🏛️ State Law Engine initialized");
  }

  async checkCompliance(
    event: ParsedEvent,
    systemContext: AISystemContext
  ): Promise<StateLawViolation[]> {
    const violations: StateLawViolation[] = [];

    const activeRegulations = await db
      .select()
      .from(stateRegulations)
      .where(
        and(
          lte(stateRegulations.effectiveDate, new Date()),
          or(
            isNull(stateRegulations.sunsetDate),
            gte(stateRegulations.sunsetDate, new Date())
          )
        )
      );

    for (const regulation of activeRegulations) {
      const isApplicable = this.isRegulationApplicable(
        regulation,
        event,
        systemContext
      );

      if (isApplicable) {
        const violation = this.createViolation(regulation, event, systemContext);
        if (violation) {
          violations.push(violation);
        }
      }
    }

    if (violations.length > 0) {
      logger.info({
        eventType: event.eventType,
        aiSystemId: systemContext.id,
        violationCount: violations.length,
        states: violations.map(v => v.state),
      }, "State law violations detected");
    }

    return violations;
  }

  private isRegulationApplicable(
    regulation: any,
    event: ParsedEvent,
    systemContext: AISystemContext
  ): boolean {
    const mappedEventTypes = regulation.mappedEventTypes || [];
    const eventMatches = mappedEventTypes.includes(event.eventType);

    if (!eventMatches) {
      return false;
    }

    switch (regulation.state) {
      case 'CA':
        return this.isCaliforniaApplicable(regulation, systemContext);
      case 'CO':
        return this.isColoradoApplicable(regulation, systemContext);
      case 'NY':
        return this.isNewYorkApplicable(regulation, systemContext);
      default:
        return false;
    }
  }

  private isCaliforniaApplicable(regulation: any, system: AISystemContext): boolean {
    if (regulation.regulationName === 'CA SB 1047') {
      // Geographic gate: Must be in California OR explicitly serving California
      const inCalifornia = system.location?.toLowerCase() === 'california' || 
                          system.location?.toLowerCase() === 'ca';
      
      if (!inCalifornia) {
        return false;
      }
      
      // Within California, apply to high-risk AI only
      return (
        system.isHighRisk === true ||
        this.isHighRiskAIType(system.department)
      );
    }
    return false;
  }

  private isColoradoApplicable(regulation: any, system: AISystemContext): boolean {
    if (regulation.regulationName === 'Colorado AI Act') {
      // Geographic gate: Must be in Colorado OR explicitly serving Colorado
      const inColorado = system.location?.toLowerCase() === 'colorado' || 
                        system.location?.toLowerCase() === 'co';
      
      if (!inColorado) {
        return false;
      }
      
      // Within Colorado, apply to high-impact AI only
      return (
        system.isHighRisk === true ||
        this.isHighImpactAIType(system.department)
      );
    }
    return false;
  }

  private isNewYorkApplicable(regulation: any, system: AISystemContext): boolean {
    if (regulation.regulationName === 'NYC Local Law 144') {
      // Geographic gate: Must be in New York OR explicitly serving New York
      const inNewYork = system.location?.toLowerCase() === 'new york' || 
                       system.location?.toLowerCase() === 'ny' ||
                       system.location?.toLowerCase() === 'nyc';
      
      if (!inNewYork) {
        return false;
      }
      
      // Within New York, apply to employment AI only
      return (
        system.isEmploymentAI === true ||
        system.department === 'HR' ||
        system.name.toLowerCase().includes('hiring') ||
        system.name.toLowerCase().includes('recruitment')
      );
    }
    return false;
  }

  private isHighRiskAIType(department: string): boolean {
    const highRiskDepartments = [
      'Imaging',
      'Pathology',
      'Emergency',
      'Surgery',
      'Intensive Care',
      'Cardiology',
    ];
    return highRiskDepartments.includes(department);
  }

  private isHighImpactAIType(department: string): boolean {
    const highImpactDepartments = [
      'Imaging',
      'Pathology',
      'Emergency',
      'Surgery',
      'HR',
      'Finance',
    ];
    return highImpactDepartments.includes(department);
  }

  private createViolation(
    regulation: any,
    event: ParsedEvent,
    systemContext: AISystemContext
  ): StateLawViolation | null {
    const detectionLogic = regulation.detectionLogic || {};
    const severity = this.calculateSeverity(event, detectionLogic);

    return {
      state: regulation.state,
      regulationName: regulation.regulationName,
      controlId: regulation.controlId,
      controlName: regulation.controlName,
      description: this.buildDescription(regulation, event, systemContext),
      requiresReporting: regulation.requiresReporting || false,
      reportingDeadlineDays: regulation.reportingDeadlineDays,
      detectedAt: event.metadata.timestamp,
      affectedSystem: {
        id: systemContext.id,
        name: systemContext.name,
        department: systemContext.department,
      },
      severity,
    };
  }

  private calculateSeverity(
    event: ParsedEvent,
    detectionLogic: any
  ): 'critical' | 'high' | 'medium' | 'low' {
    if (event.severity === 'critical') return 'critical';

    const severityMapping = detectionLogic.severityMapping || {};
    return severityMapping[event.eventType] || event.severity || 'medium';
  }

  private buildDescription(
    regulation: any,
    event: ParsedEvent,
    systemContext: AISystemContext
  ): string {
    const baseDescription = regulation.description;
    
    return `${baseDescription} Violation detected on ${systemContext.name} (${systemContext.department}). Event: ${event.eventType}. Immediate review required.`;
  }

  async seedStateRegulations(): Promise<void> {
    logger.info("🌱 Seeding state regulations...");

    const existingCount = await db.select().from(stateRegulations);
    if (existingCount.length > 0) {
      logger.info("State regulations already seeded, skipping...");
      return;
    }

    const regulations = [
      {
        state: 'CA',
        regulationName: 'CA SB 1047',
        controlId: 'CA-SB1047-1',
        controlName: 'Safety Testing Requirements',
        description: 'Covered AI models must undergo safety testing before deployment.',
        requiresReporting: true,
        reportingDeadlineDays: 30,
        effectiveDate: new Date('2024-01-01'),
        sunsetDate: null,
        mappedEventTypes: ['clinical_accuracy_failure', 'harmful_output', 'model_drift'],
        detectionLogic: {
          severityMapping: {
            clinical_accuracy_failure: 'critical',
            harmful_output: 'critical',
            model_drift: 'high',
          },
        },
      },
      {
        state: 'CA',
        regulationName: 'CA SB 1047',
        controlId: 'CA-SB1047-2',
        controlName: 'Incident Reporting',
        description: 'Developers must report safety incidents within specified timeframes.',
        requiresReporting: true,
        reportingDeadlineDays: 10,
        effectiveDate: new Date('2024-01-01'),
        sunsetDate: null,
        mappedEventTypes: ['harmful_output', 'phi_exposure', 'unauthorized_data_access'],
        detectionLogic: {
          severityMapping: {
            harmful_output: 'critical',
            phi_exposure: 'critical',
            unauthorized_data_access: 'critical',
          },
        },
      },
      {
        state: 'CO',
        regulationName: 'Colorado AI Act',
        controlId: 'CO-AI-1',
        controlName: 'Algorithmic Impact Assessment',
        description: 'High-risk AI systems require impact assessments covering discrimination risks.',
        requiresReporting: true,
        reportingDeadlineDays: 60,
        effectiveDate: new Date('2024-02-01'),
        sunsetDate: null,
        mappedEventTypes: ['bias_detected', 'disparate_impact', 'fairness_threshold_violation'],
        detectionLogic: {
          severityMapping: {
            bias_detected: 'high',
            disparate_impact: 'high',
            fairness_threshold_violation: 'high',
          },
        },
      },
      {
        state: 'CO',
        regulationName: 'Colorado AI Act',
        controlId: 'CO-AI-2',
        controlName: 'Consumer Notice Requirements',
        description: 'Consumers must be notified when consequential decisions are made by AI.',
        requiresReporting: false,
        reportingDeadlineDays: null,
        effectiveDate: new Date('2024-02-01'),
        sunsetDate: null,
        mappedEventTypes: ['explainability_failure'],
        detectionLogic: {
          severityMapping: {
            explainability_failure: 'medium',
          },
        },
      },
      {
        state: 'NY',
        regulationName: 'NYC Local Law 144',
        controlId: 'NYC-LL144-1',
        controlName: 'Bias Audit Requirement',
        description: 'Employment automated decision tools must undergo annual bias audits.',
        requiresReporting: true,
        reportingDeadlineDays: 90,
        effectiveDate: new Date('2023-07-05'),
        sunsetDate: null,
        mappedEventTypes: ['bias_detected', 'disparate_impact', 'fairness_threshold_violation', 'explainability_failure'],
        detectionLogic: {
          severityMapping: {
            bias_detected: 'high',
            disparate_impact: 'high',
            fairness_threshold_violation: 'high',
            explainability_failure: 'high',
          },
        },
      },
      {
        state: 'NY',
        regulationName: 'NYC Local Law 144',
        controlId: 'NYC-LL144-2',
        controlName: 'Candidate Notice Requirement',
        description: 'Employers must notify candidates when using automated employment decision tools.',
        requiresReporting: false,
        reportingDeadlineDays: null,
        effectiveDate: new Date('2023-07-05'),
        sunsetDate: null,
        mappedEventTypes: ['explainability_failure'],
        detectionLogic: {
          severityMapping: {
            explainability_failure: 'medium',
          },
        },
      },
    ];

    for (const reg of regulations) {
      await db.insert(stateRegulations).values(reg);
    }

    logger.info({
      count: regulations.length,
      states: ['CA', 'CO', 'NY'],
    }, "✅ State regulations seeded successfully");
  }
}

export const stateLawEngine = new StateLawEngine();
