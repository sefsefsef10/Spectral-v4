/**
 * Example Entity Unit Tests
 * 
 * This demonstrates testing patterns for domain entities.
 * Domain tests should be:
 * - Fast (milliseconds)
 * - Isolated (no database, no HTTP)
 * - Comprehensive (90%+ coverage)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ExampleEntity,
  EntityStatus,
  DomainError,
  EntityCreatedEvent,
  EntityActivatedEvent,
  EntityDeactivatedEvent,
  EntityArchivedEvent,
  EntityRenamedEvent
} from '@server/domain/entities/ExampleEntity';

describe('ExampleEntity', () => {
  describe('create', () => {
    it('should create entity with active status', () => {
      const entity = ExampleEntity.create('Test Entity');

      expect(entity.id).toBeDefined();
      expect(entity.name).toBe('Test Entity');
      expect(entity.status).toBe(EntityStatus.ACTIVE);
      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.updatedAt).toBeInstanceOf(Date);
    });

    it('should trim entity name', () => {
      const entity = ExampleEntity.create('  Test Entity  ');

      expect(entity.name).toBe('Test Entity');
    });

    it('should raise EntityCreated event', () => {
      const entity = ExampleEntity.create('Test Entity');

      expect(entity.domainEvents).toHaveLength(1);
      expect(entity.domainEvents[0].eventType).toBe('entity.created');
      expect((entity.domainEvents[0] as EntityCreatedEvent).entityName).toBe('Test Entity');
    });

    it('should throw error for empty name', () => {
      expect(() => ExampleEntity.create('')).toThrow(DomainError);
      expect(() => ExampleEntity.create('')).toThrow('Entity name cannot be empty');
    });

    it('should throw error for whitespace-only name', () => {
      expect(() => ExampleEntity.create('   ')).toThrow(DomainError);
    });

    it('should throw error for name exceeding 100 characters', () => {
      const longName = 'a'.repeat(101);

      expect(() => ExampleEntity.create(longName)).toThrow(DomainError);
      expect(() => ExampleEntity.create(longName)).toThrow('cannot exceed 100 characters');
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute entity from database data', () => {
      const id = 'test-id-123';
      const createdAt = new Date('2025-01-01');
      const updatedAt = new Date('2025-01-02');

      const entity = ExampleEntity.reconstitute(
        id,
        'Test Entity',
        EntityStatus.INACTIVE,
        createdAt,
        updatedAt
      );

      expect(entity.id).toBe(id);
      expect(entity.name).toBe('Test Entity');
      expect(entity.status).toBe(EntityStatus.INACTIVE);
      expect(entity.createdAt).toBe(createdAt);
      expect(entity.updatedAt).toBe(updatedAt);
    });

    it('should not raise events when reconstituting', () => {
      const entity = ExampleEntity.reconstitute(
        'id',
        'Test',
        EntityStatus.ACTIVE,
        new Date(),
        new Date()
      );

      expect(entity.domainEvents).toHaveLength(0);
    });
  });

  describe('activate', () => {
    it('should activate inactive entity', () => {
      const entity = ExampleEntity.reconstitute(
        'id',
        'Test',
        EntityStatus.INACTIVE,
        new Date(),
        new Date()
      );

      entity.activate();

      expect(entity.status).toBe(EntityStatus.ACTIVE);
      expect(entity.isActive()).toBe(true);
    });

    it('should raise EntityActivated event', () => {
      const entity = ExampleEntity.reconstitute(
        'id',
        'Test',
        EntityStatus.INACTIVE,
        new Date(),
        new Date()
      );

      entity.activate();

      expect(entity.domainEvents).toHaveLength(1);
      expect(entity.domainEvents[0].eventType).toBe('entity.activated');
    });

    it('should update updatedAt timestamp', () => {
      const oldDate = new Date('2025-01-01');
      const entity = ExampleEntity.reconstitute(
        'id',
        'Test',
        EntityStatus.INACTIVE,
        oldDate,
        oldDate
      );

      entity.activate();

      expect(entity.updatedAt.getTime()).toBeGreaterThan(oldDate.getTime());
    });

    it('should throw error if already active', () => {
      const entity = ExampleEntity.create('Test');

      expect(() => entity.activate()).toThrow(DomainError);
      expect(() => entity.activate()).toThrow('already active');
    });

    it('should throw error if archived', () => {
      const entity = ExampleEntity.reconstitute(
        'id',
        'Test',
        EntityStatus.ARCHIVED,
        new Date(),
        new Date()
      );

      expect(() => entity.activate()).toThrow(DomainError);
      expect(() => entity.activate()).toThrow('Cannot activate archived entity');
    });
  });

  describe('deactivate', () => {
    it('should deactivate active entity', () => {
      const entity = ExampleEntity.create('Test');
      entity.clearEvents();

      entity.deactivate();

      expect(entity.status).toBe(EntityStatus.INACTIVE);
      expect(entity.isActive()).toBe(false);
    });

    it('should raise EntityDeactivated event', () => {
      const entity = ExampleEntity.create('Test');
      entity.clearEvents();

      entity.deactivate();

      expect(entity.domainEvents).toHaveLength(1);
      expect(entity.domainEvents[0].eventType).toBe('entity.deactivated');
    });

    it('should throw error if already inactive', () => {
      const entity = ExampleEntity.reconstitute(
        'id',
        'Test',
        EntityStatus.INACTIVE,
        new Date(),
        new Date()
      );

      expect(() => entity.deactivate()).toThrow(DomainError);
      expect(() => entity.deactivate()).toThrow('already inactive');
    });

    it('should throw error if archived', () => {
      const entity = ExampleEntity.reconstitute(
        'id',
        'Test',
        EntityStatus.ARCHIVED,
        new Date(),
        new Date()
      );

      expect(() => entity.deactivate()).toThrow(DomainError);
    });
  });

  describe('archive', () => {
    it('should archive active entity', () => {
      const entity = ExampleEntity.create('Test');

      entity.archive();

      expect(entity.status).toBe(EntityStatus.ARCHIVED);
    });

    it('should archive inactive entity', () => {
      const entity = ExampleEntity.reconstitute(
        'id',
        'Test',
        EntityStatus.INACTIVE,
        new Date(),
        new Date()
      );

      entity.archive();

      expect(entity.status).toBe(EntityStatus.ARCHIVED);
    });

    it('should raise EntityArchived event', () => {
      const entity = ExampleEntity.create('Test');
      entity.clearEvents();

      entity.archive();

      expect(entity.domainEvents).toHaveLength(1);
      expect(entity.domainEvents[0].eventType).toBe('entity.archived');
    });

    it('should throw error if already archived', () => {
      const entity = ExampleEntity.reconstitute(
        'id',
        'Test',
        EntityStatus.ARCHIVED,
        new Date(),
        new Date()
      );

      expect(() => entity.archive()).toThrow(DomainError);
      expect(() => entity.archive()).toThrow('already archived');
    });
  });

  describe('rename', () => {
    it('should update name', () => {
      const entity = ExampleEntity.create('Old Name');

      entity.rename('New Name');

      expect(entity.name).toBe('New Name');
    });

    it('should trim new name', () => {
      const entity = ExampleEntity.create('Old Name');

      entity.rename('  New Name  ');

      expect(entity.name).toBe('New Name');
    });

    it('should raise EntityRenamed event with old and new names', () => {
      const entity = ExampleEntity.create('Old Name');
      entity.clearEvents();

      entity.rename('New Name');

      expect(entity.domainEvents).toHaveLength(1);
      expect(entity.domainEvents[0].eventType).toBe('entity.renamed');
      
      const event = entity.domainEvents[0] as EntityRenamedEvent;
      expect(event.oldName).toBe('Old Name');
      expect(event.newName).toBe('New Name');
    });

    it('should throw error for empty name', () => {
      const entity = ExampleEntity.create('Test');

      expect(() => entity.rename('')).toThrow(DomainError);
      expect(() => entity.rename('   ')).toThrow(DomainError);
    });

    it('should throw error for name exceeding 100 characters', () => {
      const entity = ExampleEntity.create('Test');
      const longName = 'a'.repeat(101);

      expect(() => entity.rename(longName)).toThrow(DomainError);
    });

    it('should throw error if archived', () => {
      const entity = ExampleEntity.create('Test');
      entity.archive();

      expect(() => entity.rename('New Name')).toThrow(DomainError);
      expect(() => entity.rename('New Name')).toThrow('Cannot rename archived entity');
    });
  });

  describe('canBeModified', () => {
    it('should return true for active entity', () => {
      const entity = ExampleEntity.create('Test');

      expect(entity.canBeModified()).toBe(true);
    });

    it('should return true for inactive entity', () => {
      const entity = ExampleEntity.reconstitute(
        'id',
        'Test',
        EntityStatus.INACTIVE,
        new Date(),
        new Date()
      );

      expect(entity.canBeModified()).toBe(true);
    });

    it('should return false for archived entity', () => {
      const entity = ExampleEntity.create('Test');
      entity.archive();

      expect(entity.canBeModified()).toBe(false);
    });
  });

  describe('clearEvents', () => {
    it('should clear all domain events', () => {
      const entity = ExampleEntity.create('Test');
      expect(entity.domainEvents).toHaveLength(1);

      entity.clearEvents();

      expect(entity.domainEvents).toHaveLength(0);
    });

    it('should not affect entity state', () => {
      const entity = ExampleEntity.create('Test');
      const name = entity.name;
      const status = entity.status;

      entity.clearEvents();

      expect(entity.name).toBe(name);
      expect(entity.status).toBe(status);
    });
  });
});
