# ADR 001: Adopt Clean Architecture

**Date:** 2025-10-27  
**Status:** Accepted  
**Deciders:** Engineering Team, CTO

---

## Context

Spectral Healthcare AI Governance Platform has achieved A++ acquisition readiness with a feature-complete marketplace. However, architectural assessment revealed critical gaps:

**Current State (⭐⭐⭐ 3/5 Quality):**
- ✅ Production-ready TypeScript codebase
- ✅ Strong security (PHI encryption, MFA, SSO)
- ✅ Modern infrastructure (Stripe, Inngest, Drizzle ORM)
- ❌ **Zero test coverage** - No safety net for changes
- ❌ **Anemic domain model** - Business logic scattered across 56+ service files
- ❌ **Missing application layer** - No use cases, routes handle everything
- ❌ **Tight coupling** - Routes directly access storage/infrastructure

**Business Impact:**
- Long onboarding time for new developers (2-3 weeks)
- Fear of making changes (no tests to catch regressions)
- Difficult to add features (30% overhead from architectural friction)
- Higher bug rate in production

---

## Decision

We will adopt **Clean Architecture** using incremental vertical-slice refactoring over 20 weeks.

### Architecture Layers

```
┌─────────────────────────────────────────┐
│ FRAMEWORK (Routes, Controllers)         │
│         ↓ depends on                    │
├─────────────────────────────────────────┤
│ APPLICATION (Use Cases)                 │
│         ↓ depends on                    │
├─────────────────────────────────────────┤
│ DOMAIN (Entities, Business Logic)      │
│         ↑ implemented by                │
├─────────────────────────────────────────┤
│ INFRASTRUCTURE (Repos, Gateways)        │
└─────────────────────────────────────────┘
```

**Dependency Rule:** Dependencies always point inward. Outer layers depend on inner layers, never the reverse.

### Key Principles

1. **Domain Layer (Core):**
   - Business entities with behavior (not just data structures)
   - Value objects for domain concepts
   - Repository interfaces (not implementations)
   - Domain services for complex logic spanning entities

2. **Application Layer:**
   - Use cases orchestrating business workflows
   - Request/Response DTOs for each use case
   - Application services coordinating domain objects

3. **Infrastructure Layer:**
   - Repository implementations (Drizzle ORM)
   - External service gateways (Stripe, Epic FHIR, etc.)
   - Database migrations and persistence

4. **Framework Layer:**
   - Thin HTTP controllers
   - Authentication/authorization middleware
   - Route definitions

### Refactoring Approach

**Vertical Slicing:** Refactor one complete feature at a time through all layers before moving to the next.

**Phases:**
1. **Foundation (Weeks 1-2):** Testing framework, directory structure
2. **Pilot (Weeks 3-4):** Certification flow (prove approach)
3. **P1 Features (Weeks 5-8):** Billing, Policies, AI Systems
4. **Infrastructure (Weeks 9-10):** Repository pattern, gateway consolidation
5. **Testing (Weeks 11-12):** 80% test coverage
6. **Remaining (Weeks 13+):** P2/P3 features

**Safety Mechanisms:**
- Characterization tests before refactoring
- Parallel implementation (old code keeps working)
- Feature flags for gradual rollout
- No behavioral changes during refactoring

---

## Consequences

### Positive

1. **Testability:**
   - Domain logic testable without database or HTTP
   - Unit tests run in milliseconds
   - 80%+ test coverage achievable
   - Confident deployments

2. **Maintainability:**
   - Clear separation of concerns
   - Business logic easy to find and understand
   - New developers productive in 3 days (from 2-3 weeks)
   - Reduced cognitive load

3. **Scalability:**
   - Add features without touching infrastructure
   - Easy to swap databases/frameworks
   - Handle team growth without architecture rewrite

4. **Business Agility:**
   - Faster feature development (6+ months out)
   - Lower bug rate (50% reduction expected)
   - Confident experimentation
   - Compliance-ready (audit trails, testability)

### Negative

1. **Time Investment:**
   - 20 weeks of engineering time
   - Temporary parallel implementations
   - Learning curve for team

2. **Short-term Velocity:**
   - Feature development slower during refactoring
   - Need to maintain two codebases temporarily

3. **Complexity:**
   - More files and layers to navigate
   - Need to understand Clean Architecture principles

### Mitigation Strategies

- **Training:** 1-2 day workshop on Clean Architecture
- **Examples:** Template code for entities, use cases, repositories
- **Pair Programming:** Share knowledge across team
- **Feature Flags:** Safe rollback if issues arise
- **Documentation:** ADRs for each major decision

---

## Alternatives Considered

### 1. Full Rewrite
**Rejected:** Too risky, delays value delivery, high chance of failure

### 2. Continue Current Architecture
**Rejected:** Technical debt accumulating, team scaling issues, acquisition risk

### 3. Minimal Testing Only
**Rejected:** Doesn't address root architectural issues, temporary fix

### 4. Incremental Refactoring (CHOSEN)
**Accepted:** Low risk, continuous value delivery, proven approach

---

## Implementation Plan

See `docs/CLEAN_ARCHITECTURE_ROADMAP.md` for complete 20-week implementation plan.

**Pilot Feature:** Certification flow (Weeks 3-4)
- Self-contained domain
- 287 lines in single service file
- Business-critical with complex logic
- Perfect to validate approach

**Success Metrics:**
- 80%+ test coverage
- Zero regression bugs
- 100% of P1 features have use cases
- 0 business logic in routes
- Performance stable or improved

---

## References

- **Assessment:** Architectural evaluation document (2025-10-27)
- **Roadmap:** `docs/CLEAN_ARCHITECTURE_ROADMAP.md`
- **Quick Start:** `docs/QUICK_START_REFACTORING.md`
- **Presentation:** `docs/CLEAN_ARCHITECTURE_PRESENTATION.md`

**Related ADRs:**
- ADR 002: Repository Pattern Implementation (planned)
- ADR 003: Testing Strategy (planned)
- ADR 004: Dependency Injection (planned)

---

**Approved by:**
- Engineering Team: [Date TBD]
- CTO: [Date TBD]

**Status:** Accepted - Implementation starting Week 1
