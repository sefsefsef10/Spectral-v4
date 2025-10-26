# Spectral Healthcare AI Governance Platform

## Overview
Spectral is a B2B SaaS platform designed for healthcare organizations and AI vendors to govern, monitor, and ensure compliance of AI systems. It aims to mitigate compliance risks, address operational blind spots, and streamline AI procurement in healthcare, with the ambition of becoming the leading AI governance platform in the sector.

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