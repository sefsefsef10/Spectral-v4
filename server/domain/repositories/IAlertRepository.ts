/**
 * DOMAIN LAYER: Alert Repository Interface
 * 
 * Centralized repository interface for Alert entity persistence.
 * Implements Repository pattern with dependency inversion principle.
 */

import { Alert } from '../entities/Alert';

export interface IAlertRepository {
  /**
   * Persist alert
   */
  save(alert: Alert): Promise<void>;

  /**
   * Find alert by unique identifier
   */
  findById(id: string): Promise<Alert | null>;

  /**
   * Find all alerts for an AI system
   */
  findByAiSystemId(aiSystemId: string): Promise<Alert[]>;

  /**
   * Find alert by deduplication key within time window
   * @param key - Deduplication key (aiSystemId + type + severity)
   * @param withinHours - Time window in hours for duplicate detection
   */
  findByDeduplicationKey(key: string, withinHours: number): Promise<Alert | null>;

  /**
   * Find duplicate alerts (legacy method for backward compatibility)
   */
  findDuplicates(alert: Alert): Promise<Alert[]>;

  /**
   * Check if alert exists by ID
   */
  exists(id: string): Promise<boolean>;
}
