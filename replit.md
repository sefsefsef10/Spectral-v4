# Spectral Healthcare AI Governance Platform

## Overview
Spectral is a B2B SaaS platform designed to empower healthcare organizations and AI vendors with comprehensive AI governance, monitoring, and compliance capabilities. Its core purpose is to mitigate compliance risks, address operational blind spots, and streamline AI procurement within the healthcare sector. The platform aims to become the leading AI governance solution in healthcare, offering features such as executive reporting, alert management, compliance dashboards, and automated certification workflows, ultimately ensuring responsible and compliant AI adoption.

## Recent Changes
**October 26, 2025**:
- ✅ **Phase 5.3 Complete**: OpenAPI 3.0 Spec + Swagger UI Documentation (54/107 endpoints, 50.5% coverage)
  - Production-ready Swagger UI accessible at `/api-docs`
  - Comprehensive documentation across 12 major API categories
  - Fixed critical MFA disable endpoint documentation bug (password vs token mismatch)
  - Validated by architect for acquisition-readiness

**Platform Status**: B+ (88% overall), Vendor Testing Suite A+ (97%)

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend is built with React 18+ and TypeScript, utilizing Vite for tooling, Wouter for routing, Shadcn/ui (Radix UI) for components, and Tailwind CSS for styling. TanStack Query manages server state. The design emphasizes executive-grade professionalism and clear information delivery.

### Backend
The backend is an Express.js application written in TypeScript, exposing a RESTful API. It employs session-based authentication with `express-session` and enforces a zero-trust multi-tenant architecture with role-based access control (RBAC) to ensure strict tenant isolation.

### Data Storage
PostgreSQL serves as the primary data store, managed by Drizzle ORM for type-safe interactions and Zod for runtime validation. Neon serverless PostgreSQL driver is used for database connections. Security features include hashed tokens, JSONB audit logs, and AES-256-GCM encryption for sensitive credentials.

### Application Structure
The project is organized as a monorepo, comprising distinct directories for the `/client` (React frontend), `/server` (Express backend), `/shared` (shared types and schemas), and `/migrations`. It features a public marketing homepage and a private dashboard with tailored views for health systems and AI vendors.

### Core Features
-   **Executive Reporting (Constellation)**: Generates board-ready summaries of AI portfolios, risks, and compliance, including narrative generation, framework tracking, and trend analysis.
-   **Alert Management (Sentinel)**: Provides a monitoring dashboard with severity filtering, alert resolution workflows, and predictive alerts.
-   **Compliance Dashboard (Watchtower)**: Visualizes framework coverage (e.g., HIPAA, NIST AI RMF, FDA SaMD) and portfolio-wide compliance metrics.
-   **Vendor Certification Workflow (Beacon)**: An end-to-end system for certifying AI vendors, including automated testing for PHI exposure, clinical accuracy, bias detection, and security.
-   **Automated Action Execution**: Manages multi-channel notifications (Email, SMS, Slack), automated system rollbacks, access restrictions, and audit log documentation.
-   **Translation Engine (CORE IP)**: Maps AI telemetry to compliance violations and suggests automated remediation actions.
-   **State Law Engine**: Offers geographic-aware compliance checking for state-specific regulations.
-   **Audit Evidence Packager**: Automates the collection and packaging of evidence for compliance audits.
-   **Network Effects & Marketplace**: Facilitates vendor acceptance, tracks adoption of the Spectral Standard, and calculates network metrics.
-   **AI Monitoring Integration**: Utilizes webhook receivers for real-time telemetry capture from various AI monitoring tools.
-   **User Management & Audit Logging**: Provides enterprise-grade user management with RBAC, secure invitation workflows, and comprehensive activity tracking.
-   **Reporting & Analytics**: Enables automated report scheduling, regulatory alerts, and advanced analytics for portfolio health.
-   **Vendor Performance & Benchmarking**: Offers vendor reliability scoring, industry benchmarks, performance trends, and a top performers leaderboard.
-   **Acquisition Data Room**: Generates an automated M&A due diligence package, including company metrics, financial projections, and valuation estimates.
-   **Advanced Security**: Implements webhook signature verification, payload validation, secret management, and rate limiting for all webhook endpoints.
-   **Compliance Expansion**: Includes an expanded set of compliance controls with ISO 42001 coverage and a control versioning system.
-   **Advanced Certification**: Integrates ML-based PHI detection, clinical validation dataset library, Fairlearn bias testing, STRIDE/LINDDUN threat modeling, and automated quarterly re-certification.
-   **Billing Infrastructure**: Provides a billing schema for Stripe integration, plan tier management, and usage metering.

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
-   **Epic**: FHIR webhook receiver.
-   **Cerner**: FHIR webhook receiver.
-   **Athenahealth**: FHIR webhook receiver.

### Incident & Infrastructure Management
-   **PagerDuty**: For incident management integration.
-   **DataDog**: For infrastructure monitoring integration.