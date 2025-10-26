# Spectral Healthcare AI Governance Platform

## Overview
Spectral is a B2B SaaS platform for healthcare organizations to govern, monitor, and ensure compliance of AI systems. It serves both healthcare systems (for AI oversight and compliance) and AI vendors (for third-party verification). The platform aims to mitigate compliance risks, address operational blind spots, and streamline AI procurement in healthcare. The ambition is to become the leading AI governance platform in healthcare, offering solutions for compliance, risk management, and vendor validation.

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