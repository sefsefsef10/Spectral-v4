# Domain Repositories

Repository interfaces belong in the domain layer. They define how to store and retrieve domain entities WITHOUT specifying implementation details.

## Characteristics

✅ **Interface-Only:** Domain defines interface, infrastructure implements  
✅ **Entity-Focused:** Work with domain entities, not database models  
✅ **Collection-Like:** Think of repositories as in-memory collections  
✅ **Query Methods:** Finder methods return entities or null  
✅ **No SQL:** No database concerns in interfaces

## Example Template

```typescript
import { ExampleEntity } from '../entities/ExampleEntity';

export interface ExampleEntityRepository {
  /**
   * Find entity by unique ID
   * Returns null if not found
   */
  findById(id: string): Promise<ExampleEntity | null>;

  /**
   * Find all active entities
   */
  findAllActive(): Promise<ExampleEntity[]>;

  /**
   * Find entities by name (partial match)
   */
  findByName(name: string): Promise<ExampleEntity[]>;

  /**
   * Save entity (create or update)
   * Returns saved entity with updated timestamp
   */
  save(entity: ExampleEntity): Promise<ExampleEntity>;

  /**
   * Delete entity by ID
   * Returns true if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;

  /**
   * Check if entity exists
   */
  exists(id: string): Promise<boolean>;
}
```

## Guidelines

**DO:**
- Define interfaces in domain layer
- Work with domain entities, not database models
- Use clear, intention-revealing method names
- Return domain entities or null (no undefined)
- Document expected behavior

**DON'T:**
- Include implementation details
- Expose database types (no Drizzle types in interface)
- Use generic CRUD methods only (add domain-specific finders)
- Return database results directly

## Implementation Pattern

Domain interface:
```typescript
// server/domain/repositories/PaymentRepository.ts
export interface PaymentRepository {
  findById(id: string): Promise<Payment | null>;
  findByCustomerId(customerId: string): Promise<Payment[]>;
  save(payment: Payment): Promise<Payment>;
}
```

Infrastructure implementation:
```typescript
// server/infrastructure/repositories/DrizzlePaymentRepository.ts
import { PaymentRepository } from '@server/domain/repositories/PaymentRepository';
import { Payment } from '@server/domain/entities/Payment';

export class DrizzlePaymentRepository implements PaymentRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Payment | null> {
    const row = await this.db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, id))
      .limit(1);

    if (!row[0]) return null;

    // Map database row to domain entity
    return Payment.reconstitute(
      row[0].id,
      row[0].customerId,
      row[0].amount,
      row[0].status as PaymentStatus,
      row[0].createdAt,
      row[0].updatedAt
    );
  }

  async save(payment: Payment): Promise<Payment> {
    // Map entity to database model
    await this.db
      .insert(paymentsTable)
      .values({
        id: payment.id,
        customerId: payment.customerId,
        amount: payment.amount,
        status: payment.status,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: paymentsTable.id,
        set: {
          status: payment.status,
          updatedAt: new Date()
        }
      });

    return payment;
  }
}
```

## Testing

**Domain Interface:** No tests needed (it's just a TypeScript interface)

**Infrastructure Implementation:** Test with real database or in-memory implementation:

```typescript
describe('DrizzlePaymentRepository', () => {
  let repository: DrizzlePaymentRepository;
  let testDb: Database;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    repository = new DrizzlePaymentRepository(testDb);
  });

  afterEach(async () => {
    await cleanupTestDatabase(testDb);
  });

  it('should find payment by ID', async () => {
    const payment = Payment.create(/* ... */);
    await repository.save(payment);

    const found = await repository.findById(payment.id);

    expect(found).toBeDefined();
    expect(found!.id).toBe(payment.id);
  });

  it('should return null for non-existent ID', async () => {
    const found = await repository.findById('non-existent');

    expect(found).toBeNull();
  });
});
```

## Dependency Injection

Use constructor injection in use cases:

```typescript
export class ProcessPaymentUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepository,  // Interface, not implementation
    private readonly logger: Logger
  ) {}

  async execute(request: ProcessPaymentRequest): Promise<ProcessPaymentResponse> {
    const payment = await this.paymentRepository.findById(request.paymentId);
    // ...
  }
}
```

Wire up dependencies in routes or DI container:

```typescript
// server/routes.ts (or dependency injection container)
const paymentRepository = new DrizzlePaymentRepository(db);
const processPaymentUseCase = new ProcessPaymentUseCase(paymentRepository, logger);

router.post('/payments/:id/process', async (req, res) => {
  const result = await processPaymentUseCase.execute({
    paymentId: req.params.id,
    amount: req.body.amount
  });
  res.json(result);
});
```
