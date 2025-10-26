import { db } from "./db";
import { complianceTemplates } from "@shared/schema";

export async function seedComplianceTemplates() {
  console.log("Seeding compliance templates...");

  const templates = [
    // HIPAA Templates
    {
      name: "HIPAA Security Rule Risk Assessment Template",
      framework: "HIPAA",
      category: "Risk Assessment",
      description: "Comprehensive template for conducting HIPAA Security Rule risk assessments for healthcare AI systems, including administrative, physical, and technical safeguards evaluation.",
      content: `# HIPAA Security Rule Risk Assessment

## Overview
This template guides you through a comprehensive risk assessment for AI systems handling Protected Health Information (PHI).

## 1. Administrative Safeguards

### 1.1 Security Management Process
- [ ] Identify AI system assets that create, receive, maintain, or transmit ePHI
- [ ] Document potential threats and vulnerabilities
- [ ] Assess current security measures
- [ ] Determine likelihood and impact of potential risks
- [ ] Document risk determination and mitigation strategies

### 1.2 Assigned Security Responsibility
- [ ] Designate security official responsible for AI system
- [ ] Document security responsibilities and authorities
- [ ] Establish reporting structure

### 1.3 Workforce Security
- [ ] Implement procedures for workforce authorization
- [ ] Establish workforce clearance procedures
- [ ] Define termination procedures for AI system access

### 1.4 Information Access Management
- [ ] Implement access authorization policies
- [ ] Establish access establishment and modification procedures
- [ ] Document minimum necessary access requirements

## 2. Physical Safeguards

### 2.1 Facility Access Controls
- [ ] Document facility security plan
- [ ] Implement access control and validation procedures
- [ ] Establish contingency operations for AI system availability

### 2.2 Workstation and Device Security
- [ ] Define workstation use policies for AI system access
- [ ] Implement workstation security controls
- [ ] Document device and media controls

## 3. Technical Safeguards

### 3.1 Access Control
- [ ] Implement unique user identification
- [ ] Establish emergency access procedures
- [ ] Configure automatic logoff
- [ ] Enable encryption and decryption where applicable

### 3.2 Audit Controls
- [ ] Implement hardware, software, and procedural mechanisms
- [ ] Record and examine AI system activity
- [ ] Monitor access to ePHI

### 3.3 Integrity Controls
- [ ] Implement mechanisms to verify ePHI integrity
- [ ] Document procedures to detect unauthorized alteration
- [ ] Establish validation processes for AI model outputs

### 3.4 Transmission Security
- [ ] Implement integrity controls for data transmission
- [ ] Configure encryption for ePHI transmission
- [ ] Document network security architecture

## 4. AI-Specific Considerations

### 4.1 Model Training Data
- [ ] Assess PHI used in model training
- [ ] Document de-identification procedures
- [ ] Verify minimum necessary principle compliance

### 4.2 Model Outputs
- [ ] Evaluate potential re-identification risks
- [ ] Implement output validation procedures
- [ ] Document use limitations

### 4.3 Third-Party AI Vendors
- [ ] Execute Business Associate Agreements
- [ ] Verify vendor security capabilities
- [ ] Establish monitoring procedures

## 5. Documentation
- Risk assessment completion date: _______________
- Next scheduled review date: _______________
- Security Official signature: _______________

## 6. Remediation Plan
Document identified risks and mitigation strategies:

| Risk ID | Description | Likelihood | Impact | Mitigation Strategy | Timeline | Responsible Party |
|---------|-------------|------------|--------|---------------------|----------|-------------------|
|         |             |            |        |                     |          |                   |
`,
      fileType: "markdown",
      tags: ["HIPAA", "Risk Assessment", "Security Rule", "PHI Protection", "AI Systems"],
      downloadable: true,
    },
    {
      name: "HIPAA Privacy Rule AI Compliance Checklist",
      framework: "HIPAA",
      category: "Checklist",
      description: "Checklist for ensuring AI system compliance with HIPAA Privacy Rule requirements for use and disclosure of PHI.",
      content: `# HIPAA Privacy Rule AI Compliance Checklist

## Patient Rights

- [ ] Notice of Privacy Practices updated to include AI system use
- [ ] Patient consent obtained for AI-assisted decision making (where required)
- [ ] Access procedures established for AI-generated PHI
- [ ] Amendment procedures defined for AI outputs
- [ ] Accounting of disclosures includes AI system access

## Permitted Uses and Disclosures

- [ ] Treatment uses documented and justified
- [ ] Payment operations clearly defined
- [ ] Healthcare operations appropriately scoped
- [ ] Minimum necessary standard applied to AI data access
- [ ] De-identification procedures validated

## AI-Specific Privacy Safeguards

- [ ] AI model training data sources documented
- [ ] Patient data usage limitations defined
- [ ] Re-identification risk assessment completed
- [ ] Data retention policies established
- [ ] Vendor agreements include privacy protections

## Breach Notification Preparedness

- [ ] AI system breach notification procedures defined
- [ ] Incident response plan includes AI-specific scenarios
- [ ] Risk assessment methodology for AI breaches established
- [ ] Notification templates prepared

## Training and Awareness

- [ ] Staff trained on AI system privacy implications
- [ ] Privacy policies updated to reflect AI capabilities
- [ ] Ongoing monitoring procedures established
`,
      fileType: "markdown",
      tags: ["HIPAA", "Privacy Rule", "Checklist", "Patient Rights", "De-identification"],
      downloadable: true,
    },

    // NIST AI RMF Templates
    {
      name: "NIST AI RMF Governance & MAP Function Template",
      framework: "NIST_AI_RMF",
      category: "Risk Assessment",
      description: "Template for implementing NIST AI Risk Management Framework Govern and MAP functions, including AI system inventory, stakeholder engagement, and risk categorization.",
      content: `# NIST AI RMF: Governance & MAP Function

## GOVERN Function

### Organization Structure
- [ ] Establish AI governance committee
- [ ] Define roles and responsibilities
- [ ] Create accountability framework
- [ ] Establish escalation procedures

### Policies and Procedures
- [ ] Develop AI risk management policy
- [ ] Create technical standards
- [ ] Establish documentation requirements
- [ ] Define approval workflows

### Resources
- [ ] Allocate budget for AI safety
- [ ] Assign dedicated personnel
- [ ] Provide training resources
- [ ] Establish vendor relationships

### Risk Culture
- [ ] Promote transparency in AI development
- [ ] Encourage risk reporting
- [ ] Integrate ethics considerations
- [ ] Foster continuous improvement

## MAP Function

### 1. Context Establishment (MAP 1.1-1.6)

#### 1.1 AI System Purpose and Context
- AI System Name: _______________
- Intended Purpose: _______________
- Deployment Context: _______________
- User Population: _______________
- Expected Benefits: _______________

#### 1.2 Stakeholder Identification
| Stakeholder Group | Role | Engagement Method | Impact Level |
|-------------------|------|-------------------|--------------|
| Patients          |      |                   |              |
| Clinicians        |      |                   |              |
| Administrators    |      |                   |              |
| Regulators        |      |                   |              |

#### 1.3 AI System Categorization
- Automation Level: _______________
- Criticality: _______________
- Impact Domain: _______________
- Risk Tier: _______________

#### 1.4 Interdependencies
- [ ] Data sources documented
- [ ] Model dependencies mapped
- [ ] System interfaces identified
- [ ] External services cataloged

#### 1.5 Legal and Regulatory Context
- [ ] HIPAA requirements identified
- [ ] FDA regulations assessed
- [ ] State laws reviewed
- [ ] Contractual obligations documented

#### 1.6 Organizational Risk Tolerance
- Risk Appetite Statement: _______________
- Acceptable Risk Level: _______________
- Escalation Thresholds: _______________

### 2. Impact Assessment (MAP 2.1-2.3)

#### 2.1 Positive Impacts
| Impact Area | Description | Magnitude | Certainty |
|-------------|-------------|-----------|-----------|
|             |             |           |           |

#### 2.2 Negative Impacts
| Impact Area | Description | Magnitude | Likelihood | Affected Groups |
|-------------|-------------|-----------|------------|-----------------|
|             |             |           |            |                 |

#### 2.3 Impact Prioritization
Priority risks requiring mitigation:
1. _______________
2. _______________
3. _______________

### 3. Risk Measurement (MAP 3.1-3.5)

#### 3.1 Performance Metrics
- Accuracy: _______________
- Precision: _______________
- Recall: _______________
- F1 Score: _______________
- Demographic Parity: _______________

#### 3.2 Trustworthiness Characteristics
- [ ] Valid and Reliable
- [ ] Safe
- [ ] Secure and Resilient
- [ ] Accountable and Transparent
- [ ] Explainable and Interpretable
- [ ] Privacy-Enhanced
- [ ] Fair with Harmful Bias Managed

#### 3.3 Testing and Validation
- Test Dataset Size: _______________
- Validation Methodology: _______________
- Performance Benchmarks: _______________
- Edge Case Coverage: _______________%

## Documentation Requirements
- Assessment Date: _______________
- Assessor(s): _______________
- Review Date: _______________
- Approval Authority: _______________
`,
      fileType: "markdown",
      tags: ["NIST AI RMF", "Governance", "MAP Function", "Risk Assessment", "Trustworthiness"],
      downloadable: true,
    },
    {
      name: "NIST AI RMF MEASURE Function Monitoring Template",
      framework: "NIST_AI_RMF",
      category: "Audit",
      description: "Template for ongoing AI system monitoring and measurement aligned with NIST AI RMF MEASURE function requirements.",
      content: `# NIST AI RMF: MEASURE Function

## Continuous Monitoring Framework

### 1. Performance Metrics (MEASURE 1.1-1.3)

#### 1.1 Model Performance Tracking
| Metric | Baseline | Current | Threshold | Status | Last Updated |
|--------|----------|---------|-----------|--------|--------------|
| Accuracy |        |         |           |        |              |
| Precision |       |         |           |        |              |
| Recall |          |         |           |        |              |
| AUC-ROC |         |         |           |        |              |

#### 1.2 Operational Metrics
| Metric | Target | Current | Trend | Alert Threshold |
|--------|--------|---------|-------|-----------------|
| Latency (ms) |  |       |       |                 |
| Throughput |    |       |       |                 |
| Availability |  |       |       |                 |
| Error Rate |    |       |       |                 |

#### 1.3 Bias and Fairness Metrics
- [ ] Demographic parity measured
- [ ] Equal opportunity assessed
- [ ] Calibration by group verified
- [ ] Disparate impact calculated

### 2. Risk Monitoring (MEASURE 2.1-2.13)

#### 2.1 Data Quality Monitoring
- [ ] Input data distribution drift detection
- [ ] Missing value monitoring
- [ ] Outlier detection
- [ ] Data freshness validation

#### 2.2 Model Drift Detection
- [ ] Prediction drift monitoring
- [ ] Concept drift detection
- [ ] Feature importance changes
- [ ] Statistical distribution shifts

#### 2.3 Safety Monitoring
- [ ] Adverse event tracking
- [ ] Near-miss incident logging
- [ ] Safety threshold monitoring
- [ ] Alert escalation procedures

#### 2.4 Security Monitoring
- [ ] Access log review
- [ ] Anomaly detection
- [ ] Adversarial attack monitoring
- [ ] Data exfiltration detection

#### 2.5 Privacy Monitoring
- [ ] PHI access auditing
- [ ] De-identification validation
- [ ] Re-identification risk assessment
- [ ] Privacy budget tracking

### 3. Stakeholder Feedback (MEASURE 3.1-3.3)

#### 3.1 User Feedback Collection
- Feedback Mechanism: _______________
- Collection Frequency: _______________
- Analysis Process: _______________

#### 3.2 Clinician Input
- Clinical validation reviews: _______________
- Override rate tracking: _______________
- Workflow integration assessment: _______________

#### 3.3 Patient Impact
- Patient outcome tracking: _______________
- Satisfaction surveys: _______________
- Complaint analysis: _______________

### 4. Documentation and Reporting

#### 4.1 Regular Reporting
- Daily: Automated performance dashboard
- Weekly: Risk indicator summary
- Monthly: Comprehensive performance review
- Quarterly: Stakeholder report
- Annually: Full risk reassessment

#### 4.2 Incident Documentation
| Date | Type | Description | Impact | Resolution | Follow-up Actions |
|------|------|-------------|--------|------------|-------------------|
|      |      |             |        |            |                   |

### 5. Continuous Improvement

#### 5.1 Threshold Reviews
- [ ] Performance thresholds reassessed
- [ ] Alert rules optimized
- [ ] Monitoring scope updated
- [ ] Measurement methodology refined

#### 5.2 Tool Enhancement
- [ ] Monitoring tools evaluated
- [ ] Automation opportunities identified
- [ ] Integration improvements planned
- [ ] Visualization enhancements implemented

## Monitoring Schedule
- Next review date: _______________
- Responsible team: _______________
- Escalation contact: _______________
`,
      fileType: "markdown",
      tags: ["NIST AI RMF", "MEASURE Function", "Monitoring", "Performance Metrics", "Continuous Improvement"],
      downloadable: true,
    },

    // FDA SaMD Templates
    {
      name: "FDA SaMD AI/ML Clinical Validation Protocol",
      framework: "FDA_SaMD",
      category: "Model Validation",
      description: "Clinical validation protocol template for AI/ML-based Software as a Medical Device following FDA guidance, including performance evaluation and real-world testing.",
      content: `# FDA SaMD AI/ML Clinical Validation Protocol

## 1. Device Description

### 1.1 Intended Use
- Device Name: _______________
- Intended Use Statement: _______________
- Indications for Use: _______________
- Patient Population: _______________
- Clinical Setting: _______________

### 1.2 Risk Categorization
- SaMD Category (I, II, III, IV): _______________
- State of Healthcare Situation: (Critical, Serious, Non-serious)
- Significance of Information: (Treat/Diagnose, Drive Clinical Management, Inform)

### 1.3 Algorithm Description
- Algorithm Type: _______________
- Input Data: _______________
- Output: _______________
- Key Features: _______________
- Deployment Platform: _______________

## 2. Clinical Validation Objectives

### 2.1 Primary Objective
Primary clinical question: _______________

### 2.2 Secondary Objectives
1. _______________
2. _______________
3. _______________

### 2.3 Success Criteria
- Primary Endpoint: _______________
- Performance Threshold: _______________
- Statistical Power: _______________

## 3. Study Design

### 3.1 Study Type
- [ ] Prospective
- [ ] Retrospective
- [ ] Multi-site
- [ ] Real-world evidence

### 3.2 Sample Size Calculation
- Required Sample Size: _______________
- Power Analysis: _______________
- Stratification Requirements: _______________

### 3.3 Data Sources
| Data Source | Site | Time Period | Expected Cases | Status |
|-------------|------|-------------|----------------|--------|
|             |      |             |                |        |

## 4. Clinical Performance Evaluation

### 4.1 Reference Standard
- Gold Standard: _______________
- Expert Reader Panel: _______________
- Adjudication Process: _______________

### 4.2 Performance Metrics
| Metric | Target | Lower Confidence Bound | Analysis Plan |
|--------|--------|------------------------|---------------|
| Sensitivity |   |                        |               |
| Specificity |   |                        |               |
| PPV |          |                        |               |
| NPV |          |                        |               |
| AUC |          |                        |               |

### 4.3 Subgroup Analysis
- [ ] Age stratification
- [ ] Gender analysis
- [ ] Race/ethnicity evaluation
- [ ] Disease severity assessment
- [ ] Comorbidity analysis

## 5. Real-World Performance

### 5.1 Clinical Workflow Integration
- Workflow Description: _______________
- User Training Requirements: _______________
- Time to Result: _______________

### 5.2 User Acceptance Testing
- Clinician Feedback Mechanism: _______________
- Usability Testing Protocol: _______________
- User Error Analysis: _______________

### 5.3 Clinical Utility
- Clinical Decision Impact: _______________
- Patient Outcome Assessment: _______________
- Healthcare Resource Utilization: _______________

## 6. Safety Evaluation

### 6.1 Failure Modes
| Failure Mode | Potential Harm | Likelihood | Severity | Mitigation |
|--------------|----------------|------------|----------|------------|
|              |                |            |          |            |

### 6.2 Adverse Event Monitoring
- AE Reporting Procedure: _______________
- Serious AE Criteria: _______________
- Review Frequency: _______________

## 7. Statistical Analysis Plan

### 7.1 Primary Analysis
- Statistical Method: _______________
- Significance Level: _______________
- Multiplicity Adjustment: _______________

### 7.2 Interim Analysis
- Interim Look Timing: _______________
- Stopping Rules: _______________

### 7.3 Bias Mitigation
- Selection bias controls: _______________
- Confounding adjustment: _______________
- Missing data handling: _______________

## 8. Continuous Learning

### 8.1 Algorithm Updates
- Update Trigger Criteria: _______________
- Retraining Dataset Requirements: _______________
- Re-validation Requirements: _______________

### 8.2 Performance Monitoring
- Real-time monitoring plan: _______________
- Performance degradation detection: _______________
- Corrective action procedures: _______________

### 8.3 Regulatory Communication
- Pre-specified changes (SPS): _______________
- FDA notification requirements: _______________
- Documentation maintenance: _______________

## 9. Documentation

### 9.1 Required Documentation
- [ ] Clinical Validation Report
- [ ] Statistical Analysis Report
- [ ] Safety Analysis Report
- [ ] Clinical Evaluation Report

### 9.2 Quality Management
- Protocol Version: _______________
- Date: _______________
- Principal Investigator: _______________
- Sponsor Representative: _______________

## 10. Regulatory Submission

### 10.1 Submission Type
- [ ] 510(k) Submission
- [ ] De Novo Classification
- [ ] PMA Application

### 10.2 Documentation Checklist
- [ ] Device description
- [ ] Software documentation (Level of Concern)
- [ ] Clinical validation data
- [ ] Risk analysis
- [ ] Labeling
`,
      fileType: "markdown",
      tags: ["FDA", "SaMD", "Clinical Validation", "AI/ML", "Medical Device", "Performance Testing"],
      downloadable: true,
    },

    // ISO 27001 Template
    {
      name: "ISO 27001 Information Security Management System (ISMS) for AI",
      framework: "ISO_27001",
      category: "Policy",
      description: "ISO 27001 ISMS policy template adapted for healthcare AI systems, covering information security controls and risk treatment.",
      content: `# ISO 27001 ISMS for Healthcare AI Systems

## 1. Information Security Policy

### 1.1 Policy Statement
Our organization commits to:
- Protecting the confidentiality, integrity, and availability of information assets in AI systems
- Complying with legal, regulatory, and contractual requirements (HIPAA, FDA, state laws)
- Implementing a risk-based approach to information security
- Continually improving the ISMS

### 1.2 Scope
This ISMS applies to:
- All AI systems processing healthcare data
- Supporting infrastructure and networks
- Third-party AI vendors and service providers
- Personnel with access to AI systems

## 2. Organization of Information Security

### 2.1 Internal Organization
- CISO/Security Officer: _______________
- AI Governance Committee: _______________
- Security Team: _______________

### 2.2 Mobile Devices and Teleworking
- [ ] Mobile device policy for AI system access
- [ ] Remote access security controls
- [ ] BYOD guidelines and restrictions

### 2.3 Segregation of Duties
- [ ] Development/production separation
- [ ] Administrative privilege separation
- [ ] Dual approval for critical changes

## 3. Human Resource Security

### 3.1 Prior to Employment
- [ ] Background checks for AI system access
- [ ] Security responsibilities in job descriptions
- [ ] Non-disclosure agreements

### 3.2 During Employment
- [ ] Security awareness training (annual)
- [ ] AI-specific security training
- [ ] Disciplinary process for violations

### 3.3 Termination
- [ ] Access revocation procedures
- [ ] Asset return requirements
- [ ] Post-employment restrictions

## 4. Asset Management

### 4.1 AI System Inventory
| Asset ID | Description | Owner | Classification | Location | Review Date |
|----------|-------------|-------|----------------|----------|-------------|
|          |             |       |                |          |             |

### 4.2 Information Classification
- **Restricted**: PHI, proprietary algorithms
- **Confidential**: Business data, system configs
- **Internal**: Operational documentation
- **Public**: Marketing materials

### 4.3 Media Handling
- [ ] Secure disposal procedures for AI training data
- [ ] Media transfer controls
- [ ] Physical media management

## 5. Access Control

### 5.1 User Access Management
- [ ] User registration and de-registration
- [ ] Access provisioning based on least privilege
- [ ] Privileged access management
- [ ] Regular access reviews (quarterly)

### 5.2 User Responsibilities
- [ ] Password policy (complexity, rotation)
- [ ] Multi-factor authentication requirements
- [ ] Unattended workstation protection

### 5.3 System and Application Access Control
- [ ] Secure log-on procedures
- [ ] Password management system
- [ ] Source code access controls
- [ ] API authentication and authorization

## 6. Cryptography

### 6.1 Cryptographic Controls
- [ ] Encryption at rest (PHI, model weights)
- [ ] Encryption in transit (TLS 1.3+)
- [ ] Cryptographic key management
- [ ] Digital signatures for model provenance

## 7. Physical and Environmental Security

### 7.1 Secure Areas
- [ ] Physical security perimeter
- [ ] Access controls to AI infrastructure
- [ ] Visitor management

### 7.2 Equipment Security
- [ ] Equipment siting and protection
- [ ] Supporting utilities (power, cooling)
- [ ] Equipment maintenance
- [ ] Secure disposal or reuse

## 8. Operations Security

### 8.1 Operational Procedures
- [ ] Documented operating procedures for AI systems
- [ ] Change management for models and infrastructure
- [ ] Capacity management
- [ ] Development/test/production separation

### 8.2 Protection from Malware
- [ ] Anti-malware controls
- [ ] User awareness of malware threats
- [ ] Software integrity verification

### 8.3 Backup
- [ ] AI model version backups
- [ ] Training data backups
- [ ] System configuration backups
- [ ] Backup testing (quarterly)

### 8.4 Logging and Monitoring
- [ ] Event logging (access, changes, failures)
- [ ] Log protection from tampering
- [ ] Administrator and operator logs
- [ ] Clock synchronization

### 8.5 Vulnerability Management
- [ ] Vulnerability scanning (monthly)
- [ ] Patch management for AI stack
- [ ] Technical vulnerability assessment
- [ ] Dependency management

## 9. Communications Security

### 9.1 Network Security Management
- [ ] Network controls (firewalls, IDS/IPS)
- [ ] Network segregation (AI systems isolated)
- [ ] Secure network services
- [ ] Network connection control

### 9.2 Information Transfer
- [ ] Information transfer policies
- [ ] Electronic messaging security
- [ ] Confidentiality or non-disclosure agreements

## 10. System Acquisition, Development and Maintenance

### 10.1 Security Requirements of AI Systems
- [ ] Security requirements analysis
- [ ] Secure system architecture
- [ ] Secure development lifecycle

### 10.2 Security in Development and Support Processes
- [ ] Secure development policy
- [ ] System change control
- [ ] Technical review after platform changes
- [ ] Restrictions on software installation

### 10.3 Test Data
- [ ] Test data selection and protection
- [ ] De-identification of test PHI
- [ ] Access controls for test environments

## 11. Supplier Relationships

### 11.1 Information Security in Supplier Relationships
- [ ] Supplier security policy
- [ ] Business Associate Agreements
- [ ] Data Processing Agreements
- [ ] Supply chain security requirements

### 11.2 Supplier Service Delivery Management
- [ ] Monitoring supplier security performance
- [ ] Managing changes to supplier services
- [ ] Supplier audit rights

## 12. Information Security Incident Management

### 12.1 Management of Information Security Incidents
- [ ] Incident response procedures
- [ ] Reporting security events
- [ ] Assessment and decision on security events
- [ ] Response to security incidents
- [ ] Learning from incidents

### 12.2 AI-Specific Incidents
- [ ] Model poisoning detection
- [ ] Adversarial attack response
- [ ] Data breach procedures
- [ ] Model degradation incidents

## 13. Business Continuity

### 13.1 Information Security Continuity
- [ ] Planning information security continuity
- [ ] Business continuity procedures
- [ ] Verify, review and evaluate continuity
- [ ] ICT readiness for business continuity

### 13.2 AI System Availability
- [ ] Redundancy for critical AI services
- [ ] Failover procedures
- [ ] Recovery time objectives (RTO)
- [ ] Recovery point objectives (RPO)

## 14. Compliance

### 14.1 Compliance with Legal and Contractual Requirements
- [ ] HIPAA compliance verification
- [ ] FDA requirements (if applicable)
- [ ] State privacy laws
- [ ] Contractual security obligations

### 14.2 Information Security Reviews
- [ ] Independent review of information security
- [ ] Compliance with security policies
- [ ] Technical compliance review
- [ ] Internal ISMS audits (annual)

## 15. Statement of Applicability (SOA)

| Control | Included | Justification | Implementation Status |
|---------|----------|---------------|----------------------|
| A.5.1   | Yes/No   |               |                      |
| ...     |          |               |                      |

## Approval

- ISMS Owner: _______________
- Date: _______________
- Review Date: _______________
`,
      fileType: "markdown",
      tags: ["ISO 27001", "ISMS", "Information Security", "Compliance", "Healthcare"],
      downloadable: true,
    },

    // General Templates
    {
      name: "AI Model Card Documentation Template",
      framework: "General",
      category: "Policy",
      description: "Comprehensive model card template for documenting AI system details, performance, limitations, and ethical considerations following industry best practices.",
      content: `# AI Model Card

## Model Details

### Basic Information
- Model Name: _______________
- Version: _______________
- Date: _______________
- Model Type: _______________
- Owner: _______________

### Intended Use
**Primary Intended Uses:**
_______________

**Primary Intended Users:**
_______________

**Out-of-Scope Uses:**
_______________

## Factors

### Relevant Factors
**Demographic Groups:**
- Age ranges evaluated: _______________
- Gender categories: _______________
- Race/ethnicity groups: _______________

**Clinical Factors:**
- Disease severity levels: _______________
- Comorbidity profiles: _______________
- Prior treatment history: _______________

**Environmental Factors:**
- Care settings: _______________
- Equipment variations: _______________
- Geographic locations: _______________

### Evaluation Factors
Factors that may influence performance:
_______________

## Metrics

### Model Performance Metrics
| Metric | Overall | Subgroup 1 | Subgroup 2 | Subgroup 3 |
|--------|---------|------------|------------|------------|
| Accuracy |       |            |            |            |
| Sensitivity | |            |            |            |
| Specificity | |            |            |            |
| AUC-ROC |     |            |            |            |

### Fairness Metrics
| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Demographic Parity | | | |
| Equal Opportunity | | | |
| Disparate Impact | | | |

## Training Data

### Datasets
- Dataset Name: _______________
- Size: _______________
- Time Period: _______________
- Geographic Origin: _______________

### Data Preprocessing
- Inclusion/Exclusion Criteria: _______________
- De-identification Method: _______________
- Missing Data Handling: _______________
- Outlier Treatment: _______________

### Data Splits
- Training: ___%
- Validation: ___%
- Test: ___%
- Split Method: _______________

## Evaluation Data

### Dataset Details
- Source: _______________
- Size: _______________
- Time Period: _______________
- Differences from Training Data: _______________

### Preprocessing
Evaluation data underwent [same/different] preprocessing as training data:
_______________

## Quantitative Analyses

### Overall Performance
_______________

### Performance by Subgroup
_______________

### Fairness Analysis
_______________

### Robustness Testing
_______________

## Ethical Considerations

### Risks and Harms
**Potential Risks:**
1. _______________
2. _______________

**Mitigation Strategies:**
1. _______________
2. _______________

### Use Cases to Avoid
_______________

### Recommendation for Responsible Use
_______________

## Caveats and Recommendations

### Known Limitations
1. _______________
2. _______________

### Recommendations
1. _______________
2. _______________

### Monitoring Recommendations
_______________

## Technical Specifications

### Model Architecture
- Architecture Type: _______________
- Framework: _______________
- Input Format: _______________
- Output Format: _______________

### Computational Requirements
- Hardware Requirements: _______________
- Software Dependencies: _______________
- Inference Time: _______________
- Resource Usage: _______________

## References

### Academic References
1. _______________

### Technical Documentation
1. _______________

## Citation
Suggested citation for this model:
_______________

## Contact Information
- Model Owner: _______________
- Contact Email: _______________
- Support: _______________

## Changelog

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0     |      |         |        |
`,
      fileType: "markdown",
      tags: ["Model Card", "Documentation", "AI Ethics", "Transparency", "Model Governance"],
      downloadable: true,
    },
  ];

  // Insert all templates
  for (const template of templates) {
    await db.insert(complianceTemplates).values(template);
  }

  console.log(`✅ Seeded ${templates.length} compliance templates`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedComplianceTemplates()
    .then(() => {
      console.log("Template seeding complete!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Template seeding failed:", error);
      process.exit(1);
    });
}
