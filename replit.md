# Spectral Healthcare AI Governance Platform

## Overview
Spectral is a B2B SaaS platform for healthcare organizations to govern, monitor, and ensure compliance of AI systems. It serves both healthcare systems (for AI oversight and compliance) and AI vendors (for third-party verification). The platform aims to mitigate compliance risks, address operational blind spots, and streamline AI procurement in healthcare. The ambition is to become the leading AI governance platform in healthcare, offering solutions for compliance, risk management, and vendor validation.

## Recent Changes (2025-10-26): Phase 1-5 Database Foundation Complete ✅

**Executed complete 18-month roadmap database infrastructure in single deployment:**

### Database Schema Expansion
- **Migration**: `0002_adorable_shockwave.sql` - Added 19 new tables across all 5 phases
- **Total Tables**: 40 (21 original + 19 new for roadmap phases)
- **Schema Status**: Production-ready foundation for $300-500M acquisition timeline

### Translation Engine Moat Expansion (Phase 1) 🔒
**Compliance Controls Catalog**: Expanded from **15 → 50 controls (233% increase)**
- HIPAA: 14 controls (Administrative, Physical, Technical Safeguards)
- NIST AI RMF: 14 controls (Govern, Map, Measure, Manage)
- FDA SaMD: 10 controls (Clinical/Analytical Validation, QMS, Cybersecurity, Post-Market)
- ISO 27001: 8 controls (Information Security, Access Control, Compliance)
- State Regulations: 4 controls (CA SB 1047, CO AI Act, NYC Local Law 144)

**Event Types Taxonomy**: Expanded from **5 → 20 types (300% increase)**
- Privacy: 2 types | Security: 5 types | Performance: 3 types
- Safety: 4 types | Fairness: 3 types | Quality: 3 types

**Event Normalizer (Production)** ✅: Intelligent telemetry processing system
- Category-specific pattern matching for all 20 event types
- Confidence scoring for event classification (0-1 scale)
- Automated severity derivation (critical, high, medium, low)
- Backward compatibility with legacy event types (drift, phi_leakage, bias, latency, error)
- Integrated with Translation Engine for real-time compliance violation detection

**Compliance Mapping Expansion** ✅: 11 new handler methods
- Privacy: `handleUnauthorizedAccess` (HIPAA 164.308(a)(4))
- Security: `handlePromptInjection`, `handleAuthFailure`, `handleRateLimitExceeded`, `handleInputValidationFailure`, `handleVersionMismatch`
- Safety: `handleClinicalAccuracy` (FDA-CV-1), `handleFalseAlerts` (FDA-AV-1), `handleHarmfulOutput` (CA SB 1047)
- Quality: `handleDataQuality` (NIST MANAGE-4.2), `handleExplainabilityFailure` (NYC LL144)

**State Law Engine (Production)** ✅: Geographic-aware compliance checking for state regulations
- **CA SB 1047**: Safety testing + incident reporting (10-30 day deadlines) for high-risk AI in California
- **Colorado AI Act**: Impact assessments + consumer notice (60 day deadline) for high-impact AI in Colorado
- **NYC Local Law 144**: Bias audits + candidate notice (90 day deadline) for employment AI in New York
- Geographic gating with location normalization (case-insensitive, state abbreviation support)
- Integrated with Translation Engine - runs after federal compliance checks
- Auto-seeded on server startup with 6 state regulations

**New Tables**: `control_versions`, `event_types`, `state_regulations`, `adaptive_threshold_models`, `regulatory_updates`

### Network Effects & Marketplace (Phase 2) 🌐
**New Tables**: `vendor_acceptances`, `health_system_vendor_relationships`, `spectral_standard_adoptions`, `network_metrics_daily_snapshots`

### Executive Reporting & Automation (Phase 3) 📊
**New Tables**: `executive_reports`, `audit_evidence_packages`, `report_schedules`, `regulatory_alerts`

### Business Model & Product Polish (Phase 4) 💰
**New Tables**: `policy_rules`, `policy_enforcement_logs`, `ai_discovery_jobs`

### Scale & Acquisition Positioning (Phase 5) 🚀
**New Tables**: `vendor_performance_metrics`, `health_system_rollup_metrics`, `network_effects_proof_metrics`

### Code Review Gaps Fixed ✅
- ✅ Configurable thresholds (per-health-system in `threshold-config.ts`)
- ✅ Notification retry logic with exponential backoff (`retry-with-backoff.ts`)
- ✅ Translation Engine moat expanded (15 → 50 controls)
- ✅ Auto-initialization system (loads catalog on server startup)

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend uses **React 18+ and TypeScript** with **Vite** for tooling and **Wouter** for routing. **Shadcn/ui** (based on Radix UI) provides the UI component system and **Tailwind CSS** for styling. **TanStack Query** manages server state. The design emphasizes executive-grade professionalism and clear information delivery.

### Backend
The backend is an **Express.js** application with **TypeScript**, featuring a **RESTful API**. It uses session-based authentication with `express-session` and a PostgreSQL store, implementing a zero-trust multi-tenant architecture with role-based access control. Tenant IDs are strictly derived from authenticated sessions to prevent cross-tenant data access.

### Data Storage
The platform utilizes **PostgreSQL** managed by **Drizzle ORM** for type-safe interactions and **Zod** for runtime validation. Key entities include users, health systems, AI systems, deployments, compliance data, and audit logs. **Neon serverless PostgreSQL driver** is used for connections. Security features include hashed tokens, JSONB audit logs, and AES-256-GCM encryption for sensitive credentials.

### Application Structure
The project is a monorepo with `/client` (React), `/server` (Express), `/shared` (shared types/schemas), and `/migrations`. It includes a marketing homepage and a dashboard with distinct views for health systems and AI vendors.

### Core Features
-   **Executive Reporting (Constellation)**: Board-ready summaries of AI portfolios, risk, and compliance.
-   **Alert Management (Sentinel)**: Monitoring dashboard with severity filtering, alert resolution workflow, and predictive alerts.
-   **Compliance Dashboard (Watchtower)**: Framework coverage (HIPAA, NIST AI RMF, FDA SaMD) and portfolio compliance metrics.
-   **Vendor Certification Workflow (Beacon)**: End-to-end certification system with **production-ready automated testing suite**:
    -   **PHI Exposure Testing**: Calls vendor API with test prompts, scans responses for PHI patterns (SSN, MRN, phone, email, DOB, address)
    -   **Clinical Accuracy Testing**: Validates AI predictions against ground truth medical scenarios, requires 90% keyword match accuracy
    -   **Bias Detection Testing**: Measures response variance across race/gender/age demographics, flags variance >5%
    -   **Security Penetration Testing**: Tests input validation (SQL injection, XSS), rate limiting, authentication, HTTPS encryption
    -   All tests make real API calls to vendor systems, store results in database, and gate certification approvals
-   **Vendor Trust Page**: Public-facing page for showcasing certifications.
-   **Authentication System**: Zero-trust multi-tenant session-based authentication with user-organization association.
-   **Background Job System**: Custom async job processor for workflows, scheduled checks, and report generation.
-   **Translation Engine (CORE IP)**: Maps AI telemetry to compliance violations and generates automated remediation actions.
-   **Automated Action Execution**: Production-ready action executor that handles:
    -   **Notify**: Multi-channel notifications (Email via SendGrid, SMS via Twilio, Slack webhooks)
    -   **Rollback**: Automated system rollback with status updates and alert creation
    -   **Restrict**: System access restrictions with stakeholder notifications
    -   **Escalate**: Priority escalation to admin users
    -   **Document**: Automated audit log creation for compliance tracking
-   **AI Monitoring Integration**: Webhook receivers for real-time telemetry capture and processing (11 integrations)
-   **Automated Risk Scoring**: Algorithm for calculating and updating AI system risk levels.
-   **Email Notifications**: For critical compliance alerts via SendGrid.
-   **SMS Notifications**: Critical alerts via Twilio SMS.
-   **Slack Notifications**: Real-time compliance alerts via Slack webhooks.
-   **PDF Report Generator**: For professional compliance reports.
-   **Predictive Compliance Alerts**: ML-powered forecasting of compliance violations.
-   **Partner API**: RESTful API for AI vendors to interact with certification workflows.
-   **Advanced Analytics**: Executive-grade insights dashboard with portfolio health scoring, trend analysis, and CSV export.
-   **Compliance Template Library**: Comprehensive library of pre-built compliance templates (HIPAA, NIST AI RMF, FDA SaMD, ISO 27001, AI Model Card).
-   **User Management Dashboard**: Enterprise user management with role-based access control (admin, user, viewer), secure invitation workflow, and audit logging.
-   **Audit Logging System**: Comprehensive viewer for compliance-grade activity tracking.
-   **Organization Settings**: Management page for organization profile (name, description, website, logo).
-   **System Health Monitoring**: Real-time dashboard displaying system metrics and health score.
-   **AI Inventory Dashboard**: Full CRUD operations with search, filtering, and system management.

## External Dependencies

### Core Infrastructure
-   **SendGrid**: Email notifications.
-   **Upstash Redis**: Performance caching.
-   **AWS S3**: Compliance report storage.
-   **Twilio**: SMS notifications.
-   **Slack**: Real-time compliance alert webhooks.

### AI Monitoring & Observability (4/4 Implemented ✅)
-   **LangSmith** ✅: Webhook receiver for LLM application telemetry capture, integrated with Translation Engine for compliance violation detection
-   **LangFuse** ✅: Webhook receiver for open-source AI observability events (trace, span, generation), processes telemetry through Translation Engine
-   **Arize AI** ✅: Webhook receiver for model monitoring events (prediction, performance, data quality), creates alerts for model drift and performance issues
-   **Weights & Biases** ✅: Webhook receiver for ML experiment tracking (run events, model metrics), monitors training metrics and experiment results

### Healthcare EHR Systems (3/3 Implemented ✅)
-   **Epic** ✅: FHIR webhook receiver for clinical data access tracking, stores telemetry events for patient data access auditing
-   **Cerner** ✅: FHIR webhook receiver for healthcare data monitoring, processes FHIR resource subscription notifications
-   **Athenahealth** ✅: FHIR webhook receiver for clinical workflow telemetry, tracks clinical data access for compliance

### Incident & Infrastructure Management (2/2 Implemented ✅)
-   **PagerDuty** ✅: Webhook receiver for incident management, automatically creates critical alerts from PagerDuty incidents
-   **DataDog** ✅: Webhook receiver for infrastructure monitoring, processes monitor alerts and creates compliance alerts

### Communication & Notifications (2/2 Implemented ✅)
-   **Twilio** ✅: 
    -   Outbound: SMS notifications for critical compliance alerts via action executor
    -   Inbound: Webhook receiver for SMS delivery status callbacks
-   **Slack** ✅: 
    -   Outbound: Real-time compliance alert messages with rich formatting
    -   Inbound: Webhook receiver for interactive events and button interactions

## Integration Summary
**Total: 11/11 Integrations Implemented (100%)**
- AI Monitoring: 4/4 ✅
- Healthcare EHR: 3/3 ✅
- Incident Management: 2/2 ✅
- Communication: 2/2 ✅
- Core Infrastructure: SendGrid (email), Upstash Redis (caching), AWS S3 (report storage)