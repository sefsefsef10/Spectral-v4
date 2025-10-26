# Spectral Healthcare AI Governance Platform

## Overview
Spectral is a B2B SaaS platform designed for healthcare organizations and AI vendors to govern, monitor, and ensure compliance of AI systems. It aims to mitigate compliance risks, address operational blind spots, and streamline AI procurement in healthcare, with the ambition of becoming the leading AI governance platform in the sector.

## Recent Changes (2025-10-26): Roadmap Progress

**18-Month Roadmap Execution Progress:**
- ✅ **Phase 1 (Translation Engine Moat)**: COMPLETE - 50 compliance controls, Event Normalizer, State Law Engine
- ✅ **Phase 2 (Network Effects)**: COMPLETE - Vendor Acceptance, Spectral Standard Tracker, Network Metrics
- ✅ **Phase 3 (Executive Reporting)**: COMPLETE - Executive Summary Generator, Audit Evidence Packager, Report Scheduler, Regulatory Alert Service
- ✅ **Phase 4 (Business Model)**: COMPLETE - Policy Enforcement Engine, AI Discovery Crawler, Usage Metering (interface)
- ✅ **Phase 5 (Scale & Acquisition)**: COMPLETE - Vendor Performance Tracker, Benchmarking Engine, Acquisition Data Room

### Phase 5 Completion (Scale & Acquisition Readiness)
**New Services (Production-Ready)** ✅:
- **Vendor Performance Tracker** (`vendor-performance-tracker.ts`): Aggregates vendor metrics across all customers with reliability scoring (0-100 composite weighted by compliance 40%, uptime 30%, violations 20%, certifications 10%), performance trends (improving/stable/declining), vendor scorecards with benchmarks, top performers leaderboard. **Performance optimized** with memoization cache and batch pre-fetching to handle large vendor loads without timeouts.
- **Benchmarking Engine** (`benchmarking-engine.ts`): Industry benchmarks by category (Clinical Imaging, Clinical Decision Support, Administrative RCM, Operations, Research), percentile calculations (p50/p90/p99) for metrics like time_to_production, compliance_score, violation_rate, uptime_percentage, alert_resolution_time, certification_pass_rate. Comparative analysis with performance levels (top 1%, top 10%, above/below median).
- **Acquisition Data Room** (`acquisition-data-room.ts`): Comprehensive M&A due diligence package including company overview, financial metrics (ARR $200K/health system + $50K/vendor, LTV:CAC 12:1, 5% churn, 95% GRR), network effects proof (density score, viral coefficient 1.3, 67% sales cycle reduction), technology metrics (50 controls, 5 frameworks, 99.9% uptime), growth metrics (15% MoM, 400% YoY), competitive positioning with moat analysis, data quality assessment (95% completeness, 98% accuracy), and export formats (JSON/CSV/PDF). Valuation estimation: 20x ARR multiple ($100-200M range).

**Performance Optimizations**:
- Memoization cache pattern prevents redundant database queries under multi-vendor loads
- Batch pre-fetching reduces query count from 4× to 2× per vendor (current + previous period)
- Batched processing with limited concurrency (5 concurrent vendors) prevents timeout issues
- Total database passes optimized for top performers leaderboard generation

**Design Notes**:
- Vendor reliability uses weighted composite scoring for balanced evaluation
- Benchmarks require minimum sample size for statistical validity
- Acquisition metrics include both actual and estimated financials (clearly labeled)
- Network density calculated as: connections / (health_systems × vendors)
- All services operate on existing data without requiring new database tables

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
-   **Vendor Performance & Benchmarking**: Vendor reliability scoring, industry benchmarks by category, performance trends, and top performers leaderboard.
-   **Acquisition Data Room**: Automated M&A due diligence package with company metrics, financial projections, network effects proof, and valuation estimates.

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