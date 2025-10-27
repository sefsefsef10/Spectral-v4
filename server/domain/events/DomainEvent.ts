/**
 * Domain Event Base Interface
 * 
 * All domain events must implement this interface.
 * Domain events represent something important that happened in the domain.
 */

export interface DomainEvent {
  /**
   * Unique identifier for the event type
   * Use dot notation: entity.action (e.g., "user.created", "order.approved")
   */
  readonly eventType: string;

  /**
   * When this event occurred
   */
  readonly occurredAt: Date;
}
