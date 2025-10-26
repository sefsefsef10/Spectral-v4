import { db } from "./db";
import { complianceControls } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * 🔒 TRANSLATION ENGINE - Compliance Control Seed Data
 * 
 * This is CORE IP - The defensible moat
 * Maps AI system capabilities to regulatory requirements
 */

const COMPLIANCE_CONTROLS = [
  // ============================================
  // HIPAA Controls (Healthcare AI Focus)
  // ============================================
  {
    id: "hipaa-audit-001",
    framework: "HIPAA",
    controlId: "164.312(b)",
    controlName: "Audit Controls",
    description: "Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain or use ePHI",
    requirements: [
      "Log all AI system access to PHI data",
      "Monitor AI model inference requests containing patient data",
      "Track data lineage through AI pipelines",
      "Maintain audit trails for model predictions affecting patient care"
    ],
    testingCriteria: JSON.stringify({
      metrics: ["log_completeness", "audit_trail_integrity", "access_monitoring"],
      thresholds: { log_retention_days: 90, log_coverage_percent: 100 }
    }),
    evidenceRequirements: [
      "AI system access logs showing all PHI interactions",
      "Model inference audit trail with timestamps and user IDs",
      "Data pipeline logs tracking PHI flow through AI systems",
      "Quarterly audit log review reports"
    ]
  },
  {
    id: "hipaa-encryption-001",
    framework: "HIPAA",
    controlId: "164.312(a)(2)(iv)",
    controlName: "Encryption and Decryption",
    description: "Implement a mechanism to encrypt and decrypt ePHI",
    requirements: [
      "Encrypt PHI at rest in AI training datasets",
      "Encrypt PHI in transit to/from AI model APIs",
      "Use encryption for model inference requests containing patient data",
      "Implement secure key management for AI system encryption"
    ],
    testingCriteria: JSON.stringify({
      metrics: ["encryption_coverage", "key_rotation", "tls_version"],
      thresholds: { min_tls_version: "1.3", encryption_algorithm: "AES-256" }
    }),
    evidenceRequirements: [
      "Data encryption certificates for AI data stores",
      "TLS/SSL configuration for AI API endpoints",
      "Key management policy and rotation logs",
      "Encryption penetration test reports"
    ]
  },
  {
    id: "hipaa-access-001",
    framework: "HIPAA",
    controlId: "164.312(a)(1)",
    controlName: "Access Control",
    description: "Implement technical policies and procedures for electronic information systems that maintain ePHI to allow access only to authorized persons",
    requirements: [
      "Role-based access control (RBAC) for AI system users",
      "Multi-factor authentication for AI platform access",
      "Automatic session timeout for AI dashboards",
      "Minimum necessary access principle for AI data access"
    ],
    testingCriteria: JSON.stringify({
      metrics: ["rbac_coverage", "mfa_adoption", "session_timeout"],
      thresholds: { mfa_required: true, max_session_minutes: 30 }
    }),
    evidenceRequirements: [
      "User access control policies",
      "MFA configuration documentation",
      "Access review audit logs (quarterly)",
      "Role definition and permission matrices"
    ]
  },

  // ============================================
  // NIST AI Risk Management Framework (AI RMF)
  // ============================================
  {
    id: "nist-govern-001",
    framework: "NIST_AI_RMF",
    controlId: "GOVERN-1.2",
    controlName: "Legal and Regulatory Requirements",
    description: "Legal and regulatory requirements involving AI are understood, managed, and documented",
    requirements: [
      "Maintain inventory of applicable AI regulations (HIPAA, FDA, state laws)",
      "Document AI system compliance requirements per regulation",
      "Track regulatory changes affecting deployed AI systems",
      "Assign compliance ownership for each AI system"
    ],
    testingCriteria: JSON.stringify({
      metrics: ["regulation_coverage", "documentation_completeness", "update_frequency"],
      thresholds: { regulatory_review_days: 90, documentation_coverage: 100 }
    }),
    evidenceRequirements: [
      "AI system regulatory requirement matrix",
      "Compliance ownership assignments",
      "Quarterly regulatory update reviews",
      "Legal counsel review documentation"
    ]
  },
  {
    id: "nist-map-001",
    framework: "NIST_AI_RMF",
    controlId: "MAP-2.3",
    controlName: "AI System Capabilities and Context",
    description: "AI capabilities, targeted usage, goals, and expected benefits and costs are understood and documented",
    requirements: [
      "Document AI system intended use and clinical context",
      "Define AI system performance metrics and success criteria",
      "Identify potential harms and limitations",
      "Establish monitoring thresholds for model drift"
    ],
    testingCriteria: JSON.stringify({
      metrics: ["documentation_quality", "harm_identification", "monitoring_coverage"],
      thresholds: { documented_use_cases: "all", drift_monitoring: true }
    }),
    evidenceRequirements: [
      "AI system specification documents",
      "Clinical use case documentation",
      "Risk assessment reports",
      "Model performance monitoring dashboards"
    ]
  },
  {
    id: "nist-measure-001",
    framework: "NIST_AI_RMF",
    controlId: "MEASURE-2.1",
    controlName: "AI System Performance and Impact Metrics",
    description: "Test sets, metrics, and details about the tools used during AI system testing are documented",
    requirements: [
      "Define and document AI system accuracy metrics",
      "Establish bias and fairness testing procedures",
      "Track model performance over time",
      "Monitor for demographic disparities in AI predictions"
    ],
    testingCriteria: JSON.stringify({
      metrics: ["accuracy", "bias_testing", "fairness_metrics", "performance_tracking"],
      thresholds: { min_accuracy: 0.90, bias_testing_frequency_days: 30 }
    }),
    evidenceRequirements: [
      "Model performance test results",
      "Bias and fairness audit reports",
      "Performance monitoring logs",
      "Demographic disparity analysis"
    ]
  },
  {
    id: "nist-manage-001",
    framework: "NIST_AI_RMF",
    controlId: "MANAGE-1.1",
    controlName: "AI Risk Management",
    description: "A risk management strategy is documented and implemented to address risks related to AI system development, deployment, and use",
    requirements: [
      "Conduct AI risk assessments before deployment",
      "Implement incident response plans for AI failures",
      "Establish escalation procedures for high-risk AI events",
      "Regular risk review and mitigation updates"
    ],
    testingCriteria: JSON.stringify({
      metrics: ["risk_assessment_coverage", "incident_response_time", "review_frequency"],
      thresholds: { pre_deployment_assessment: true, max_incident_response_hours: 24 }
    }),
    evidenceRequirements: [
      "AI risk assessment reports",
      "Incident response plan documentation",
      "Escalation procedure records",
      "Risk review meeting minutes"
    ]
  },

  // ============================================
  // FDA Software as a Medical Device (SaMD)
  // ============================================
  {
    id: "fda-validation-001",
    framework: "FDA_SaMD",
    controlId: "FDA-GPSV-1",
    controlName: "Clinical Validation",
    description: "Software validation for AI/ML medical devices demonstrating clinical accuracy and safety",
    requirements: [
      "Conduct clinical validation studies for AI diagnostic algorithms",
      "Demonstrate AI system accuracy with diverse patient populations",
      "Validate AI predictions against clinical gold standards",
      "Document validation methodology and results"
    ],
    testingCriteria: JSON.stringify({
      metrics: ["clinical_accuracy", "population_diversity", "validation_quality"],
      thresholds: { min_clinical_accuracy: 0.85, min_test_population_size: 500 }
    }),
    evidenceRequirements: [
      "Clinical validation study reports",
      "Statistical analysis of AI performance",
      "Diverse patient population documentation",
      "Comparison to clinical gold standards"
    ]
  },
  {
    id: "fda-monitoring-001",
    framework: "FDA_SaMD",
    controlId: "FDA-PCCP-2",
    controlName: "Post-Market Surveillance",
    description: "Real-world performance monitoring and adverse event reporting for deployed AI medical devices",
    requirements: [
      "Implement real-world performance monitoring for deployed AI",
      "Track and report adverse events related to AI predictions",
      "Monitor AI system for performance degradation",
      "Conduct periodic safety reviews"
    ],
    testingCriteria: JSON.stringify({
      metrics: ["performance_monitoring", "adverse_event_tracking", "safety_reviews"],
      thresholds: { monitoring_frequency_days: 7, safety_review_frequency_days: 90 }
    }),
    evidenceRequirements: [
      "Real-world performance monitoring reports",
      "Adverse event logs and investigation records",
      "Performance degradation alerts",
      "Quarterly safety review summaries"
    ]
  },
  {
    id: "fda-updates-001",
    framework: "FDA_SaMD",
    controlId: "FDA-SaMD-3",
    controlName: "Software Updates and Changes",
    description: "Process for validating and documenting AI model updates and algorithm changes",
    requirements: [
      "Validate AI model updates before deployment",
      "Document all algorithm changes and their rationale",
      "Test updated models for performance regression",
      "Maintain version control for AI model artifacts"
    ],
    testingCriteria: JSON.stringify({
      metrics: ["update_validation", "version_control", "regression_testing"],
      thresholds: { pre_deployment_validation: true, version_control_coverage: 100 }
    }),
    evidenceRequirements: [
      "Model update validation reports",
      "Change documentation and rationale",
      "Regression test results",
      "Version control audit trail"
    ]
  }
];

export async function seedComplianceControls() {
  console.log("🔒 Seeding Translation Engine compliance controls...");

  for (const control of COMPLIANCE_CONTROLS) {
    const existing = await db.query.complianceControls.findFirst({
      where: eq(complianceControls.id, control.id)
    });

    if (!existing) {
      await db.insert(complianceControls).values(control);
      console.log(`  ✓ Added ${control.framework} control: ${control.controlId}`);
    } else {
      console.log(`  ⊘ ${control.framework} control ${control.controlId} already exists`);
    }
  }

  console.log("✅ Compliance controls seeded successfully!");
  console.log(`   Total controls: ${COMPLIANCE_CONTROLS.length}`);
  console.log(`   Frameworks: HIPAA (3), NIST AI RMF (4), FDA SaMD (3)`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedComplianceControls()
    .then(() => {
      console.log("Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error:", error);
      process.exit(1);
    });
}
