# Application Layer - Use Cases

The Application Layer orchestrates business workflows by coordinating domain entities, repositories, and external services. Use cases are the entry points for all business operations.

## Characteristics

✅ **Single Responsibility:** One use case = one business operation  
✅ **Framework Agnostic:** No HTTP, no database code  
✅ **Orchestrates Domain:** Coordinates entities, repositories, gateways  
✅ **Transactional:** Manages transaction boundaries  
✅ **DTO-Based:** Input/Output using plain TypeScript types

## Example Template

See example templates in each subdirectory for use case patterns.

## Structure

```typescript
interface UseCase<Request, Response> {
  execute(request: Request): Promise<Response>;
}
```

## Guidelines

**DO:**
- Keep use cases focused on single operations
- Use DTOs for request/response (no domain entities exposed)
- Inject dependencies via constructor
- Handle errors and return meaningful responses
- Log important operations for audit trail

**DON'T:**
- Put business logic in use cases (belongs in entities)
- Access database directly (use repositories)
- Handle HTTP concerns (belongs in controllers)
- Share state between executions (stateless)

## Example Use Case

```typescript
export class ProcessPaymentUseCase implements UseCase<ProcessPaymentRequest, ProcessPaymentResponse> {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly stripeGateway: StripeGateway,
    private readonly logger: Logger
  ) {}

  async execute(request: ProcessPaymentRequest): Promise<ProcessPaymentResponse> {
    // 1. Validate input
    if (!request.amount || request.amount <= 0) {
      return { success: false, error: 'Invalid amount' };
    }

    // 2. Load domain entity
    const payment = await this.paymentRepository.findById(request.paymentId);
    if (!payment) {
      return { success: false, error: 'Payment not found' };
    }

    // 3. Execute business logic
    try {
      payment.process(request.amount);
    } catch (error) {
      return { success: false, error: error.message };
    }

    // 4. Call external service
    const stripeResult = await this.stripeGateway.charge({
      amount: request.amount,
      customerId: payment.customerId
    });

    if (!stripeResult.success) {
      payment.fail();
      await this.paymentRepository.save(payment);
      return { success: false, error: 'Payment failed' };
    }

    // 5. Save state
    payment.markSuccessful(stripeResult.transactionId);
    await this.paymentRepository.save(payment);

    // 6. Log and return
    this.logger.info('Payment processed', { paymentId: payment.id });
    
    return {
      success: true,
      paymentId: payment.id,
      transactionId: stripeResult.transactionId
    };
  }
}
```

## Testing

Use cases should have 80%+ test coverage with mocked dependencies:

```typescript
describe('ProcessPaymentUseCase', () => {
  let useCase: ProcessPaymentUseCase;
  let mockRepository: MockPaymentRepository;
  let mockGateway: MockStripeGateway;

  beforeEach(() => {
    mockRepository = new MockPaymentRepository();
    mockGateway = new MockStripeGateway();
    useCase = new ProcessPaymentUseCase(mockRepository, mockGateway, mockLogger);
  });

  it('should process payment successfully', async () => {
    const payment = Payment.create(/* ... */);
    mockRepository.findById.mockResolvedValue(payment);
    mockGateway.charge.mockResolvedValue({ success: true, transactionId: '123' });

    const result = await useCase.execute({ paymentId: '1', amount: 100 });

    expect(result.success).toBe(true);
    expect(result.transactionId).toBe('123');
  });
});
```

## Directory Structure

```
application/
├── billing/
│   ├── ProcessPaymentUseCase.ts
│   ├── RefundPaymentUseCase.ts
│   └── dtos/
│       ├── ProcessPaymentRequest.ts
│       └── ProcessPaymentResponse.ts
├── certifications/
│   └── ProcessCertificationUseCase.ts
└── policies/
    └── EnforcePolicyUseCase.ts
```
