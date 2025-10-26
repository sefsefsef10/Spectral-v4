# Spectral Healthcare AI Governance Platform

## Overview
Spectral is a B2B SaaS platform designed for healthcare organizations and AI vendors to govern, monitor, and ensure compliance of AI systems. It aims to mitigate compliance risks, address operational blind spots, and streamline AI procurement in healthcare, with the ambition of becoming the leading AI governance platform in the sector.

## Recent Changes (2025-10-26): Roadmap Progress

**18-Month Roadmap Execution Progress:**
- ✅ **Phase 1 (Translation Engine Moat)**: COMPLETE - 50 compliance controls, Event Normalizer, State Law Engine
- ✅ **Phase 2 (Network Effects)**: COMPLETE - Vendor Acceptance, Spectral Standard Tracker, Network Metrics
- ✅ **Phase 3 (Executive Reporting)**: COMPLETE - Executive Summary Generator, Audit Evidence Packager, Report Scheduler, Regulatory Alert Service
- ✅ **Phase 4 (Business Model)**: COMPLETE - Policy Enforcement Engine, AI Discovery Crawler, Usage Metering (interface)
- ⏸️ **Phase 5 (Scale & Acquisition)**: Pending

### Phase 4 Completion (Business Model & Product Polish)
**New Tables**: `policy_rules`, `policy_enforcement_logs`, `ai_discovery_jobs`

**Backend Services (Production)** ✅:
- **Policy Enforcement Engine** (`policy-enforcement-engine.ts`): Real-time governance policy evaluation with approval workflows, violation tracking, enforcement actions (block deployment, require approval, restrict access, escalate to admin), policy statistics dashboard
- **AI Discovery Crawler** (`ai-discovery-crawler.ts`): Automated AI system discovery across healthcare infrastructure (EHR scans, vendor surveys, API crawlers), confidence scoring, deduplication, discovery job tracking, mock EHR integrations for Epic/Cerner
- **Usage Metering Service** (`usage-metering-service.ts`): Interface for tracking usage limits (AI systems, alerts, reports, API calls, users, certifications), plan limits (foundation/growth/enterprise), overage calculations, actual usage reconciliation (NOTE: Requires billing tables to be added to schema for persistence)

**Design Notes**:
- Policy engine uses risk level values (low=1, medium=2, high=3, critical=4) for comparisons
- AI discovery filters high-confidence systems (>=0.7 confidence)
- Usage metering provides complete interface but operates in stub mode until billing schema added

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend uses React 18+ and TypeScript with Vite, Wouter for routing, Shadcn/ui (Radix UI) for components, and Tailwind CSS for styling. TanStack Query manages server state. The design prioritizes executive-grade professionalism and clear information delivery.

### Backend
The backend is an Express.js application with TypeScript, providing a RESTful API. It uses session-based authentication with `express-session` and implements a zero-trust multi-tenant architecture with role-based access control, ensuring tenant isolation.

### Data Storage
PostgreSQL is used for data storage, managed by Drizzle ORM for type-safe interactions and Zod for runtime validation. Neon serverless PostgreSQL driver handles connections. Security features include hashed tokens, JSONB audit logs, and AES-256-GCM encryption for sensitive credentials.

### Application Structure
The project is a monorepo containing `/client` (React), `/server` (Express), `/shared` (shared types/schemas), and `/migrations`. It features a marketing homepage and a dashboard with distinct views for health systems and AI vendors.

### Core Features
-   **Executive Reporting (Constellation)**: Provides board-ready summaries of AI portfolios, risk, and compliance with narrative generation, framework compliance tracking, and trend analysis.
-   **Alert Management (Sentinel)**: Monitoring dashboard with severity filtering, alert resolution workflow, and predictive alerts.
-   **Compliance Dashboard (Watchtower)**: Displays framework coverage (HIPAA, NIST AI RMF, FDA SaMD) and portfolio compliance metrics.
-   **Vendor Certification Workflow (Beacon)**: End-to-end certification system including automated testing for PHI exposure, clinical accuracy, bias detection, and security penetration.
-   **Automated Action Execution**: Handles multi-channel notifications (Email, SMS, Slack), automated system rollbacks, access restrictions, escalation, and audit log documentation.
-   **Translation Engine (CORE IP)**: Maps AI telemetry to compliance violations and generates automated remediation actions.
-   **State Law Engine**: Geographic-aware compliance checking for state regulations (e.g., CA SB 1047, CO AI Act, NYC Local Law 144).
-   **Audit Evidence Packager**: Automated evidence collection and packaging for compliance audits.
-   **Network Effects & Marketplace**: Manages vendor acceptance workflows, tracks adoption of Spectral Standard, and calculates network metrics.
-   **AI Monitoring Integration**: Webhook receivers for real-time telemetry capture from various AI monitoring tools.
-   **User Management & Audit Logging**: Enterprise user management with RBAC, secure invitation workflows, and comprehensive activity tracking.
-   **Reporting & Analytics**: Automated report scheduling, regulatory alerts, and advanced analytics for portfolio health and trends.

## External Dependencies

### Core Infrastructure
-   **SendGrid**: For email notifications.
-   **Upstash Redis**: For performance caching.
-   **AWS S3**: For compliance report storage.
-   **Twilio**: For SMS notifications.
-   **Slack**: For real-time compliance alert webhooks.

### AI Monitoring & Observability
-   **LangSmith**: For LLM application telemetry.
-   **LangFuse**: For open-source AI observability events.
-   **Arize AI**: For model monitoring events.
-   **Weights & Biases**: For ML experiment tracking.

### Healthcare EHR Systems
-   **Epic**: FHIR webhook receiver for clinical data access tracking.
-   **Cerner**: FHIR webhook receiver for healthcare data monitoring.
-   **Athenahealth**: FHIR webhook receiver for clinical workflow telemetry.

### Incident & Infrastructure Management
-   **PagerDuty**: For incident management integration.
-   **DataDog**: For infrastructure monitoring integration.