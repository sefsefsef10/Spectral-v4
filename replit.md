# Spectral Healthcare AI Governance Platform

## Overview
Spectral is a B2B SaaS platform focused on AI governance, monitoring, and compliance within the healthcare sector. Its core mission is to mitigate risks, identify operational blind spots, and streamline AI procurement for healthcare organizations and AI vendors. The platform provides executive reporting, alert management, compliance dashboards, and automated certification workflows to ensure the responsible and compliant adoption of AI. The strategic vision is to establish Spectral as the leading solution in healthcare AI governance, aiming for significant market penetration and valuation through its robust network effects infrastructure.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend is built with React 18+, TypeScript, Vite, Wouter, Shadcn/ui (Radix UI), and Tailwind CSS, designed to deliver an executive-grade professional aesthetic and clear data presentation.

### Technical Implementations
The backend is an Express.js application developed with TypeScript, exposing a RESTful API. It employs session-based authentication and a zero-trust multi-tenant architecture with Role-Based Access Control (RBAC). PostgreSQL, managed with Drizzle ORM and validated by Zod, serves as the primary data store, utilizing Neon for serverless connections. Security features include hashed tokens, JSONB audit logs, and AES-256-GCM encryption for sensitive data. The project is structured as a monorepo.

Key features include:
- **Tiered Translation Engine Customization:** A three-tier monetization system (Foundation, Growth, Enterprise) offering threshold tuning, control toggles, and custom compliance controls, incorporating regulatory guardrails (e.g., HIPAA compliance) and maintaining a complete audit trail.
- **AI Certification Workflow (Beacon):** A three-tiered certification system (Verified/Certified/Trusted) that automates testing for PHI exposure, clinical accuracy, and bias detection, also validating deployment history.
- **Telemetry Polling Infrastructure:** Production-ready polling from AI observability platforms via API, converting metrics to `aiTelemetryEvents` with PHI encryption, including database persistence, deduplication, and integration with Inngest.
- **EHR Integration Infrastructure:** Production-ready FHIR adapters for Epic, Cerner, and Athenahealth, featuring credential encryption, automated AI system discovery, and scheduled/on-demand syncing via Inngest workflows.
- **Legal Foundation:** Comprehensive, HIPAA-compliant templates for legal documentation (Privacy Policy, Terms of Service, BAA, MSA).
- **Network Effects Infrastructure:** Dashboards for health systems and vendors to demonstrate market reach and procurement opportunities, including ROI tracking.
- **Advanced Security:** Features webhook signature verification, payload validation, secret management, rate limiting, and AES-256-GCM encryption with automated PHI redaction.
- **Compliance Expansion:** Support for ISO 42001 and a control versioning system.
- **Durable Workflows (Inngest):** Ensures zero data loss for critical processes through retries and cron scheduling.
- **Billing Infrastructure:** Schema for Stripe integration, plan tiers, and usage metering.
- **Enterprise SSO (WorkOS):** SAML/OAuth with auto-provisioning.
- **Automated Rollback System (Sentinel):** Policy management, deployment history tracking, automated/manual rollback execution, and an approval workflow with audit trails and role-based authorization. Full database schema includes deployment_history, rollback_executions, and rollback_policies tables with foreign key constraints.
- **Automated Quarterly Re-Verification (Beacon):** A 90-day certification cycle with 7-day cascade intervals for tier downgrades (trusted→certified→verified→null), expiry detection, and anti-spam logic. AI systems track verificationTier, verificationDate, and verificationExpiry for automated lifecycle management.
- **Embeddable Badge Widget:** JavaScript widget vendors can embed on their websites to display Beacon certification status. Includes /api/public/vendors/:vendorId/badge (JSON API) and /api/public/vendors/:vendorId/badge.js (embeddable script) with auto-updating tier display and trust page linking.
- **Rosetta Stone Tool:** Metric translation tool mapping vendor observability platforms (LangSmith, Arize, LangFuse, W&B) to Spectral compliance frameworks (HIPAA, NIST AI RMF, FDA). Provides gap analysis, compliance scoring, and actionable setup recommendations. Reduces vendor onboarding friction by showing current coverage vs. missing metrics.
- **Multi-Platform Telemetry Polling:** Production-ready polling from 4 observability platforms (LangSmith, Arize, LangFuse, W&B) with unified TelemetryPoller, platform-specific adapters, and 15-minute cron job via Inngest.

### Feature Specifications
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

## Recent Changes (October 27, 2025)

### A++ Acquisition Readiness Features
1. **Database Schema Synchronization**: All rollback tables (deployment_history, rollback_executions, rollback_policies) and Beacon verification columns (verification_tier, verification_date, verification_expiry) successfully synced to production database.

2. **Marketplace Completion**:
   - **Vendor Trust Pages**: Public vendor profiles at /public/vendors/:vendorId/trust-page showing certifications, partnerships, deployment stats (already existed, verified complete).
   - **Embeddable Badge Widget**: Self-contained JavaScript widget for vendor websites with tier-specific colors (Trusted=purple, Certified=blue, Verified=green), auto-updates, and trust page linking. Vendor badge manager at /badge provides copy-paste embed code.
   - **Rosetta Stone Tool**: Comprehensive metric mapping tool at /rosetta-stone analyzing vendor observability platforms against Spectral compliance frameworks. Shows compliance score, control coverage by framework, missing event types, and step-by-step setup recommendations.

3. **Epic Sandbox Validation Documentation**: Complete 6-week testing protocol at docs/epic-sandbox-validation.md covering OAuth authentication, FHIR API testing, webhook configuration, AI system discovery, performance/load testing, and production readiness checklist.

4. **Predictive Analytics API**: Complete API routes for ML-based predictive alerts with database-level tenant filtering using inArray() to prevent cross-tenant data leakage.

5. **Enterprise SSO Auto-Provisioning**: WorkOS integration with automatic user/org creation, role mapping, and audit logging for SAML/OAuth flows.

6. **Clean Architecture Refactoring Plan** (October 27, 2025): Comprehensive 20-week roadmap to incrementally refactor codebase to Clean Architecture principles. Assessment identified current state: 3/5 quality, 40% architectural alignment. Critical gaps: zero test coverage, anemic domain model, missing application layer. Plan uses vertical-slice refactoring approach starting with Certification flow as pilot, then expanding to high-value features (Billing, Policy Enforcement, AI Systems). Expected outcomes: 80%+ test coverage, testable business logic, faster feature development, improved maintainability. See docs/CLEAN_ARCHITECTURE_ROADMAP.md for full implementation plan.

7. **Phase 1 Foundation Complete** (October 27, 2025): 
   - **Testing Infrastructure**: Vitest 4.0.4 configured with 80% coverage thresholds, smoke tests passing (4/4), example domain entity tests passing (32/32)
   - **Directory Structure**: Clean Architecture layers created (domain/, application/, infrastructure/, tests/)
   - **Example Templates**: Complete domain entity template with 100% test coverage, use case guidelines, repository patterns
   - **Architectural Governance**: ESLint rules enforcing dependency boundaries (domain cannot depend on infrastructure/application)
   - **Documentation**: ADR 001 (Adopt Clean Architecture), Phase 1 Implementation Guide, team resources (README files for each layer)
   - **Status**: Foundation validated and ready for Phase 2 pilot refactoring (Certification flow)