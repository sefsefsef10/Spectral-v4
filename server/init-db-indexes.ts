/**
 * Database Index Initialization
 * 
 * Creates critical performance indexes for production deployment
 * These indexes dramatically improve query performance for:
 * - AI systems filtering by health system
 * - Monitoring alerts filtering by system and status
 * - Compliance mappings reverse lookups
 * - Audit log time-based queries
 * - Telemetry time-series queries
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

export async function initializeDatabaseIndexes(): Promise<void> {
  try {
    logger.info("Creating database indexes...");
    
    // AI Systems: Index for filtering by health system
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ai_systems_health_system ON ai_systems (health_system_id)`);
    
    // Monitoring Alerts: Composite index for finding unresolved alerts by AI system
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_system_resolved ON monitoring_alerts (ai_system_id, resolved)`);
    
    // Audit Logs: Index for time-based compliance queries
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC)`);
    
    // Compliance Mappings: Index for reverse lookups from controls to systems
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_compliance_mappings_control ON compliance_mappings (control_id)`);
    
    // AI Telemetry: Index for time-based telemetry queries
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ai_telemetry_created_at ON ai_telemetry_events (created_at DESC)`);
    
    // AI Telemetry: Composite index for system-specific time-series queries
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ai_telemetry_system_time ON ai_telemetry_events (ai_system_id, created_at DESC)`);
    
    logger.info("Database indexes created successfully");
  } catch (error) {
    logger.error({ err: error }, "Failed to create database indexes");
    throw error;
  }
}
