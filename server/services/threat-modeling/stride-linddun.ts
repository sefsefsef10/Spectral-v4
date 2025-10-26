/**
 * STRIDE & LINDDUN Threat Modeling Framework
 * 
 * STRIDE: Security threat modeling (Microsoft)
 * - Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege
 * 
 * LINDDUN: Privacy threat modeling
 * - Linkability, Identifiability, Non-repudiation, Detectability, Disclosure of information, Unawareness, Non-compliance
 */

import type { Logger } from "pino";

export type STRIDEThreatCategory = 
  | "spoofing"
  | "tampering"
  | "repudiation"
  | "information_disclosure"
  | "denial_of_service"
  | "elevation_of_privilege";

export type LINDDUNThreatCategory = 
  | "linkability"
  | "identifiability"
  | "non_repudiation"
  | "detectability"
  | "disclosure"
  | "unawareness"
  | "non_compliance";

export type ThreatSeverity = "critical" | "high" | "medium" | "low";
export type ThreatLikelihood = "very_likely" | "likely" | "possible" | "unlikely";

export interface ThreatModelingResult {
  ai_system_id: string;
  stride_threats: STRIDEThreat[];
  linddun_threats: LINDDUNThreat[];
  total_threats: number;
  critical_count: number;
  high_count: number;
  risk_score: number;
  recommendations: string[];
}

export interface STRIDEThreat {
  category: STRIDEThreatCategory;
  title: string;
  description: string;
  severity: ThreatSeverity;
  likelihood: ThreatLikelihood;
  risk_score: number;
  mitigations: string[];
  affected_components: string[];
}

export interface LINDDUNThreat {
  category: LINDDUNThreatCategory;
  title: string;
  description: string;
  severity: ThreatSeverity;
  likelihood: ThreatLikelihood;
  risk_score: number;
  mitigations: string[];
  phi_risk: boolean;
}

export interface AISystemContext {
  name: string;
  category: string;
  deployment_environment: string;
  data_access: string[];
  integration_points: string[];
  phi_handling: boolean;
  user_roles: string[];
}

export class ThreatModelingService {
  private logger?: Logger;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  async analyzeAISystem(
    aiSystemId: string,
    context: AISystemContext
  ): Promise<ThreatModelingResult> {
    this.logger?.info({ aiSystemId, context }, "Analyzing AI system for threats");

    const strideThreats = this.identifySTRIDEThreats(context);
    const linddunThreats = this.identifyLINDDUNThreats(context);

    const allThreats = [...strideThreats, ...linddunThreats];
    const criticalCount = allThreats.filter(t => t.severity === "critical").length;
    const highCount = allThreats.filter(t => t.severity === "high").length;

    const riskScore = this.calculateRiskScore(strideThreats, linddunThreats);
    const recommendations = this.generateRecommendations(strideThreats, linddunThreats, context);

    return {
      ai_system_id: aiSystemId,
      stride_threats: strideThreats,
      linddun_threats: linddunThreats,
      total_threats: allThreats.length,
      critical_count: criticalCount,
      high_count: highCount,
      risk_score: riskScore,
      recommendations
    };
  }

  private identifySTRIDEThreats(context: AISystemContext): STRIDEThreat[] {
    const threats: STRIDEThreat[] = [];

    // Spoofing threats
    if (context.integration_points.length > 0) {
      threats.push({
        category: "spoofing",
        title: "External Integration Spoofing",
        description: "Malicious actors could impersonate external systems (e.g., EHR, monitoring platforms) to inject falsified data into the AI system",
        severity: context.phi_handling ? "critical" : "high",
        likelihood: "possible",
        risk_score: context.phi_handling ? 9 : 7,
        mitigations: [
          "Implement webhook signature verification for all external integrations",
          "Use mutual TLS authentication for system-to-system communication",
          "Validate all incoming data against expected schemas",
          "Implement API key rotation policies"
        ],
        affected_components: context.integration_points
      });
    }

    // Tampering threats
    if (context.phi_handling) {
      threats.push({
        category: "tampering",
        title: "Model Output Manipulation",
        description: "Attackers could tamper with AI model outputs in transit, potentially altering clinical recommendations or diagnostic results",
        severity: "critical",
        likelihood: "possible",
        risk_score: 9,
        mitigations: [
          "Sign all model outputs with cryptographic signatures",
          "Implement output integrity validation before storage",
          "Use audit logs to track all output modifications",
          "Encrypt model outputs end-to-end"
        ],
        affected_components: ["model_inference", "output_storage"]
      });
    }

    // Repudiation threats
    threats.push({
      category: "repudiation",
      title: "Audit Log Tampering",
      description: "Users or attackers could deny actions by tampering with or deleting audit logs, making incident investigation impossible",
      severity: "high",
      likelihood: "unlikely",
      risk_score: 6,
      mitigations: [
        "Implement append-only audit log storage",
        "Use cryptographic hashing for log integrity verification",
        "Store audit logs in separate, immutable storage (e.g., WORM storage)",
        "Implement real-time log replication to external systems"
      ],
      affected_components: ["audit_logging"]
    });

    // Information Disclosure threats
    if (context.phi_handling) {
      threats.push({
        category: "information_disclosure",
        title: "PHI Exposure via Model Outputs",
        description: "AI models could inadvertently include PHI (patient names, MRNs, SSNs) in generated outputs, violating HIPAA",
        severity: "critical",
        likelihood: "likely",
        risk_score: 10,
        mitigations: [
          "Implement automated PHI detection on all model outputs",
          "Use differential privacy techniques in model training",
          "Redact/mask detected PHI before output delivery",
          "Regular audits of model outputs for PHI leakage"
        ],
        affected_components: ["model_inference", "output_delivery"]
      });
    }

    // Denial of Service threats
    threats.push({
      category: "denial_of_service",
      title: "Model Inference Overload",
      description: "Attackers could flood the system with inference requests, causing service degradation and impacting clinical workflows",
      severity: context.category === "clinical_decision_support" ? "critical" : "high",
      likelihood: "possible",
      risk_score: context.category === "clinical_decision_support" ? 9 : 7,
      mitigations: [
        "Implement rate limiting on API endpoints",
        "Use request queuing with priority levels for critical requests",
        "Deploy auto-scaling infrastructure",
        "Implement circuit breakers for downstream dependencies"
      ],
      affected_components: ["api_gateway", "model_inference"]
    });

    // Elevation of Privilege threats
    if (context.user_roles.length > 1) {
      threats.push({
        category: "elevation_of_privilege",
        title: "Role-Based Access Control Bypass",
        description: "Users could exploit vulnerabilities to escalate privileges and access restricted AI system configurations or patient data",
        severity: "high",
        likelihood: "unlikely",
        risk_score: 7,
        mitigations: [
          "Implement zero-trust multi-tenant architecture",
          "Enforce strict RBAC on all API endpoints",
          "Regular penetration testing of access control mechanisms",
          "Implement just-in-time (JIT) privilege escalation with approval workflows"
        ],
        affected_components: ["authentication", "authorization"]
      });
    }

    return threats;
  }

  private identifyLINDDUNThreats(context: AISystemContext): LINDDUNThreat[] {
    const threats: LINDDUNThreat[] = [];

    // Linkability threats
    if (context.phi_handling) {
      threats.push({
        category: "linkability",
        title: "Cross-System Patient Re-identification",
        description: "Model outputs or telemetry could be linked across systems to re-identify de-identified patients, violating HIPAA Safe Harbor",
        severity: "critical",
        likelihood: "possible",
        risk_score: 9,
        mitigations: [
          "Implement k-anonymity checks before data sharing",
          "Use synthetic data for non-production testing",
          "Remove quasi-identifiers from telemetry data",
          "Conduct privacy impact assessments (PIAs) for all data flows"
        ],
        phi_risk: true
      });
    }

    // Identifiability threats
    if (context.phi_handling) {
      threats.push({
        category: "identifiability",
        title: "Model Inversion Attacks",
        description: "Attackers could use model outputs to reconstruct training data, potentially revealing patient identities or sensitive health information",
        severity: "high",
        likelihood: "unlikely",
        risk_score: 7,
        mitigations: [
          "Use differential privacy during model training",
          "Implement output perturbation to prevent inversion",
          "Regular adversarial testing for membership inference attacks",
          "Limit model query frequency per user"
        ],
        phi_risk: true
      });
    }

    // Disclosure threats
    threats.push({
      category: "disclosure",
      title: "Unauthorized Data Access via Logs",
      description: "Sensitive patient information could be logged inadvertently in application logs, exposing PHI to unauthorized personnel",
      severity: context.phi_handling ? "critical" : "medium",
      likelihood: "likely",
      risk_score: context.phi_handling ? 9 : 5,
      mitigations: [
        "Implement automatic PHI scrubbing in all log outputs",
        "Use structured logging with field-level redaction",
        "Restrict log access to authorized security personnel only",
        "Regular log audits for PHI exposure"
      ],
      phi_risk: context.phi_handling
    });

    // Unawareness threats
    if (context.user_roles.includes("patient")) {
      threats.push({
        category: "unawareness",
        title: "Lack of AI Decision Transparency",
        description: "Patients may be unaware that AI is being used in their care, violating informed consent principles and ethical guidelines",
        severity: "medium",
        likelihood: "likely",
        risk_score: 6,
        mitigations: [
          "Provide clear AI usage notices to patients",
          "Implement explainability features (SHAP, LIME) for clinician review",
          "Maintain audit trails of AI-assisted decisions",
          "Offer opt-out mechanisms where clinically appropriate"
        ],
        phi_risk: false
      });
    }

    // Non-compliance threats
    if (context.phi_handling) {
      threats.push({
        category: "non_compliance",
        title: "HIPAA Privacy Rule Violation",
        description: "AI system could process/store PHI without proper safeguards, Business Associate Agreements, or patient authorization",
        severity: "critical",
        likelihood: "possible",
        risk_score: 10,
        mitigations: [
          "Ensure BAAs are in place for all third-party AI vendors",
          "Implement minimum necessary principle for data access",
          "Conduct regular HIPAA compliance audits",
          "Maintain comprehensive data flow diagrams showing all PHI touchpoints"
        ],
        phi_risk: true
      });
    }

    return threats;
  }

  private calculateRiskScore(stride: STRIDEThreat[], linddun: LINDDUNThreat[]): number {
    const allThreats = [...stride, ...linddun];
    if (allThreats.length === 0) return 0;

    const totalRisk = allThreats.reduce((sum, threat) => sum + threat.risk_score, 0);
    return Math.round((totalRisk / allThreats.length) * 10) / 10;
  }

  private generateRecommendations(
    stride: STRIDEThreat[],
    linddun: LINDDUNThreat[],
    context: AISystemContext
  ): string[] {
    const recommendations: string[] = [];

    const criticalThreats = [...stride, ...linddun].filter(t => t.severity === "critical");
    
    if (criticalThreats.length > 0) {
      recommendations.push(
        `URGENT: Address ${criticalThreats.length} critical threats before production deployment`
      );
    }

    if (context.phi_handling) {
      recommendations.push(
        "Implement comprehensive PHI protection: automated detection, encryption at rest/in transit, and access logging"
      );
    }

    if (stride.some(t => t.category === "information_disclosure")) {
      recommendations.push(
        "Deploy automated PHI scanning service for all model outputs before delivery"
      );
    }

    if (linddun.some(t => t.category === "non_compliance")) {
      recommendations.push(
        "Conduct HIPAA compliance gap analysis and remediate findings before accepting production workloads"
      );
    }

    if (stride.some(t => t.category === "denial_of_service")) {
      recommendations.push(
        "Implement infrastructure resilience: rate limiting, auto-scaling, and circuit breakers"
      );
    }

    return recommendations;
  }
}

export const threatModelingService = new ThreatModelingService();
