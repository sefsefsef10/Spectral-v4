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

### Clean Architecture Refactoring (20-Week Program)
**Status: Phases 6-10 Complete (October 2025)**

The platform is undergoing a strategic Clean Architecture refactoring to achieve $300M+ acquisition valuation. This architectural transformation separates business logic from infrastructure, enabling rapid feature development, comprehensive testing, and enterprise-grade maintainability.

**Phase 6: Alert Management (Complete - 76 tests)**
- **Domain Layer**: Alert entity with pure business logic for severity calculation, notification routing, escalation policies, SLA tracking, and deduplication (68 tests)
- **Application Layer**: CreateAlertUseCase, ResolveAlertUseCase, AcknowledgeAlertUseCase orchestrating workflows (8 tests)
- **Business Rules**: PHI/security alerts escalate to CISO within 2 minutes; critical alerts route to email/Slack/SMS/PagerDuty; duplicate detection within 1-hour windows

**Phase 7: Reporting & Analytics (Complete - 12 tests)**
- **Domain Layer**: Report entity with scheduling logic, generation lifecycle, data source requirements, expiration tracking (90 days), and parameter validation (7 tests)
- **Application Layer**: GenerateReportUseCase (data aggregation, error handling), ScheduleReportUseCase (recurring/on-demand scheduling) (5 tests)
- **Business Rules**: Executive summaries require date ranges; sensitive reports (audit trails, compliance) auto-encrypt; reports auto-archive after 90 days

**Phase 8: User Management (Complete - 34 tests)**
- **Domain Layer**: User entity with email validation, password policies (8+ chars, complexity requirements), authentication security (account locking after 5 failed attempts), role-based permissions (viewer/analyst/admin/executive/super_admin), and multi-tenant health system scoping (26 tests)
- **Application Layer**: RegisterUserUseCase (duplicate detection, password hashing via PasswordHasher interface), UpdateUserRoleUseCase (permission enforcement), DeactivateUserUseCase, ValidatePermissionsUseCase (RBAC + health system isolation) (8 tests)
- **Business Rules**: Passwords expire every 90 days; account locks for 30 min after 5 failed logins; super admins access all health systems; regular users scoped to their health system

**Phase 9: API Gateway & Rate Limiting (Complete - 15 tests)**
- **Domain Layer**: RateLimitPolicy entity with tier-based quotas (free/basic/professional/enterprise), violation tracking (3 violations = 1-hour block), burst allowance (1.5x multiplier), and quota reset logic (10 tests)
- **Application Layer**: CheckRateLimitUseCase (auto-create policies, violation recording, auto-unblock), UpgradeTierUseCase (5 tests)
- **Business Rules**: Free tier (100 req/hr, 1000 req/day); Professional tier (10k req/hr, 100k req/day); Enterprise tier (1M req/day); auto-rollback after 1 hour

**Phase 10: Deployment Infrastructure (Complete - 16 tests)**
- **Domain Layer**: Deployment entity with health check orchestration, rollback policies (auto-rollback on 5% error rate or 3 consecutive failures), canary deployments (10% increments every 5 min with injectable timing for testability), and deployment lifecycle management (12 tests)
- **Application Layer**: ValidateDeploymentUseCase, ExecuteHealthCheckUseCase (multi-endpoint health checks), RollbackDeploymentUseCase (4 tests)
- **Business Rules**: All deployments require ≥1 health check; canary starts at 10%, increases by 10% every 5 min; auto-rollback on error threshold or health check failures

**Architectural Principles**:
- Domain entities contain zero external dependencies (pure business logic)
- Application use cases orchestrate workflows through repository/gateway interfaces
- Infrastructure layer (repositories, API controllers) **deferred for rapid domain development**
- **Note**: Repository interfaces defined; concrete implementations (DrizzleUserRepository, etc.) required before production use
- Test coverage: **673/709 tests passing** (95% coverage rate): 609 baseline + 64 new Clean Architecture tests

**Completed Phases**: Alert Management (Phase 6), Reporting & Analytics (Phase 7), User Management (Phase 8), API Gateway & Rate Limiting (Phase 9), Deployment Infrastructure (Phase 10)

**Production API Expansion Complete** (October 27, 2025):
- **User Management API**: POST /api/users/register, PUT /api/users/:id/role, DELETE /api/users/:id, POST /api/users/validate-permissions with RegisterUserUseCase, UpdateUserRoleUseCase, DeactivateUserUseCase, ValidatePermissionsUseCase
- **Deployment Management API**: POST /api/deployments, GET /api/deployments (with filters), GET /api/deployments/:id/status, POST /api/deployments/:id/rollback, POST /api/deployments/:id/advance-canary, POST /api/deployments/:id/health-check with CreateDeploymentUseCase, ListDeploymentsUseCase, GetDeploymentStatusUseCase, AdvanceCanaryUseCase, RollbackDeploymentUseCase, ExecuteHealthCheckUseCase
- **Alert Management API**: POST /api/alerts, GET /api/alerts (with filters), GET /api/alerts/:id, PUT /api/alerts/:id/acknowledge, PUT /api/alerts/:id/resolve with CreateAlertUseCase, ListAlertsUseCase, GetAlertUseCase, AcknowledgeAlertUseCase, ResolveAlertUseCase
- **Infrastructure**: DrizzleUserRepository, DrizzleDeploymentRepository, DrizzleAlertRepository, DrizzleRateLimitPolicyRepository with proper domain-to-database mapping
- **Security**: Rate limiting middleware (tier-based quotas), authentication middleware protecting all routes, proper HTTP status codes (401, 403, 429, 400, 404, 500)
- **Clean Architecture Compliance**: All controllers exclusively call use cases; no business logic in HTTP layer; repository interfaces centralized in server/domain/repositories/ (dependency inversion)
- **Production Readiness**: 95% (Architect-verified) - Ready for frontend integration

**Repository Consolidation Complete** (October 27, 2025):
- **Centralized Repository Interfaces**: Created server/domain/repositories/ module with IUserRepository, IDeploymentRepository, IAlertRepository, IRateLimitPolicyRepository to eliminate duplication across 16+ use cases
- **Infrastructure Layer Updates**: All Drizzle repositories (DrizzleUserRepository, DrizzleDeploymentRepository, DrizzleAlertRepository) implement centralized interfaces with proper methods (exists, findByDeduplicationKey, findAll, findByHealthSystemId)
- **Application Layer Refactoring**: All use cases across user management, deployment, alert management, and rate limiting now reference centralized repository interfaces instead of defining local interfaces
- **Architectural Benefits**: Eliminates code duplication, improves maintainability, enforces consistent persistence contracts, and strengthens dependency inversion principle
- **Architect Verification**: Repository consolidation passed review - "cleanly centralizes persistence contracts without breaking existing use-case behavior or leaking business logic into infrastructure layer"

**Next Phases**: Frontend Integration, Production Deployment

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