# Quick Start: Clean Architecture Refactoring
## Get Started in 30 Minutes

This guide gets you from "assessment complete" to "first test passing" in 30 minutes.

---

## Step 1: Install Testing Framework (5 minutes)

```bash
# Install testing dependencies
npm install -D vitest @vitest/ui c8
npm install -D @testing-library/react @testing-library/jest-dom
npm install -D supertest @types/supertest

# Update package.json scripts
npm pkg set scripts.test="vitest"
npm pkg set scripts.test:coverage="vitest --coverage"
npm pkg set scripts.test:ui="vitest --ui"
```

---

## Step 2: Configure Vitest (5 minutes)

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        'shared/schema.ts', // Database schema
        'server/db.ts' // Database config
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
      '@server': path.resolve(__dirname, './server')
    }
  }
});
```

Create `tests/setup.ts`:

```typescript
import { beforeAll, afterAll, beforeEach } from 'vitest';

// Test database setup (if needed)
beforeAll(async () => {
  // Initialize test database
});

afterAll(async () => {
  // Clean up test database
});

beforeEach(() => {
  // Reset mocks before each test
});
```

---

## Step 3: Create Directory Structure (5 minutes)

```bash
# Create new Clean Architecture layers
mkdir -p server/domain/entities
mkdir -p server/domain/value-objects
mkdir -p server/domain/repositories
mkdir -p server/domain/services
mkdir -p server/domain/events

mkdir -p server/application/billing
mkdir -p server/application/certifications
mkdir -p server/application/policies
mkdir -p server/application/ai-systems

mkdir -p server/infrastructure/repositories
mkdir -p server/infrastructure/gateways
mkdir -p server/infrastructure/encryption
mkdir -p server/infrastructure/persistence

mkdir -p tests/unit/domain/entities
mkdir -p tests/unit/domain/value-objects
mkdir -p tests/integration/application
mkdir -p tests/e2e

mkdir -p ADRs
```

---

## Step 4: Write First Test (10 minutes)

Create `tests/integration/health-check.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '@server/index';

describe('Health Check (Smoke Test)', () => {
  it('should respond with 200 OK', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
  });
  
  it('should return system status', async () => {
    const response = await request(app).get('/api/health');
    expect(response.body).toHaveProperty('status', 'ok');
  });
});
```

Run the test:

```bash
npm test
```

✅ **Success!** If this passes, you have a working testing framework.

---

## Step 5: Document First Decision (5 minutes)

Create `ADRs/001-adopt-clean-architecture.md`:

```markdown
# ADR 001: Adopt Clean Architecture for Backend

**Date:** 2025-10-27  
**Status:** Accepted  
**Deciders:** Engineering Team

## Context

Current codebase has:
- 0% test coverage
- Business logic scattered across 56+ service files
- Tight coupling between layers
- Difficult to test and maintain

## Decision

We will adopt Clean Architecture using incremental vertical-slice refactoring:

1. **Domain Layer:** Business entities with behavior
2. **Application Layer:** Use cases orchestrating workflows
3. **Infrastructure Layer:** Repositories and gateways
4. **Framework Layer:** Thin controllers

## Consequences

**Positive:**
- Testable business logic
- Clear separation of concerns
- Easier to onboard new developers
- Faster feature development long-term

**Negative:**
- 5 months of refactoring time
- Temporary parallel implementations
- Learning curve for team

## Implementation

Starting with Certification flow as pilot (Weeks 3-4).
See docs/CLEAN_ARCHITECTURE_ROADMAP.md for full plan.
```

---

## Step 6: Create Example Templates (bonus)

Create `server/domain/entities/ExampleEntity.ts`:

```typescript
/**
 * Example Domain Entity
 * 
 * Domain entities encapsulate business logic and enforce invariants.
 * They are the heart of Clean Architecture.
 * 
 * Characteristics:
 * - Has identity (ID field)
 * - Contains business rules (methods like canApprove(), deploy(), etc.)
 * - Validates state changes
 * - Raises domain events
 * - Framework-agnostic (no database, no HTTP)
 */

export class ExampleEntity {
  private constructor(
    private readonly _id: string,
    private _name: string,
    private _status: EntityStatus,
    private _events: DomainEvent[] = []
  ) {
    // Constructor is private - use static factory methods
  }
  
  // Factory method for creating new instances
  static create(name: string): ExampleEntity {
    if (!name || name.trim().length === 0) {
      throw new DomainError('Name cannot be empty');
    }
    
    const entity = new ExampleEntity(
      generateId(),
      name,
      EntityStatus.ACTIVE
    );
    
    entity.raiseEvent(new EntityCreatedEvent(entity._id));
    return entity;
  }
  
  // Factory method for reconstituting from database
  static reconstitute(
    id: string,
    name: string,
    status: EntityStatus
  ): ExampleEntity {
    return new ExampleEntity(id, name, status);
  }
  
  // Getters (read-only access)
  get id(): string { return this._id; }
  get name(): string { return this._name; }
  get status(): EntityStatus { return this._status; }
  get domainEvents(): DomainEvent[] { return this._events; }
  
  // Business logic methods
  activate(): void {
    if (this._status === EntityStatus.ACTIVE) {
      throw new DomainError('Entity is already active');
    }
    
    this._status = EntityStatus.ACTIVE;
    this.raiseEvent(new EntityActivatedEvent(this._id));
  }
  
  deactivate(): void {
    if (this._status === EntityStatus.INACTIVE) {
      throw new DomainError('Entity is already inactive');
    }
    
    this._status = EntityStatus.INACTIVE;
    this.raiseEvent(new EntityDeactivatedEvent(this._id));
  }
  
  rename(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new DomainError('Name cannot be empty');
    }
    
    const oldName = this._name;
    this._name = newName;
    this.raiseEvent(new EntityRenamedEvent(this._id, oldName, newName));
  }
  
  // Domain event handling
  private raiseEvent(event: DomainEvent): void {
    this._events.push(event);
  }
  
  clearEvents(): void {
    this._events = [];
  }
}

// Value object for status
export enum EntityStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive'
}

// Domain events
export class EntityCreatedEvent {
  readonly type = 'EntityCreated';
  constructor(readonly entityId: string) {}
}

export class EntityActivatedEvent {
  readonly type = 'EntityActivated';
  constructor(readonly entityId: string) {}
}

export class EntityDeactivatedEvent {
  readonly type = 'EntityDeactivated';
  constructor(readonly entityId: string) {}
}

export class EntityRenamedEvent {
  readonly type = 'EntityRenamed';
  constructor(
    readonly entityId: string,
    readonly oldName: string,
    readonly newName: string
  ) {}
}

// Custom error
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

// ID generator helper
function generateId(): string {
  return crypto.randomUUID();
}

type DomainEvent = 
  | EntityCreatedEvent 
  | EntityActivatedEvent 
  | EntityDeactivatedEvent 
  | EntityRenamedEvent;
```

Create corresponding test `tests/unit/domain/entities/ExampleEntity.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { 
  ExampleEntity, 
  EntityStatus, 
  DomainError 
} from '@server/domain/entities/ExampleEntity';

describe('ExampleEntity', () => {
  describe('create', () => {
    it('should create entity with active status', () => {
      const entity = ExampleEntity.create('Test Entity');
      
      expect(entity.id).toBeDefined();
      expect(entity.name).toBe('Test Entity');
      expect(entity.status).toBe(EntityStatus.ACTIVE);
    });
    
    it('should raise EntityCreated event', () => {
      const entity = ExampleEntity.create('Test Entity');
      
      expect(entity.domainEvents).toHaveLength(1);
      expect(entity.domainEvents[0].type).toBe('EntityCreated');
    });
    
    it('should throw error for empty name', () => {
      expect(() => ExampleEntity.create('')).toThrow(DomainError);
      expect(() => ExampleEntity.create('   ')).toThrow(DomainError);
    });
  });
  
  describe('activate', () => {
    it('should activate inactive entity', () => {
      const entity = ExampleEntity.reconstitute(
        'id-1',
        'Test',
        EntityStatus.INACTIVE
      );
      
      entity.activate();
      
      expect(entity.status).toBe(EntityStatus.ACTIVE);
    });
    
    it('should throw error if already active', () => {
      const entity = ExampleEntity.create('Test');
      
      expect(() => entity.activate()).toThrow(DomainError);
    });
  });
  
  describe('rename', () => {
    it('should update name and raise event', () => {
      const entity = ExampleEntity.create('Old Name');
      entity.clearEvents(); // Clear creation event
      
      entity.rename('New Name');
      
      expect(entity.name).toBe('New Name');
      expect(entity.domainEvents).toHaveLength(1);
      expect(entity.domainEvents[0].type).toBe('EntityRenamed');
    });
    
    it('should throw error for invalid name', () => {
      const entity = ExampleEntity.create('Test');
      
      expect(() => entity.rename('')).toThrow(DomainError);
    });
  });
});
```

---

## ✅ You're Ready!

You now have:
- ✅ Testing framework configured
- ✅ First test passing
- ✅ Directory structure created
- ✅ First ADR documented
- ✅ Example templates for team

**Next Steps:**

1. **Share with team** - Show them this setup
2. **Choose pilot feature** - Recommend: Certification flow
3. **Write characterization tests** - Lock existing behavior
4. **Start refactoring** - Follow roadmap Phase 2

---

## Troubleshooting

### Tests won't run
```bash
# Check Vitest is installed
npm list vitest

# Re-install if needed
npm install -D vitest
```

### Import errors in tests
- Make sure path aliases are configured in vitest.config.ts
- Check tsconfig.json has same aliases

### Database connection errors in tests
- Create separate test database
- Use in-memory database for unit tests
- Mock database calls in integration tests

---

## Useful Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui

# Run specific test file
npm test health-check.test.ts

# Run tests matching pattern
npm test -- --grep "Entity"
```

---

**Ready to start?** Proceed to Week 2 of the roadmap!
