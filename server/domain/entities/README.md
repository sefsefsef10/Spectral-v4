# Domain Entities

Domain entities are the heart of Clean Architecture. They encapsulate business logic and enforce business rules.

## Characteristics

✅ **Has Identity:** Every entity has a unique ID that persists across time  
✅ **Contains Behavior:** Methods that enforce business rules and state transitions  
✅ **Validates State:** Cannot be created in invalid state  
✅ **Raises Events:** Publishes domain events when important things happen  
✅ **Framework-Agnostic:** No dependencies on database, HTTP, or frameworks

## Example Template

See `ExampleEntity.ts` for a complete template showing:
- Private constructor with factory methods
- Business logic encapsulation
- Domain events
- State validation
- Value objects

## Guidelines

**DO:**
- Keep entities focused on single business concept
- Use value objects for domain concepts (Money, Email, etc.)
- Raise domain events for important state changes
- Validate state in constructor and methods

**DON'T:**
- Put infrastructure code in entities (no database calls, no HTTP)
- Expose setters (use meaningful methods like `approve()`, `reject()`)
- Return database types (return domain entities and value objects)
- Skip validation (always validate business rules)

## Testing

Entities should have 90%+ test coverage. They're pure logic with no dependencies, so tests are fast and reliable.

See `tests/unit/domain/entities/ExampleEntity.test.ts` for testing patterns.
