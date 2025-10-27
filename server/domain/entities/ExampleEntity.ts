/**
 * Example Domain Entity Template
 * 
 * This template demonstrates Clean Architecture domain entity patterns.
 * Copy this template when creating new entities.
 * 
 * Key Concepts:
 * - Private constructor (use factory methods: create, reconstitute)
 * - Business logic in methods (not in services)
 * - Value objects for domain concepts
 * - Domain events for state changes
 * - Validation enforced at all times
 */

import { DomainEvent } from '../events/DomainEvent';

// Value Object for Status
export enum EntityStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived'
}

// Main Domain Entity
export class ExampleEntity {
  private readonly _domainEvents: DomainEvent[] = [];

  private constructor(
    private readonly _id: string,
    private _name: string,
    private _status: EntityStatus,
    private _createdAt: Date,
    private _updatedAt: Date
  ) {
    this.validate();
  }

  // Factory method for creating NEW entities
  static create(name: string): ExampleEntity {
    if (!name || name.trim().length === 0) {
      throw new DomainError('Entity name cannot be empty');
    }

    if (name.length > 100) {
      throw new DomainError('Entity name cannot exceed 100 characters');
    }

    const now = new Date();
    const entity = new ExampleEntity(
      generateId(),
      name.trim(),
      EntityStatus.ACTIVE,
      now,
      now
    );

    // Raise domain event
    entity.raiseEvent(new EntityCreatedEvent(entity._id, entity._name));

    return entity;
  }

  // Factory method for RECONSTITUTING entities from database
  static reconstitute(
    id: string,
    name: string,
    status: EntityStatus,
    createdAt: Date,
    updatedAt: Date
  ): ExampleEntity {
    return new ExampleEntity(id, name, status, createdAt, updatedAt);
  }

  // Getters (read-only access to private fields)
  get id(): string { return this._id; }
  get name(): string { return this._name; }
  get status(): EntityStatus { return this._status; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get domainEvents(): DomainEvent[] { return [...this._domainEvents]; }

  // Business Logic Methods

  activate(): void {
    if (this._status === EntityStatus.ACTIVE) {
      throw new DomainError('Entity is already active');
    }

    if (this._status === EntityStatus.ARCHIVED) {
      throw new DomainError('Cannot activate archived entity');
    }

    this._status = EntityStatus.ACTIVE;
    this._updatedAt = new Date();
    this.raiseEvent(new EntityActivatedEvent(this._id));
  }

  deactivate(): void {
    if (this._status === EntityStatus.INACTIVE) {
      throw new DomainError('Entity is already inactive');
    }

    if (this._status === EntityStatus.ARCHIVED) {
      throw new DomainError('Cannot deactivate archived entity');
    }

    this._status = EntityStatus.INACTIVE;
    this._updatedAt = new Date();
    this.raiseEvent(new EntityDeactivatedEvent(this._id));
  }

  archive(): void {
    if (this._status === EntityStatus.ARCHIVED) {
      throw new DomainError('Entity is already archived');
    }

    this._status = EntityStatus.ARCHIVED;
    this._updatedAt = new Date();
    this.raiseEvent(new EntityArchivedEvent(this._id));
  }

  rename(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new DomainError('Entity name cannot be empty');
    }

    if (newName.length > 100) {
      throw new DomainError('Entity name cannot exceed 100 characters');
    }

    if (this._status === EntityStatus.ARCHIVED) {
      throw new DomainError('Cannot rename archived entity');
    }

    const oldName = this._name;
    this._name = newName.trim();
    this._updatedAt = new Date();
    this.raiseEvent(new EntityRenamedEvent(this._id, oldName, this._name));
  }

  // Query methods (domain logic for answering questions)

  canBeModified(): boolean {
    return this._status !== EntityStatus.ARCHIVED;
  }

  isActive(): boolean {
    return this._status === EntityStatus.ACTIVE;
  }

  // Domain Event Management

  private raiseEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  clearEvents(): void {
    this._domainEvents.length = 0;
  }

  // Validation (enforce invariants)

  private validate(): void {
    if (!this._id) {
      throw new DomainError('Entity ID is required');
    }

    if (!this._name || this._name.trim().length === 0) {
      throw new DomainError('Entity name cannot be empty');
    }

    if (!Object.values(EntityStatus).includes(this._status)) {
      throw new DomainError(`Invalid status: ${this._status}`);
    }
  }
}

// Domain Events

export class EntityCreatedEvent implements DomainEvent {
  readonly occurredAt: Date = new Date();
  readonly eventType = 'entity.created' as const;

  constructor(
    readonly entityId: string,
    readonly entityName: string
  ) {}
}

export class EntityActivatedEvent implements DomainEvent {
  readonly occurredAt: Date = new Date();
  readonly eventType = 'entity.activated' as const;

  constructor(readonly entityId: string) {}
}

export class EntityDeactivatedEvent implements DomainEvent {
  readonly occurredAt: Date = new Date();
  readonly eventType = 'entity.deactivated' as const;

  constructor(readonly entityId: string) {}
}

export class EntityArchivedEvent implements DomainEvent {
  readonly occurredAt: Date = new Date();
  readonly eventType = 'entity.archived' as const;

  constructor(readonly entityId: string) {}
}

export class EntityRenamedEvent implements DomainEvent {
  readonly occurredAt: Date = new Date();
  readonly eventType = 'entity.renamed' as const;

  constructor(
    readonly entityId: string,
    readonly oldName: string,
    readonly newName: string
  ) {}
}

// Custom Domain Error

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

// Helper function for ID generation

function generateId(): string {
  return crypto.randomUUID();
}
