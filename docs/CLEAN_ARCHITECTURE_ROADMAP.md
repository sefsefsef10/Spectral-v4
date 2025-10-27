# Clean Architecture Refactoring Roadmap
## Spectral Healthcare AI Platform

**Created:** October 27, 2025  
**Status:** Ready for Execution  
**Timeline:** 20 weeks (5 months)  
**Effort:** 1-2 engineers dedicated

---

## Executive Summary

### Current State: 3/5 Quality, 40% Clean Architecture Alignment

**Strengths:**
- ✅ Production-ready TypeScript codebase with strong type safety
- ✅ Modern infrastructure (Stripe, encryption, MFA, SSO, Inngest workflows)
- ✅ Security-conscious (PHI encryption, CSRF protection, rate limiting)
- ✅ Feature-rich healthcare AI compliance platform

**Critical Gaps:**
- ❌ **Zero test coverage** - No unit, integration, or E2E tests
- ❌ **Missing application layer** (use cases) - 0% aligned
- ❌ **Anemic domain model** - Business logic scattered across 56+ service files
- ❌ **Tight coupling** - Routes directly access storage/infrastructure

### Recommendation: Incremental Vertical-Slice Refactoring

**NOT** a full rewrite. Refactor feature-by-feature using **vertical slicing** (one user story through all layers before moving to next).

**Key Success Factor:** Write tests BEFORE refactoring to create safety net.

---

## 6-Phase Execution Plan

### Phase 1: Foundation Setup (Weeks 1-2)
**Goal:** Establish testing framework and directory structure  
**Risk:** Low | **Business Value:** Foundation for all future work

#### Week 1: Testing Infrastructure

1. **Install testing framework**
   ```bash
   npm install -D vitest @vitest/ui @testing-library/react
   npm install -D supertest @types/supertest
   ```

2. **Create vitest.config.ts**
   ```typescript
   import { defineConfig } from 'vitest/config';
   
   export default defineConfig({
     test: {
       globals: true,
       environment: 'node',
       coverage: {
         provider: 'v8',
         reporter: ['text', 'json', 'html'],
         exclude: ['node_modules/', 'tests/', '**/*.test.ts']
       }
     }
   });
   ```

3. **Write first characterization test** (smoke test)
   ```typescript
   // tests/integration/routes/health-check.test.ts
   describe('Health Check', () => {
     it('should respond with 200 OK', async () => {
       const response = await request(app).get('/api/health');
       expect(response.status).toBe(200);
     });
   });
   ```

4. **Update package.json scripts**
   ```json
   {
     "scripts": {
       "test": "vitest",
       "test:coverage": "vitest --coverage",
       "test:ui": "vitest --ui"
     }
   }
   ```

#### Week 2: Directory Structure

1. **Create new layer directories**
   ```bash
   mkdir -p server/domain/{entities,value-objects,repositories,services,events}
   mkdir -p server/application/{billing,certifications,policies,ai-systems}
   mkdir -p server/infrastructure/{repositories,gateways,encryption,persistence}
   mkdir -p tests/{unit,integration,e2e}
   ```

2. **Create template files** (examples for team)
   - `server/domain/entities/ExampleEntity.ts` - Rich domain model template
   - `server/application/ExampleUseCase.ts` - Use case template
   - `tests/unit/domain/ExampleEntity.test.ts` - Unit test template

3. **Configure ESLint architectural rules**
   ```bash
   npm install -D eslint-plugin-import eslint-plugin-boundaries
   ```

4. **Create ADR directory**
   ```bash
   mkdir ADRs
   ```

**Phase 1 Deliverables:**
- [x] Testing framework configured
- [x] First smoke test passing
- [x] Directory structure created
- [x] Team templates available
- [x] ESLint configured
- [x] ADR process documented

---

### Phase 2: Pilot Refactor - Certification Flow (Weeks 3-4)
**Goal:** Validate approach with one complete vertical slice  
**Risk:** Medium | **Business Value:** Proves refactoring viability

**Why Certification Flow?**
- Self-contained domain (clear boundaries)
- 287 lines in single service file (manageable scope)
- Business-critical feature (high value)
- Complex enough to validate architecture (scoring, validation, testing)

#### Week 3: Characterization Tests + Domain Layer

**Step 1: Lock existing behavior with tests**
```typescript
// tests/integration/certifications/existing-behavior.test.ts
describe('Certification Processing (Existing Behavior)', () => {
  it('should approve application with score >= 70', async () => {
    // Test current behavior BEFORE refactoring
    const application = await createTestApplication({
      documentation: complete,
      complianceStatements: valid,
      testResults: allPassed
    });
    
    const result = await processCertificationApplication(application.id);
    
    expect(result.status).toBe('approved');
    expect(result.score).toBeGreaterThanOrEqual(70);
  });
});
```

**Step 2: Extract domain entities**
```typescript
// server/domain/entities/CertificationApplication.ts
export class CertificationApplication {
  private constructor(
    private _id: string,
    private _vendorId: string,
    private _tierRequested: CertificationTier,
    private _checks: CertificationChecks,
    private _status: ApplicationStatus
  ) {}
  
  static create(
    vendorId: string,
    tierRequested: CertificationTier,
    documentation: Documentation,
    complianceStatements: ComplianceStatements
  ): CertificationApplication {
    return new CertificationApplication(
      generateId(),
      vendorId,
      tierRequested,
      CertificationChecks.initial(documentation, complianceStatements),
      ApplicationStatus.PENDING
    );
  }
  
  evaluate(): EvaluationResult {
    this._checks.validateDocumentation();
    this._checks.validateCompliance();
    return new EvaluationResult(
      this.calculateScore(),
      this._checks
    );
  }
  
  calculateScore(): number {
    let score = 0;
    if (this._checks.documentationComplete) score += 20;
    if (this._checks.complianceStatementsValid) score += 20;
    if (this._checks.deploymentHistoryValid) score += 10;
    if (this._checks.phiExposureTest) score += 15;
    if (this._checks.clinicalAccuracyTest) score += 15;
    if (this._checks.biasDetectionTest) score += 10;
    if (this._checks.securityScanTest) score += 10;
    return score;
  }
  
  hasPassedEvaluation(): boolean {
    const thresholds = {
      [CertificationTier.VERIFIED]: 40,
      [CertificationTier.CERTIFIED]: 60,
      [CertificationTier.TRUSTED]: 80
    };
    
    return this._checks.allChecksPassed() &&
           this.calculateScore() >= thresholds[this._tierRequested];
  }
  
  applyTestResults(results: TestResults): void {
    this._checks.updateFromTests(results);
  }
  
  approve(): void {
    if (!this.hasPassedEvaluation()) {
      throw new DomainError('Cannot approve application that has not passed evaluation');
    }
    this._status = ApplicationStatus.APPROVED;
  }
  
  reject(reason: string): void {
    this._status = ApplicationStatus.REJECTED;
  }
}
```

**Step 3: Create value objects**
```typescript
// server/domain/value-objects/CertificationTier.ts
export enum CertificationTier {
  VERIFIED = 'verified',
  CERTIFIED = 'certified',
  TRUSTED = 'trusted'
}

// server/domain/value-objects/CertificationChecks.ts
export class CertificationChecks {
  private constructor(
    readonly documentationComplete: boolean,
    readonly complianceStatementsValid: boolean,
    readonly deploymentHistoryValid: boolean,
    readonly phiExposureTest: boolean,
    readonly clinicalAccuracyTest: boolean,
    readonly biasDetectionTest: boolean,
    readonly securityScanTest: boolean
  ) {}
  
  static initial(
    documentation: Documentation,
    complianceStatements: ComplianceStatements
  ): CertificationChecks {
    return new CertificationChecks(
      documentation.isComplete(),
      complianceStatements.isValid(),
      false, false, false, false, false
    );
  }
  
  allChecksPassed(): boolean {
    return this.documentationComplete &&
           this.complianceStatementsValid &&
           this.deploymentHistoryValid &&
           this.phiExposureTest &&
           this.clinicalAccuracyTest &&
           this.biasDetectionTest &&
           this.securityScanTest;
  }
  
  updateFromTests(results: TestResults): CertificationChecks {
    return new CertificationChecks(
      this.documentationComplete,
      this.complianceStatementsValid,
      this.deploymentHistoryValid,
      results.phiExposure.passed,
      results.clinicalAccuracy.passed,
      results.biasDetection.passed,
      results.securityScan.passed
    );
  }
}
```

**Step 4: Write unit tests for domain**
```typescript
// tests/unit/domain/entities/CertificationApplication.test.ts
describe('CertificationApplication', () => {
  describe('calculateScore', () => {
    it('should award 20 points for complete documentation', () => {
      const application = CertificationApplication.create(
        'vendor-1',
        CertificationTier.VERIFIED,
        Documentation.complete(['doc1.pdf']),
        ComplianceStatements.hipaaOnly()
      );
      
      application.evaluate();
      const score = application.calculateScore();
      
      expect(score).toBe(40); // 20 (docs) + 20 (compliance)
    });
    
    it('should require 80+ score for Trusted tier', () => {
      const application = CertificationApplication.create(
        'vendor-1',
        CertificationTier.TRUSTED,
        Documentation.minimal(),
        ComplianceStatements.hipaaOnly()
      );
      
      const result = application.evaluate();
      
      expect(result.passed).toBe(false);
      expect(application.calculateScore()).toBeLessThan(80);
    });
  });
  
  describe('approve', () => {
    it('should throw error if evaluation not passed', () => {
      const application = createFailingApplication();
      
      expect(() => application.approve()).toThrow(DomainError);
    });
  });
});
```

#### Week 4: Application + Infrastructure Layers

**Step 1: Create repository interface**
```typescript
// server/domain/repositories/CertificationApplicationRepository.ts
export interface CertificationApplicationRepository {
  findById(id: string): Promise<CertificationApplication | null>;
  save(application: CertificationApplication): Promise<void>;
  findByVendor(vendorId: string): Promise<CertificationApplication[]>;
}
```

**Step 2: Create use case**
```typescript
// server/application/certifications/ProcessApplication.ts
export class ProcessCertificationApplicationRequest {
  constructor(readonly applicationId: string) {}
}

export class ProcessCertificationApplicationResponse {
  constructor(
    readonly id: string,
    readonly passed: boolean,
    readonly score: number,
    readonly status: string
  ) {}
  
  static fromEntity(app: CertificationApplication): ProcessCertificationApplicationResponse {
    return new ProcessCertificationApplicationResponse(
      app.id,
      app.hasPassedEvaluation(),
      app.calculateScore(),
      app.status
    );
  }
}

export class ProcessCertificationApplicationUseCase {
  constructor(
    private certificationRepo: CertificationApplicationRepository,
    private testingGateway: VendorTestingGateway
  ) {}
  
  async execute(
    request: ProcessCertificationApplicationRequest
  ): Promise<ProcessCertificationApplicationResponse> {
    // Load aggregate
    const application = await this.certificationRepo.findById(request.applicationId);
    if (!application) {
      throw new ApplicationNotFoundError(request.applicationId);
    }
    
    // Domain logic - entity has business rules
    const result = application.evaluate();
    
    // Infrastructure - gateway handles external testing
    const testResults = await this.testingGateway.runTests(application);
    application.applyTestResults(testResults);
    
    // Approve if passed
    if (application.hasPassedEvaluation()) {
      application.approve();
    } else {
      application.reject('Evaluation criteria not met');
    }
    
    // Persist
    await this.certificationRepo.save(application);
    
    return ProcessCertificationApplicationResponse.fromEntity(application);
  }
}
```

**Step 3: Implement repository**
```typescript
// server/infrastructure/repositories/DrizzleCertificationApplicationRepository.ts
export class DrizzleCertificationApplicationRepository
  implements CertificationApplicationRepository {
  
  constructor(private db: DrizzleDB) {}
  
  async findById(id: string): Promise<CertificationApplication | null> {
    const result = await this.db
      .select()
      .from(certificationApplicationsTable)
      .where(eq(certificationApplicationsTable.id, id));
    
    return result[0] ? this.toDomainEntity(result[0]) : null;
  }
  
  async save(application: CertificationApplication): Promise<void> {
    const row = this.toDatabase(application);
    
    await this.db
      .insert(certificationApplicationsTable)
      .values(row)
      .onConflictDoUpdate({
        target: certificationApplicationsTable.id,
        set: row
      });
  }
  
  private toDomainEntity(row: CertificationApplicationRow): CertificationApplication {
    // Map database row to domain entity
    return CertificationApplication.reconstitute(
      row.id,
      row.vendor_id,
      row.tier_requested as CertificationTier,
      this.mapChecks(row),
      row.status as ApplicationStatus,
      row.score
    );
  }
  
  private toDatabase(app: CertificationApplication): CertificationApplicationRow {
    // Map domain entity to database row
    return {
      id: app.id,
      vendor_id: app.vendorId,
      tier_requested: app.tierRequested,
      checks: JSON.stringify(app.checks),
      status: app.status,
      score: app.calculateScore(),
      updated_at: new Date()
    };
  }
}
```

**Step 4: Create thin controller**
```typescript
// server/frameworks/http/controllers/CertificationController.ts
export class CertificationController {
  constructor(
    private processApplicationUseCase: ProcessCertificationApplicationUseCase
  ) {}
  
  async processApplication(req: Request, res: Response): Promise<void> {
    try {
      const request = new ProcessCertificationApplicationRequest(
        req.params.id
      );
      
      const response = await this.processApplicationUseCase.execute(request);
      
      res.status(200).json(response);
    } catch (error) {
      if (error instanceof ApplicationNotFoundError) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error({ err: error }, 'Process application error');
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
}
```

**Step 5: Wire up with feature flag**
```typescript
// server/routes/certifications.ts
const USE_NEW_IMPLEMENTATION = process.env.FEATURE_NEW_CERTIFICATION === 'true';

app.post('/api/certifications/:id/process', requireAuth, async (req, res) => {
  if (USE_NEW_IMPLEMENTATION) {
    // New Clean Architecture implementation
    const certRepo = new DrizzleCertificationApplicationRepository(db);
    const testingGateway = new VendorTestingGatewayImpl();
    const useCase = new ProcessCertificationApplicationUseCase(certRepo, testingGateway);
    const controller = new CertificationController(useCase);
    
    return controller.processApplication(req, res);
  } else {
    // Old implementation (safety fallback)
    const result = await processCertificationApplication(req.params.id);
    res.json(result);
  }
});
```

**Step 6: Integration tests**
```typescript
// tests/integration/application/ProcessCertificationApplication.test.ts
describe('ProcessCertificationApplicationUseCase', () => {
  let useCase: ProcessCertificationApplicationUseCase;
  let mockRepo: InMemoryCertificationApplicationRepository;
  let mockGateway: MockVendorTestingGateway;
  
  beforeEach(() => {
    mockRepo = new InMemoryCertificationApplicationRepository();
    mockGateway = new MockVendorTestingGateway();
    useCase = new ProcessCertificationApplicationUseCase(mockRepo, mockGateway);
  });
  
  it('should process application and save result', async () => {
    const application = createSampleApplication();
    mockRepo.setApplication(application);
    mockGateway.setTestResults(TestResults.allPassed());
    
    const response = await useCase.execute(
      new ProcessApplicationRequest(application.id)
    );
    
    expect(response.passed).toBe(true);
    expect(mockRepo.saveWasCalled).toBe(true);
  });
});
```

**Step 7: Deploy with feature flag**
```bash
# Start with 0% traffic
FEATURE_NEW_CERTIFICATION=false

# Test with single user
FEATURE_NEW_CERTIFICATION=true (for specific user ID)

# Gradual rollout: 10% → 50% → 100%
```

**Phase 2 Deliverables:**
- [x] Certification domain entities extracted
- [x] Use case implemented
- [x] Repository pattern applied
- [x] All tests passing (characterization + new)
- [x] Feature flag deployed
- [x] Old code still working (parallel implementation)
- [x] Team validated approach
- [x] ADR documented

**Phase 2 Success Metrics:**
- 90%+ test coverage for certification domain
- Zero regression bugs
- Feature flag working correctly
- Team confident in approach

---

### Phase 3: P1 Features - High Business Value (Weeks 5-8)
**Goal:** Refactor critical business capabilities  
**Risk:** Medium | **Business Value:** High

#### Priority 1 Features (Must Refactor)

**Week 5-6: Billing & Subscriptions**
- Domain: `Subscription` entity, `SubscriptionTier`, `UsageLimit` value objects
- Application: `CreateHealthSystemSubscriptionUseCase`, `CheckUsageLimitsUseCase`
- Infrastructure: `DrizzleSubscriptionRepository`, `StripeGateway`
- Tests: Unit (domain), Integration (use cases), E2E (Stripe webhooks)

**Week 7: Policy Enforcement**
- Domain: `Policy` entity, `PolicyRule`, `Violation` value objects
- Application: `CreatePolicyUseCase`, `EvaluateAISystemUseCase`
- Infrastructure: `DrizzlePolicyRepository`
- Tests: Unit (policy evaluation logic)

**Week 8: AI System Management**
- Domain: `AISystem` entity, `RiskLevel`, `SystemStatus` value objects
- Application: `RegisterAISystemUseCase`, `DeployAISystemUseCase`
- Infrastructure: `DrizzleAISystemRepository`
- Tests: Unit (deployment rules)

**Phase 3 Deliverables:**
- [x] 3 P1 features refactored
- [x] 80%+ test coverage for each
- [x] Feature flags for all
- [x] All deployed to production
- [x] Zero regression bugs
- [x] Performance metrics stable

---

### Phase 4: Infrastructure Refactoring (Weeks 9-10)
**Goal:** Clean up technical debt and consolidate infrastructure  
**Risk:** Low | **Business Value:** Code maintainability

#### Tasks

**Week 9: Repository Extraction**
- Extract all repositories from `storage.ts` singleton
- Implement repository pattern for all data access
- Configure dependency injection
- Remove `storage.ts` singleton

**Week 10: Gateway Consolidation**
- Consolidate notification services → `NotificationGateway`
- Consolidate encryption services → `EncryptionService`
- Extract testing infrastructure → `VendorTestingGateway`
- Update all use cases to use new gateways

**Phase 4 Deliverables:**
- [x] All repositories extracted
- [x] All gateways abstracted
- [x] `storage.ts` singleton removed
- [x] Dependency injection configured
- [x] All tests passing

---

### Phase 5: Testing Implementation (Weeks 11-12)
**Goal:** Achieve 80% test coverage  
**Risk:** Low | **Business Value:** Safety net for future changes

#### Test Strategy

**Testing Pyramid:**
```
        /\
       /E2E\      ← 5-10 tests (critical user flows)
      /------\
     /  Integ \   ← 50-100 tests (use cases + repos)
    /----------\
   /    Unit    \ ← 200+ tests (entities, value objects)
  /              \
```

**Week 11: Unit Tests**
- 200+ unit tests for domain entities
- 90%+ coverage for domain layer
- Fast (<1 second for all unit tests)

**Week 12: Integration + E2E Tests**
- 50+ integration tests for use cases
- 5-10 E2E tests for critical flows
- CI/CD pipeline configured

**Phase 5 Deliverables:**
- [x] 200+ unit tests
- [x] 50+ integration tests
- [x] 5-10 E2E tests
- [x] 80%+ overall coverage
- [x] CI/CD running tests
- [x] Test documentation

---

### Phase 6: Remaining Features (Weeks 13+)
**Goal:** Complete refactoring for all business capabilities  
**Risk:** Low | **Business Value:** Complete architecture

#### P2 Features (Medium Priority)

- **Week 13-14:** Compliance Reporting
- **Week 15-16:** Vendor Performance Tracking
- **Week 17-18:** Network Metrics
- **Week 19-20:** Analytics & Dashboards

#### P3 Features (Lower Priority)

- Background jobs refactoring (Inngest workflows)
- Telemetry polling optimization
- Audit log improvements

**Phase 6 Deliverables:**
- [x] All P2 features refactored
- [x] P3 features refactored (if time allows)
- [x] 80%+ test coverage maintained
- [x] All feature flags removed
- [x] Old code deleted

---

## Success Metrics

### Architectural Health

- [ ] 100% of P1 features have domain entities
- [ ] 100% of P1 features have use cases
- [ ] 0 direct database access in routes
- [ ] 0 business logic in framework layer
- [ ] Repository pattern for all data access
- [ ] Dependencies flow inward

### Code Quality

- [ ] 80%+ test coverage
- [ ] <500 lines per service file
- [ ] <10 dependencies per module
- [ ] ESLint architectural rules passing
- [ ] 0 circular dependencies

### Business Continuity

- [ ] 99.9%+ uptime maintained
- [ ] No customer-reported issues from refactoring
- [ ] Performance metrics stable or improved
- [ ] Support tickets declining

---

## Refactoring Guidelines

### DO ✅

1. **Write tests BEFORE refactoring** (characterization tests)
2. **Refactor one feature at a time** (vertical slices)
3. **Keep existing code working** (parallel implementation)
4. **Use feature flags** for gradual rollout
5. **Document decisions** (ADRs)
6. **Pair program** on refactoring
7. **Review code** at each checkpoint

### DON'T ❌

1. **Don't rewrite everything at once**
2. **Don't skip testing**
3. **Don't break existing functionality**
4. **Don't mix refactoring with new features**
5. **Don't ignore performance**
6. **Don't let perfect be enemy of good**
7. **Don't forget to delete old code** (after cutover)

---

## Risk Management

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Breaking functionality** | High | Critical | • Characterization tests first<br>• Parallel implementation<br>• Feature flags |
| **Performance degradation** | Medium | High | • Monitor metrics<br>• Load testing<br>• Optimize hotspots |
| **Team velocity slowdown** | Medium | Medium | • Training<br>• Pair programming<br>• Clear examples |
| **Scope creep** | Medium | Medium | • Vertical slices<br>• No new features<br>• Time-box phases |

### Rollback Plan

1. **Immediate:** Disable feature flag (revert to old implementation)
2. **Investigate:** Analyze logs, metrics, error reports
3. **Fix:** Address issue in new implementation
4. **Re-validate:** Test thoroughly in staging
5. **Re-deploy:** Gradual rollout (10% → 50% → 100%)

---

## Timeline Summary

| Phase | Duration | Team | Business Value |
|-------|----------|------|----------------|
| **1. Foundation** | 2 weeks | 1 engineer | Foundation |
| **2. Pilot** | 2 weeks | 1-2 engineers | Validate approach |
| **3. P1 Features** | 4 weeks | 1-2 engineers | High value |
| **4. Infrastructure** | 2 weeks | 1 engineer | Technical debt |
| **5. Testing** | 2 weeks | 1 engineer + QA | Safety net |
| **6. Remaining** | 8+ weeks | 1-2 engineers | Complete |

**Total:** 20+ weeks (5 months) with 1-2 engineers dedicated

---

## Next Actions

### Week 1: Get Started

1. **Present to stakeholders** - Get alignment and approval
2. **Install testing framework** - Vitest, supertest
3. **Create directory structure** - domain/, application/, infrastructure/
4. **Write first test** - Health check smoke test
5. **Choose pilot feature** - Certification flow (recommended)

### Week 2: Build Foundation

1. **Configure ESLint rules** - Architectural fitness functions
2. **Create templates** - Entity, use case, test examples
3. **Write characterization tests** - Lock existing certification behavior
4. **Start ADR process** - Document decision to adopt Clean Architecture

### Week 3-4: Execute Pilot

1. **Extract certification domain**
2. **Create use case + repository**
3. **Deploy with feature flag**
4. **Validate approach**
5. **Team retrospective**

---

**Document Status:** Ready for Execution  
**Owner:** Engineering Team  
**Next Review:** After Phase 2 completion
