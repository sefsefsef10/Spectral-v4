# Spectral Healthcare AI Governance Platform

## Overview
Spectral is a B2B SaaS platform designed for AI governance, monitoring, and compliance within the healthcare sector. Its primary goal is to reduce risks, identify operational inefficiencies, and simplify AI procurement for healthcare organizations and AI vendors. The platform offers executive reporting, alert management, compliance dashboards, and automated certification workflows to ensure responsible and compliant AI adoption. The long-term vision is to establish Spectral as the leading solution in healthcare AI governance, achieving significant market penetration and valuation through its robust network effects infrastructure.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend is built with React 18+, TypeScript, Vite, Wouter, Shadcn/ui (Radix UI), and Tailwind CSS, aiming for an executive-grade professional aesthetic and clear data presentation.

### Technical Implementations
The backend is an Express.js application in TypeScript, providing a RESTful API. It uses session-based authentication and a zero-trust multi-tenant architecture with Role-Based Access Control (RBAC). PostgreSQL, managed with Drizzle ORM and validated by Zod, serves as the primary data store, utilizing Neon for serverless connections. Security features include hashed tokens, JSONB audit logs, and AES-256-GCM encryption for sensitive data. The project is structured as a monorepo.

Key features include:
- **Tiered Translation Engine Customization:** A three-tier monetization system offering threshold tuning, control toggles, and custom compliance controls, incorporating regulatory guardrails (e.g., HIPAA) and audit trails.
- **AI Certification Workflow (Beacon):** A three-tiered certification system (Verified/Certified/Trusted) automating testing for PHI exposure, clinical accuracy, bias detection, and deployment history validation. Includes automated quarterly re-verification.
- **Telemetry Polling Infrastructure:** Production-ready polling from AI observability platforms via API, converting metrics to `aiTelemetryEvents` with PHI encryption, database persistence, deduplication, and Inngest integration.
- **EHR Integration Infrastructure:** Production-ready FHIR adapters for Epic, Cerner, and Athenahealth, with credential encryption, automated AI system discovery, and scheduled/on-demand syncing via Inngest.
- **Legal Foundation:** Comprehensive, HIPAA-compliant templates for legal documentation.
- **Network Effects Infrastructure:** Dashboards for health systems and vendors to demonstrate market reach and procurement opportunities, including ROI tracking.
- **Advanced Security:** Features webhook signature verification, payload validation, secret management, rate limiting, and AES-256-GCM encryption with automated PHI redaction.
- **Compliance Expansion:** Support for ISO 42001 and a control versioning system.
- **Durable Workflows (Inngest):** Ensures zero data loss for critical processes through retries and cron scheduling.
- **Billing Infrastructure:** Schema for Stripe integration, plan tiers, and usage metering.
- **Enterprise SSO (WorkOS):** SAML/OAuth with auto-provisioning.
- **Automated Rollback System (Sentinel):** Policy management, deployment history tracking, automated/manual rollback execution, and an approval workflow with audit trails and role-based authorization.
- **Embeddable Badge Widget:** JavaScript widget for vendors to display Beacon certification status on their websites, including a JSON API and embeddable script for auto-updating.
- **Rosetta Stone Tool:** Metric translation tool mapping vendor observability platforms (LangSmith, Arize, LangFuse, W&B) to Spectral compliance frameworks (HIPAA, NIST AI RMF, FDA). Provides gap analysis, compliance scoring, and actionable setup recommendations.
- **Multi-Platform Telemetry Polling:** Production-ready polling from LangSmith, Arize, LangFuse, and Weights & Biases with unified TelemetryPoller, platform-specific adapters, and 15-minute cron jobs via Inngest.
- **Executive Reporting (Constellation)**: Board-ready summaries of AI portfolios, risks, and compliance with narrative generation.
- **Alert Management (Sentinel)**: Monitoring dashboard with severity filtering and predictive alerts.
- **Compliance Dashboard (Watchtower)**: Visualizes framework coverage (HIPAA, NIST AI RMF, FDA SaMD) and audit readiness.
- **Healthcare-Specific Scoring**: Weighted scoring for PHI risk, clinical safety, framework compliance, and operational health.
- **Automated Action Execution**: Manages multi-channel notifications, automated system rollbacks, and access restrictions.
- **Translation Engine (CORE IP)**: Maps AI telemetry to compliance violations and suggests remediation.
- **State Law Engine**: Geographic-aware compliance checking.
- **Audit Evidence Packager**: Automates evidence collection for audits.
- **AI Monitoring Integration**: Utilizes webhook receivers for real-time telemetry.
- **User Management & Audit Logging**: Enterprise-grade user management with RBAC.
- **Reporting & Analytics**: Automated report scheduling and advanced analytics.
- **Vendor Performance & Benchmarking**: Reliability scoring and industry benchmarks.
- **Acquisition Data Room**: Generates automated M&A due diligence packages.

## External Dependencies

### Core Infrastructure
- **SendGrid**: Email notifications.
- **Upstash Redis**: Performance caching.
- **AWS S3**: Compliance report storage.
- **Twilio**: SMS notifications.
- **Slack**: Real-time compliance alerts.

### AI Monitoring & Observability
- **LangSmith**: LLM application telemetry.
- **LangFuse**: Open-source AI observability events.
- **Arize AI**: Model monitoring events.
- **Weights & Biases**: ML experiment tracking.

### Healthcare EHR Systems
- **Epic**: FHIR webhook receiver.
- **Cerner**: FHIR webhook receiver.
- **Athenahealth**: FHIR webhook receiver.

### Incident & Infrastructure Management
- **PagerDuty**: Incident management integration.
- **DataDog**: Infrastructure monitoring integration.