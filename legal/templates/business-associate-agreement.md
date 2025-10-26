# Business Associate Agreement (BAA)

**Effective Date:** [DATE]

This Business Associate Agreement ("BAA") is entered into by and between:

**COVERED ENTITY:**  
Name: [CUSTOMER_NAME]  
Address: [CUSTOMER_ADDRESS]  
("Covered Entity" or "Customer")

**BUSINESS ASSOCIATE:**  
Spectral Healthcare AI Governance, Inc.  
Address: [SPECTRAL_ADDRESS]  
("Business Associate" or "Spectral")

## Recitals

WHEREAS, Covered Entity is a Covered Entity as defined by the Health Insurance Portability and Accountability Act of 1996 ("HIPAA") and its implementing regulations, including the Privacy Rule (45 CFR Part 160 and Part 164, Subparts A and E) and the Security Rule (45 CFR Part 164, Subparts A and C);

WHEREAS, Business Associate provides AI governance and compliance monitoring services to Covered Entity pursuant to the Master Services Agreement or Terms of Service (the "Underlying Agreement");

WHEREAS, in connection with the Underlying Agreement, Business Associate may create, receive, maintain, or transmit Protected Health Information ("PHI") on behalf of Covered Entity;

WHEREAS, the parties intend for this BAA to satisfy the requirements of 45 CFR § 164.504(e) and 45 CFR § 164.314(a)(2);

NOW, THEREFORE, in consideration of the mutual covenants and agreements herein, the parties agree as follows:

## 1. Definitions

**1.1 General Definitions.** Terms used but not otherwise defined in this BAA shall have the meanings set forth in 45 CFR Parts 160 and 164.

**1.2 Specific Definitions:**

- **"Breach"** has the meaning given such term in 45 CFR § 164.402.
- **"Covered Entity"** means Customer as defined in 45 CFR § 160.103.
- **"Designated Record Set"** has the meaning given such term in 45 CFR § 164.501.
- **"Individual"** has the meaning given such term in 45 CFR § 160.103 and refers to the person who is the subject of PHI.
- **"PHI"** means Protected Health Information as defined in 45 CFR § 160.103, limited to the information created, received, maintained, or transmitted by Business Associate on behalf of Covered Entity.
- **"Privacy Rule"** means the Standards for Privacy of Individually Identifiable Health Information at 45 CFR Part 160 and Part 164, Subparts A and E.
- **"Required by Law"** has the meaning given such term in 45 CFR § 164.103.
- **"Security Incident"** has the meaning given such term in 45 CFR § 164.304.
- **"Security Rule"** means the Security Standards for the Protection of Electronic Protected Health Information at 45 CFR Part 160 and Part 164, Subparts A and C.
- **"Subcontractor"** has the meaning given such term in 45 CFR § 160.103.
- **"Unsecured PHI"** has the meaning given such term in 45 CFR § 164.402.

## 2. Permitted Uses and Disclosures of PHI

**2.1 Services.** Business Associate may use and disclose PHI only as necessary to perform the services specified in the Underlying Agreement, including:

- **AI System Monitoring:** Analyzing AI system outputs for PHI exposure risks
- **Compliance Assessment:** Evaluating AI systems for HIPAA compliance
- **Reporting:** Generating compliance reports and risk assessments
- **Alerting:** Notifying Covered Entity of potential PHI violations
- **Certification:** Assessing AI vendors for HIPAA compliance standards

**2.2 Specific Permitted Uses:**

(a) **De-identification:** Business Associate may use PHI to create de-identified data in accordance with 45 CFR § 164.514(a)-(c).

(b) **Limited Data Sets:** Business Associate may use and disclose Limited Data Sets as permitted by 45 CFR § 164.514(e), provided appropriate data use agreements are in place.

(c) **Aggregate Data:** Business Associate may use PHI to create aggregated data for industry benchmarks and analytics, provided such data does not identify Covered Entity or Individuals.

**2.3 Business Associate's Own Management and Administration.** Business Associate may use PHI for its own proper management and administration or to carry out its legal responsibilities, provided such use:

(a) Is necessary for such purposes; and
(b) Complies with applicable law.

**2.4 Data Aggregation.** Business Associate may use PHI to provide Data Aggregation services to Covered Entity as permitted by 45 CFR § 164.504(e)(2)(i)(B).

**2.5 Minimum Necessary.** Business Associate shall make reasonable efforts to use, disclose, and request only the minimum amount of PHI necessary to accomplish the intended purpose.

## 3. Obligations of Business Associate

**3.1 Compliance with HIPAA.** Business Associate shall:

(a) Not use or disclose PHI except as permitted by this BAA or Required by Law;
(b) Use appropriate administrative, physical, and technical safeguards to prevent use or disclosure of PHI other than as permitted by this BAA;
(c) Comply with the applicable requirements of the Security Rule with respect to electronic PHI;
(d) Report to Covered Entity any use or disclosure of PHI not permitted by this BAA of which it becomes aware;
(e) Report to Covered Entity any Security Incident of which it becomes aware.

**3.2 Specific Safeguards.** Business Associate implements the following safeguards:

**Administrative Safeguards:**
- Security Management Process with risk analysis and management
- Workforce security training and authorization procedures
- Information access management with role-based controls
- Security awareness and training programs
- Contingency planning and disaster recovery
- Periodic security evaluations

**Physical Safeguards:**
- SOC 2 Type II certified data centers
- Facility access controls and visitor management
- Workstation security policies
- Device and media controls

**Technical Safeguards:**
- Access controls with unique user identification and emergency access procedures
- Audit logging and monitoring
- Integrity controls to ensure PHI is not altered or destroyed
- Transmission security using TLS 1.3 encryption
- Encryption of PHI at rest using AES-256-GCM

**3.3 Breach Notification.** Business Associate shall:

(a) Report any Breach of Unsecured PHI to Covered Entity within **24 hours** of discovery;
(b) Provide the following information to the extent known:
   - Date and time of Breach
   - Description of PHI involved
   - Identification of Individuals whose PHI was breached
   - Description of investigation and mitigation
   - Contact information for further inquiries

(c) Cooperate with Covered Entity's investigation and mitigation efforts;
(d) Bear costs of investigation, notification, and mitigation as required by law.

**3.4 Subcontractors.** Business Associate shall:

(a) Enter into written agreements with Subcontractors that create, receive, maintain, or transmit PHI on behalf of Business Associate;
(b) Ensure such agreements impose the same restrictions and conditions on Subcontractors as apply to Business Associate under this BAA;
(c) Remain liable for Subcontractor compliance with HIPAA requirements.

**Current Subcontractors:**
- **Neon (PostgreSQL):** Database hosting and management
- **AWS S3:** Secure storage of compliance reports and audit evidence
- **SendGrid:** Email notifications (PHI-limited, BAA in place)

**3.5 Access to PHI.** Business Associate shall:

(a) Provide access to PHI in a Designated Record Set to Covered Entity or Individual upon request within **10 business days**;
(b) Make PHI available in the form and format requested, if readily producible;
(c) If not readily producible, provide in readable hard copy or agreed alternative format.

**3.6 Amendment of PHI.** Business Associate shall:

(a) Make amendments to PHI in a Designated Record Set as directed by Covered Entity within **15 business days**;
(b) Maintain documentation of amendments for 6 years from date of creation or last effective date.

**3.7 Accounting of Disclosures.** Business Associate shall:

(a) Document all disclosures of PHI and information related to such disclosures as required to provide an accounting under 45 CFR § 164.528;
(b) Provide an accounting of disclosures to Covered Entity or Individual upon request within **30 days** (with one 30-day extension if needed);
(c) The accounting shall include:
   - Date of disclosure
   - Name and address of recipient
   - Brief description of PHI disclosed
   - Brief statement of purpose

**3.8 Books and Records.** Business Associate shall:

(a) Make its internal practices, books, and records relating to PHI available to the Secretary of Health and Human Services for determining Covered Entity's compliance with HIPAA;
(b) Retain all documentation required by HIPAA for **6 years** from date of creation or last effective date.

## 4. Obligations of Covered Entity

**4.1 Permissible Requests.** Covered Entity shall not request Business Associate to use or disclose PHI in any manner that would not be permissible under the Privacy Rule if done by Covered Entity.

**4.2 Notice of Privacy Practices.** Covered Entity shall notify Business Associate of:

(a) Any limitation(s) in its Notice of Privacy Practices that affect Business Associate's use or disclosure of PHI;
(b) Any changes to, or revocation of, permission by an Individual to use or disclose PHI;
(c) Any restriction on use or disclosure of PHI to which Covered Entity has agreed.

**4.3 Safeguards.** Covered Entity warrants that it has implemented appropriate safeguards to protect PHI transmitted to Business Associate.

## 5. Term and Termination

**5.1 Term.** This BAA shall be effective as of the Effective Date and shall continue until terminated as provided herein or until all PHI is destroyed or returned in accordance with Section 5.3.

**5.2 Termination for Cause.**

(a) Either party may terminate this BAA if the other party breaches a material term and fails to cure within **30 days** of written notice;

(b) Covered Entity may immediately terminate this BAA if Business Associate violates a material term and cure is not possible;

(c) Termination of this BAA automatically terminates the Underlying Agreement.

**5.3 Effect of Termination.**

(a) Upon termination, Business Associate shall:

   - **Option 1 (Return):** Return to Covered Entity all PHI in Business Associate's possession and retain no copies; OR
   - **Option 2 (Destruction):** Destroy all PHI and certify in writing that PHI has been destroyed.

(b) If return or destruction is not feasible, Business Associate shall:

   - Extend protections of this BAA to such PHI;
   - Limit further uses and disclosures to purposes that make return or destruction infeasible;
   - Retain PHI only as long as necessary for such purposes;
   - Not use or disclose PHI for any other purpose.

**5.4 Survival.** The obligations of Business Associate under Section 5.3 shall survive termination of this BAA.

## 6. Miscellaneous Provisions

**6.1 Regulatory Changes.** The parties agree to amend this BAA as necessary to comply with changes to HIPAA or other applicable law.

**6.2 Interpretation.** Any ambiguity in this BAA shall be resolved in favor of a meaning that complies with HIPAA.

**6.3 Amendment.** This BAA may be amended only by written agreement signed by both parties.

**6.4 Conflicts.** In the event of conflict between this BAA and the Underlying Agreement, this BAA controls with respect to PHI.

**6.5 Severability.** If any provision is held invalid or unenforceable, the remaining provisions remain in full force and effect.

**6.6 Waiver.** No waiver of any provision is effective unless in writing and signed by the waiving party.

**6.7 Third-Party Beneficiaries.** Nothing in this BAA confers any right or remedy upon any person other than the parties.

**6.8 Notices.** All notices must be in writing and delivered to:

**Covered Entity:**  
[NAME]  
[ADDRESS]  
Email: [EMAIL]

**Business Associate:**  
Spectral Healthcare AI Governance, Inc.  
[ADDRESS]  
Email: legal@spectralhealth.ai

**6.9 Governing Law.** This BAA is governed by the laws of [STATE], excluding conflict of law provisions.

**6.10 Entire Agreement.** This BAA, together with the Underlying Agreement, constitutes the entire agreement regarding PHI.

## 7. Signatures

**COVERED ENTITY:**

By: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
Name: [NAME]  
Title: [TITLE]  
Date: [DATE]

**BUSINESS ASSOCIATE:**

By: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
Name: [NAME]  
Title: Chief Executive Officer  
Date: [DATE]

---

**Document Version:** 1.0  
**Last Reviewed:** [DATE]  
**HIPAA Compliance Officer:** [NAME]  
**Contact:** compliance@spectralhealth.ai
