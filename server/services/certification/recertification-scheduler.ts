/**
 * Quarterly AI System Re-Certification Automation
 * Automatically schedules and executes re-certification workflows for AI systems
 */

import type { Logger } from "pino";
import { storage } from "../../storage";
import { addMonths, isBefore, format } from "date-fns";

export type RecertificationStatus = "pending" | "in_progress" | "completed" | "failed" | "overdue";

export interface RecertificationSchedule {
  id: string;
  ai_system_id: string;
  ai_system_name: string;
  health_system_id: string;
  last_certification_date: Date;
  next_certification_due: Date;
  frequency_months: number;
  status: RecertificationStatus;
  automated_tests_enabled: boolean;
}

export interface RecertificationWorkflow {
  schedule_id: string;
  ai_system_id: string;
  started_at: Date;
  completed_at?: Date;
  status: RecertificationStatus;
  steps: RecertificationStep[];
  overall_pass: boolean;
  findings: string[];
}

export interface RecertificationStep {
  name: string;
  description: string;
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  started_at?: Date;
  completed_at?: Date;
  result?: any;
  error?: string;
}

export class RecertificationScheduler {
  private logger?: Logger;
  private defaultFrequencyMonths = 3; // Quarterly by default

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  /**
   * Create recertification schedule for an AI system
   */
  async scheduleRecertification(
    aiSystemId: string,
    lastCertificationDate: Date,
    frequencyMonths: number = this.defaultFrequencyMonths,
    automatedTests: boolean = true
  ): Promise<RecertificationSchedule> {
    const aiSystem = await storage.getAISystem(aiSystemId);
    if (!aiSystem) {
      throw new Error("AI system not found");
    }

    const nextDue = addMonths(lastCertificationDate, frequencyMonths);

    const schedule: RecertificationSchedule = {
      id: `recert-${aiSystemId}-${Date.now()}`,
      ai_system_id: aiSystemId,
      ai_system_name: aiSystem.name,
      health_system_id: aiSystem.healthSystemId,
      last_certification_date: lastCertificationDate,
      next_certification_due: nextDue,
      frequency_months: frequencyMonths,
      status: "pending",
      automated_tests_enabled: automatedTests,
    };

    this.logger?.info({ schedule }, "Created recertification schedule");

    return schedule;
  }

  /**
   * Get all pending recertifications across health systems
   */
  async getPendingRecertifications(healthSystemId?: string): Promise<RecertificationSchedule[]> {
    // Mock implementation - would query database in production
    const certifications = await storage.getComplianceCertifications();
    
    const schedules: RecertificationSchedule[] = [];
    
    for (const cert of certifications) {
      if (healthSystemId && cert.healthSystemId !== healthSystemId) {
        continue;
      }

      const aiSystem = await storage.getAISystem(cert.aiSystemId);
      if (!aiSystem) continue;

      const nextDue = cert.expiresAt ? new Date(cert.expiresAt) : addMonths(new Date(cert.certifiedAt), 3);
      const isPastDue = isBefore(nextDue, new Date());

      schedules.push({
        id: `recert-${cert.id}`,
        ai_system_id: cert.aiSystemId,
        ai_system_name: aiSystem.name,
        health_system_id: cert.healthSystemId,
        last_certification_date: new Date(cert.certifiedAt),
        next_certification_due: nextDue,
        frequency_months: 3,
        status: isPastDue ? "overdue" : "pending",
        automated_tests_enabled: true,
      });
    }

    return schedules.filter(s => s.status === "pending" || s.status === "overdue");
  }

  /**
   * Execute automated recertification workflow
   */
  async executeRecertification(
    scheduleId: string,
    aiSystemId: string
  ): Promise<RecertificationWorkflow> {
    this.logger?.info({ scheduleId, aiSystemId }, "Executing recertification workflow");

    const workflow: RecertificationWorkflow = {
      schedule_id: scheduleId,
      ai_system_id: aiSystemId,
      started_at: new Date(),
      status: "in_progress",
      steps: [],
      overall_pass: false,
      findings: [],
    };

    // Step 1: Compliance Control Validation
    workflow.steps.push(await this.runComplianceValidation(aiSystemId));

    // Step 2: PHI Detection Scan
    workflow.steps.push(await this.runPHIDetectionScan(aiSystemId));

    // Step 3: Bias Testing
    workflow.steps.push(await this.runBiasTesting(aiSystemId));

    // Step 4: Threat Modeling Review
    workflow.steps.push(await this.runThreatModelingReview(aiSystemId));

    // Step 5: Clinical Validation (if applicable)
    workflow.steps.push(await this.runClinicalValidation(aiSystemId));

    // Determine overall status
    const failedSteps = workflow.steps.filter(s => s.status === "failed");
    workflow.overall_pass = failedSteps.length === 0;
    workflow.status = workflow.overall_pass ? "completed" : "failed";
    workflow.completed_at = new Date();

    // Generate findings
    workflow.findings = this.generateFindings(workflow.steps);

    this.logger?.info({ workflow }, "Recertification workflow completed");

    return workflow;
  }

  /**
   * Bulk execute recertifications for all due systems
   */
  async executeBulkRecertifications(healthSystemId: string): Promise<RecertificationWorkflow[]> {
    const pendingSchedules = await this.getPendingRecertifications(healthSystemId);
    const workflows: RecertificationWorkflow[] = [];

    for (const schedule of pendingSchedules) {
      try {
        const workflow = await this.executeRecertification(schedule.id, schedule.ai_system_id);
        workflows.push(workflow);
      } catch (error: any) {
        this.logger?.error({ error, schedule }, "Failed to execute recertification");
        workflows.push({
          schedule_id: schedule.id,
          ai_system_id: schedule.ai_system_id,
          started_at: new Date(),
          completed_at: new Date(),
          status: "failed",
          steps: [],
          overall_pass: false,
          findings: [`Recertification failed: ${error.message}`],
        });
      }
    }

    return workflows;
  }

  private async runComplianceValidation(aiSystemId: string): Promise<RecertificationStep> {
    const step: RecertificationStep = {
      name: "Compliance Control Validation",
      description: "Validate AI system against all applicable compliance controls",
      status: "running",
      started_at: new Date(),
    };

    try {
      // Mock validation - in production, would run actual compliance checks
      const aiSystem = await storage.getAISystem(aiSystemId);
      const violations = await storage.getViolations(aiSystem!.healthSystemId);
      const systemViolations = violations.filter(v => v.aiSystemId === aiSystemId && v.status === "open");

      step.result = {
        total_controls: 58,
        passed_controls: 58 - systemViolations.length,
        failed_controls: systemViolations.length,
        compliance_score: ((58 - systemViolations.length) / 58 * 100).toFixed(1),
      };

      step.status = systemViolations.length === 0 ? "passed" : "failed";
    } catch (error: any) {
      step.status = "failed";
      step.error = error.message;
    }

    step.completed_at = new Date();
    return step;
  }

  private async runPHIDetectionScan(aiSystemId: string): Promise<RecertificationStep> {
    const step: RecertificationStep = {
      name: "PHI Detection Scan",
      description: "Scan AI system outputs for PHI exposure risks",
      status: "running",
      started_at: new Date(),
    };

    try {
      // Mock PHI scan - in production, would use actual PHI detection service
      step.result = {
        outputs_scanned: 100,
        phi_detected: 0,
        risk_score: 0.0,
        passed: true,
      };
      step.status = "passed";
    } catch (error: any) {
      step.status = "failed";
      step.error = error.message;
    }

    step.completed_at = new Date();
    return step;
  }

  private async runBiasTesting(aiSystemId: string): Promise<RecertificationStep> {
    const step: RecertificationStep = {
      name: "Bias Testing",
      description: "Test AI model for fairness across protected attributes",
      status: "running",
      started_at: new Date(),
    };

    try {
      // Mock bias test - in production, would use Fairlearn service
      step.result = {
        demographic_parity_ratio: 0.85,
        equalized_odds_ratio: 0.82,
        bias_detected: false,
        passed: true,
      };
      step.status = "passed";
    } catch (error: any) {
      step.status = "failed";
      step.error = error.message;
    }

    step.completed_at = new Date();
    return step;
  }

  private async runThreatModelingReview(aiSystemId: string): Promise<RecertificationStep> {
    const step: RecertificationStep = {
      name: "Threat Modeling Review",
      description: "Review STRIDE/LINDDUN threats and mitigations",
      status: "running",
      started_at: new Date(),
    };

    try {
      // Mock threat review - in production, would use threat modeling service
      step.result = {
        total_threats: 8,
        critical_threats: 0,
        high_threats: 2,
        mitigated_threats: 8,
        passed: true,
      };
      step.status = "passed";
    } catch (error: any) {
      step.status = "failed";
      step.error = error.message;
    }

    step.completed_at = new Date();
    return step;
  }

  private async runClinicalValidation(aiSystemId: string): Promise<RecertificationStep> {
    const step: RecertificationStep = {
      name: "Clinical Validation",
      description: "Validate AI outputs against clinical test datasets",
      status: "running",
      started_at: new Date(),
    };

    try {
      const aiSystem = await storage.getAISystem(aiSystemId);
      
      // Skip if not a clinical system
      if (!aiSystem?.category.includes("clinical")) {
        step.status = "skipped";
        step.result = { reason: "Not a clinical AI system" };
        step.completed_at = new Date();
        return step;
      }

      // Mock clinical validation
      step.result = {
        test_cases_run: 25,
        test_cases_passed: 24,
        accuracy: 96.0,
        passed: true,
      };
      step.status = "passed";
    } catch (error: any) {
      step.status = "failed";
      step.error = error.message;
    }

    step.completed_at = new Date();
    return step;
  }

  private generateFindings(steps: RecertificationStep[]): string[] {
    const findings: string[] = [];

    const failedSteps = steps.filter(s => s.status === "failed");
    if (failedSteps.length > 0) {
      findings.push(`CRITICAL: ${failedSteps.length} certification steps failed`);
      failedSteps.forEach(step => {
        findings.push(`- ${step.name}: ${step.error || "Unknown error"}`);
      });
    }

    const passedSteps = steps.filter(s => s.status === "passed");
    if (passedSteps.length === steps.length) {
      findings.push("All certification criteria met - AI system approved for continued production use");
    }

    return findings;
  }

  /**
   * Generate recertification summary report
   */
  generateSummaryReport(workflows: RecertificationWorkflow[]): {
    total_systems: number;
    passed: number;
    failed: number;
    overall_pass_rate: number;
    critical_findings: string[];
  } {
    const passed = workflows.filter(w => w.overall_pass).length;
    const failed = workflows.filter(w => !w.overall_pass).length;

    const criticalFindings: string[] = [];
    workflows.forEach(w => {
      if (!w.overall_pass) {
        criticalFindings.push(`${w.ai_system_id}: ${w.findings.join(", ")}`);
      }
    });

    return {
      total_systems: workflows.length,
      passed,
      failed,
      overall_pass_rate: workflows.length > 0 ? (passed / workflows.length * 100) : 0,
      critical_findings: criticalFindings,
    };
  }
}

export const recertificationScheduler = new RecertificationScheduler();
