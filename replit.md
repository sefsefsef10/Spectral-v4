# Spectral Healthcare AI Governance Platform

## Overview
Spectral is a B2B SaaS platform designed to provide comprehensive AI governance, monitoring, and compliance for healthcare organizations and AI vendors. Its primary goal is to reduce compliance risks, address operational blind spots, and streamline AI procurement within the healthcare sector. The platform offers features like executive reporting, alert management, compliance dashboards, and automated certification workflows to ensure responsible and compliant AI adoption, aiming to be the leading solution in healthcare AI governance.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend, built with React 18+, TypeScript, Vite, Wouter, Shadcn/ui (Radix UI), and Tailwind CSS, focuses on an executive-grade professional aesthetic and clear data presentation.

### Technical Implementations
The backend is an Express.js application in TypeScript, providing a RESTful API. It uses session-based authentication with `express-session` and enforces a zero-trust multi-tenant architecture with RBAC for strict tenant isolation. PostgreSQL with Drizzle ORM and Zod for validation is the primary data store, using Neon for serverless connections. Security includes hashed tokens, JSONB audit logs, and AES-256-GCM encryption for sensitive data. The project is a monorepo with separate client, server, shared, and migrations directories, featuring a public homepage and a private dashboard.

### Feature Specifications
-   **Executive Reporting (Constellation)**: Board-ready summaries of AI portfolios, risks, and compliance, including narrative generation and trend analysis.
-   **Alert Management (Sentinel)**: Monitoring dashboard with severity filtering, resolution workflows, and predictive alerts.
-   **Compliance Dashboard (Watchtower)**: Visualizes framework coverage (HIPAA, NIST AI RMF, FDA SaMD) with control violations and audit readiness indicators.
-   **Vendor Certification Workflow (Beacon)**: End-to-end system for certifying AI vendors with a 3-tier system (Verified/Certified/Trusted), including automated testing for PHI exposure, clinical accuracy, bias detection, and security.
-   **Healthcare-Specific Scoring**: Weighted scoring for PHI risk (35%), clinical safety (25%), framework compliance (25%), and operational health (15%).
-   **Automated Action Execution**: Manages multi-channel notifications, automated system rollbacks, access restrictions, and audit logging.
-   **Translation Engine (CORE IP)**: Maps AI telemetry to compliance violations and suggests remediation.
-   **State Law Engine**: Geographic-aware compliance checking for state-specific regulations.
-   **Audit Evidence Packager**: Automates collection and packaging of evidence for audits.
-   **AI Monitoring Integration**: Utilizes webhook receivers for real-time telemetry from various AI monitoring tools.
-   **User Management & Audit Logging**: Enterprise-grade user management with RBAC, secure invitations, and activity tracking.
-   **Reporting & Analytics**: Automated report scheduling, regulatory alerts, and advanced analytics.
-   **Vendor Performance & Benchmarking**: Reliability scoring, industry benchmarks, and performance trends.
-   **Acquisition Data Room**: Generates automated M&A due diligence packages.
-   **Advanced Security**: Webhook signature verification, payload validation, secret management, rate limiting, and fail-closed webhook security. PHI is encrypted using AES-256-GCM with automated redaction.
-   **Compliance Expansion**: Expanded compliance controls including ISO 42001 and a control versioning system with policy encryption.
-   **Advanced Certification**: ML-based PHI detection, clinical validation, Fairlearn bias testing, STRIDE/LINDDUN threat modeling, and automated re-certification.
-   **Billing Infrastructure**: Schema for Stripe integration, plan tier management, and usage metering.
-   **Enterprise SSO (WorkOS)**: SAML/OAuth with auto-provisioning and audit logging.
-   **Durable Workflows (Inngest)**: Zero data loss guarantees for certification, predictive alerts, and automated actions with retries and cron scheduling.

## External Dependencies

### Core Infrastructure
-   **SendGrid**: Email notifications.
-   **Upstash Redis**: Performance caching.
-   **AWS S3**: Compliance report storage.
-   **Twilio**: SMS notifications.
-   **Slack**: Real-time compliance alerts.

### AI Monitoring & Observability
-   **LangSmith**: LLM application telemetry.
-   **LangFuse**: Open-source AI observability events.
-   **Arize AI**: Model monitoring events.
-   **Weights & Biases**: ML experiment tracking.

### Healthcare EHR Systems
-   **Epic**: FHIR webhook receiver.
-   **Cerner**: FHIR webhook receiver.
-   **Athenahealth**: FHIR webhook receiver.

### Incident & Infrastructure Management
-   **PagerDuty**: Incident management integration.
-   **DataDog**: Infrastructure monitoring integration.