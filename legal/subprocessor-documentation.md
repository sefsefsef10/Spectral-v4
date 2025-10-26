# Subprocessor Documentation

**Last Updated:** [DATE]  
**Document Owner:** Legal & Compliance Team

## Overview

This document identifies all subprocessors (third-party service providers) that Spectral Healthcare AI Governance, Inc. ("Spectral") uses to process customer data, including Protected Health Information (PHI). This documentation is required for HIPAA compliance and customer transparency.

## HIPAA-Critical Subprocessors

These subprocessors have access to PHI and require Business Associate Agreements (BAAs).

### 1. Neon (PostgreSQL Database)

**Service:** Serverless PostgreSQL database hosting  
**Data Processed:** All customer data, AI system metadata, compliance records, audit logs, PHI metadata  
**Data Location:** United States (AWS infrastructure)  
**Certification:** SOC 2 Type II  
**BAA Status:** ✅ **BAA in place**  
**BAA Effective Date:** [DATE]  
**Purpose:** Primary database for all application data storage

**Security Measures:**
- TLS 1.3 encryption in transit
- AES-256 encryption at rest
- Automated backups with 30-day retention
- Point-in-time recovery
- Connection pooling and query optimization

**Compliance:**
- HIPAA-compliant infrastructure
- SOC 2 Type II certified
- Regular security audits
- 99.95% uptime SLA

**Contact:**  
Website: neon.tech  
Support: support@neon.tech

---

### 2. Amazon Web Services (AWS S3)

**Service:** Object storage for compliance reports and audit evidence  
**Data Processed:** Generated compliance reports, certification artifacts, audit evidence packages  
**Data Location:** United States (us-east-1 region)  
**Certification:** HIPAA eligible, SOC 2 Type II, ISO 27001, FedRAMP  
**BAA Status:** ✅ **BAA in place**  
**BAA Effective Date:** [DATE]  
**Purpose:** Long-term storage of compliance documentation and audit evidence

**Security Measures:**
- Server-side encryption (SSE-S3) with AES-256
- Encryption in transit (TLS 1.3)
- Bucket policies restricting access
- Versioning enabled for audit trail
- Access logging and monitoring

**Compliance:**
- HIPAA-eligible services under AWS BAA
- SOC 1, 2, 3 certified
- ISO 27001, 27017, 27018
- FedRAMP High authorization

**Contact:**  
Website: aws.amazon.com  
HIPAA Compliance: aws.amazon.com/compliance/hipaa-compliance  
Support: AWS Support Center

---

### 3. SendGrid (Email Notifications)

**Service:** Transactional email delivery  
**Data Processed:** Alert notifications, compliance reports, user communications (may contain limited PHI in subject lines or body)  
**Data Location:** United States  
**Certification:** SOC 2 Type II  
**BAA Status:** ✅ **BAA available** (executed upon customer request for PHI-containing emails)  
**BAA Effective Date:** [DATE] (if executed)  
**Purpose:** Deliver compliance alerts and notifications via email

**Security Measures:**
- TLS encryption for email transmission
- Dedicated IP addresses
- Email authentication (SPF, DKIM, DMARC)
- Activity logging and monitoring
- Data retention controls

**PHI Mitigation:**
- Spectral minimizes PHI in email content
- Generic alert subjects (e.g., "Compliance Alert - Action Required")
- Links to secure dashboard instead of detailed PHI in email body
- Customer can opt out of email notifications

**Compliance:**
- SOC 2 Type II certified
- HIPAA-compliant email delivery (with BAA)
- ISO 27001 certified

**Contact:**  
Website: sendgrid.com  
Security: sendgrid.com/security  
Support: support@sendgrid.com

---

## Non-HIPAA Subprocessors

These subprocessors do NOT have access to PHI but process other customer data.

### 4. Stripe (Payment Processing)

**Service:** Payment processing and billing management  
**Data Processed:** Payment card information, billing addresses, transaction history  
**Data Location:** United States  
**Certification:** PCI DSS Level 1, SOC 2 Type II  
**BAA Status:** ❌ **Not applicable** (merchant services, no PHI access)  
**Purpose:** Process subscription payments and manage billing

**Security Measures:**
- PCI DSS Level 1 compliant (highest security standard for payment processors)
- Tokenization of payment card data
- TLS 1.3 encryption
- Fraud detection and prevention
- 3D Secure authentication

**Data Isolation:**
- Stripe processes payment data only
- No access to health or medical information
- No access to AI system compliance data
- Billing tied to organization ID only (no PHI linkage)

**Contact:**  
Website: stripe.com  
Security: stripe.com/docs/security  
Support: support@stripe.com

---

### 5. Upstash (Redis Caching) - Optional

**Service:** In-memory caching for performance optimization  
**Data Processed:** Cached API responses, session data, temporary computation results  
**Data Location:** United States  
**Certification:** SOC 2 Type II (in progress)  
**BAA Status:** ⚠️ **Required if PHI cached** (not currently executed)  
**Purpose:** Improve application performance through caching

**Current Status:**
- **NOT CURRENTLY USED FOR PHI**
- Cache layer optional (disabled for customers requiring strict PHI isolation)
- If enabled, only non-PHI metadata cached

**Security Measures:**
- TLS 1.3 encryption in transit
- Encryption at rest
- Short TTL (time-to-live) for cached data
- Automatic eviction policies

**Compliance Roadmap:**
- Execute BAA before caching any PHI-related data
- Implement PHI detection to prevent caching sensitive data
- Customer opt-in required for cache layer

**Contact:**  
Website: upstash.com  
Support: support@upstash.com

---

### 6. Twilio (SMS Notifications) - Optional

**Service:** SMS-based alert delivery  
**Data Processed:** Phone numbers, alert messages (no PHI in SMS content)  
**Data Location:** United States  
**Certification:** SOC 2 Type II, ISO 27001, HIPAA-eligible  
**BAA Status:** ⚠️ **Available** (not yet executed; feature in development)  
**Purpose:** Deliver critical compliance alerts via SMS

**Current Status:**
- Feature under development
- NOT CURRENTLY ACTIVE
- Will require customer opt-in

**PHI Safeguards When Deployed:**
- Generic alert messages only (e.g., "Critical alert - check dashboard")
- No PHI in SMS content
- Links to secure dashboard requiring authentication
- BAA will be executed before feature launch

**Contact:**  
Website: twilio.com  
HIPAA Compliance: twilio.com/legal/hipaa  
Support: support@twilio.com

---

### 7. Slack (Alert Integration) - Optional

**Service:** Webhook-based alert delivery to Slack workspaces  
**Data Processed:** Alert notifications formatted for Slack (no PHI in messages)  
**Data Location:** United States  
**Certification:** SOC 2 Type II, SOC 3, ISO 27001  
**BAA Status:** ⚠️ **Available** (customer-executed for Enterprise Grid only)  
**Purpose:** Deliver compliance alerts to customer's Slack channels

**Current Status:**
- Optional customer integration
- Customer configures webhook URL
- Customer responsible for Slack workspace BAA if needed

**PHI Safeguards:**
- Generic alert messages (e.g., "AI System X has compliance violation")
- No detailed PHI in Slack messages
- Links to Spectral dashboard for details
- Customer controls Slack workspace security

**Compliance:**
- Slack offers BAAs for Enterprise Grid customers
- Customer must execute BAA with Slack if workspace contains PHI
- Spectral does not control customer's Slack environment

**Contact:**  
Website: slack.com  
Enterprise: slack.com/enterprise  
Support: slack.com/help

---

## Subprocessor Change Notification

**Policy:** Spectral will notify customers of subprocessor changes **30 days in advance** via:

1. Email to account administrators
2. In-app notification banner
3. Updated subprocessor list posted at spectralhealth.ai/legal/subprocessors

**Customer Rights:** Customers may object to new subprocessors within 30 days. If unable to accommodate objection, either party may terminate the agreement.

## BAA Compliance Summary

| Subprocessor | PHI Access | BAA Required | BAA Status | Priority |
|--------------|-----------|--------------|------------|----------|
| Neon | Yes | Yes | ✅ In Place | Critical |
| AWS S3 | Yes | Yes | ✅ In Place | Critical |
| SendGrid | Limited | Yes | ✅ Available | High |
| Stripe | No | No | ❌ N/A | N/A |
| Upstash | No (planned yes) | Yes | ⚠️ Required before PHI | Medium |
| Twilio | No (planned limited) | Yes | ⚠️ Before launch | Low |
| Slack | No | Customer BAA | Customer responsibility | Low |

## Action Items for Production Readiness

### Immediate (Before First Customer)
- [x] Execute BAA with Neon
- [x] Execute BAA with AWS
- [ ] Execute BAA with SendGrid (if using email notifications)
- [ ] Confirm all BAAs are signed and filed

### Short Term (Next 90 Days)
- [ ] Execute BAA with Upstash if cache layer enabled
- [ ] Execute BAA with Twilio before SMS feature launch
- [ ] Document customer opt-in process for Slack integration

### Ongoing
- [ ] Review subprocessor list quarterly
- [ ] Audit subprocessor compliance certifications annually
- [ ] Maintain copies of all BAAs for 6+ years
- [ ] Update customers within 30 days of subprocessor changes

## Data Flow Diagrams

### PHI Data Flow
```
Customer → Spectral Platform → Neon (Database)
                             → AWS S3 (Reports)
                             → SendGrid (Alerts)
```

### Non-PHI Data Flow
```
Customer → Spectral Platform → Stripe (Payments)
                             → Upstash (Cache - optional)
                             → Slack (Alerts - optional)
                             → Twilio (SMS - optional)
```

## Audit Trail

| Date | Change | Subprocessor | Reason |
|------|--------|-------------|--------|
| [DATE] | Added | Neon | Primary database provider |
| [DATE] | Added | AWS S3 | Compliance report storage |
| [DATE] | Added | Stripe | Payment processing |
| [DATE] | Added | SendGrid | Email notifications |
| [DATE] | Planned | Upstash | Performance optimization |
| [DATE] | Planned | Twilio | SMS alerts |

## Contact Information

**For subprocessor questions:**  
Email: legal@spectralhealth.ai  
Phone: [PHONE]

**For security or compliance inquiries:**  
Email: compliance@spectralhealth.ai  
CISO: [NAME]

**For BAA requests:**  
Email: baa@spectralhealth.ai

---

**Document Version:** 1.0  
**Next Review Date:** [DATE + 3 months]  
**Owner:** Chief Legal Officer  
**Approved By:** [NAME], CEO
