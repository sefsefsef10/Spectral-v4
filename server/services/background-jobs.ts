/**
 * Background Job Processor
 * 
 * Lightweight async job system for:
 * - Certification workflows
 * - Scheduled compliance checks
 * - Report generation
 * - Email notifications
 * 
 * PRODUCTION DEPLOYMENT WARNING:
 * - Set ENABLE_BACKGROUND_WORKERS=true on ONLY ONE server instance
 * - Or configure Redis for distributed locking across multiple workers
 * - Without this, multiple servers will execute duplicate jobs
 * 
 * This is MVP-appropriate and can be replaced with Inngest later if needed.
 */

import { storage } from "../storage";
import type { BackgroundJob } from "@shared/schema";
import { CacheService } from "../cache";
import { logger } from "../logger";

export type JobType = "certification_workflow" | "compliance_check" | "report_generation" | "email_notification" | "predictive_alerts" | "action_executor";

export interface JobPayload {
  [key: string]: any;
}

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Job registry - maps job types to their handler functions
 */
type JobHandler = (payload: JobPayload) => Promise<JobResult>;
const jobHandlers = new Map<JobType, JobHandler>();

/**
 * Register a job handler
 */
export function registerJobHandler(jobType: JobType, handler: JobHandler) {
  jobHandlers.set(jobType, handler);
  logger.info({ jobType }, `Registered job handler: ${jobType}`);
}

/**
 * Create and enqueue a background job
 */
export async function enqueueJob(jobType: JobType, payload: JobPayload): Promise<BackgroundJob> {
  const job = await storage.createBackgroundJob({
    jobType,
    status: "pending",
    payload: JSON.stringify(payload),
  });
  
  logger.info({ jobId: job.id, jobType }, `Enqueued job ${job.id} (${jobType})`);
  
  // Process async (don't await)
  processJob(job.id).catch(err => {
    logger.error({ jobId: job.id, err }, `Error processing job ${job.id}`);
  });
  
  return job;
}

/**
 * Acquire distributed lock for job processing
 * Uses Redis SETNX for atomic lock acquisition across multiple server instances
 */
async function acquireLock(lockKey: string, ttlSeconds: number = 300): Promise<boolean> {
  // Try to set lock with TTL (returns true if lock acquired, false if already exists)
  const lockValue = `lock-${Date.now()}`;
  const acquired = await CacheService.setNX(lockKey, lockValue, ttlSeconds);
  
  return acquired;
}

/**
 * Release distributed lock
 */
async function releaseLock(lockKey: string): Promise<void> {
  await CacheService.del(lockKey);
}

/**
 * Process a single job
 */
async function processJob(jobId: string): Promise<void> {
  const job = await storage.getBackgroundJob(jobId);
  if (!job) {
    logger.error({ jobId }, `Job ${jobId} not found`);
    return;
  }
  
  // Skip if already running or completed
  if (job.status !== "pending") {
    logger.debug({ jobId, status: job.status }, `Job ${jobId} already ${job.status}, skipping`);
    return;
  }
  
  // Try to acquire distributed lock (prevents duplicate processing across instances)
  const lockKey = `job-lock:${jobId}`;
  const lockAcquired = await acquireLock(lockKey, 300); // 5 min TTL
  
  if (!lockAcquired) {
    logger.debug({ jobId }, `Job ${jobId} already locked by another worker, skipping`);
    return;
  }
  
  try {
    // Mark as running
    await storage.updateBackgroundJobStatus(jobId, "running", new Date());
    
    logger.info({ jobId, jobType: job.jobType }, `Processing job ${jobId} (${job.jobType})`);
    
    // Get handler
    const handler = jobHandlers.get(job.jobType as JobType);
    if (!handler) {
      throw new Error(`No handler registered for job type: ${job.jobType}`);
    }
    
    // Parse payload
    const payload: JobPayload = JSON.parse(job.payload);
    
    // Execute handler
    const result = await handler(payload);
    
    if (result.success) {
      await storage.completeBackgroundJob(jobId, JSON.stringify(result.data), new Date());
      logger.info({ jobId }, `Completed job ${jobId}`);
    } else {
      throw new Error(result.error || "Job failed");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await storage.failBackgroundJob(jobId, errorMessage, new Date());
    logger.error({ jobId, err: error }, `Failed job ${jobId}: ${errorMessage}`);
  } finally {
    // Always release the lock
    await releaseLock(lockKey);
  }
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string): Promise<BackgroundJob | null> {
  const job = await storage.getBackgroundJob(jobId);
  return job ?? null;
}

/**
 * Get all jobs of a specific type
 */
export async function getJobsByType(jobType: JobType): Promise<BackgroundJob[]> {
  return storage.getBackgroundJobsByType(jobType);
}

/**
 * Retry a failed job
 */
export async function retryJob(jobId: string): Promise<void> {
  await storage.updateBackgroundJobStatus(jobId, "pending");
  
  // Process async
  processJob(jobId).catch(err => {
    logger.error({ jobId, err }, `Error retrying job ${jobId}`);
  });
}

/**
 * Worker loop - processes pending jobs from database
 * This ensures jobs are picked up even after server restarts
 * 
 * PRODUCTION: Set ENABLE_BACKGROUND_WORKERS=true on only ONE server instance
 */
let workerLoopRunning = false;

export async function startWorkerLoop(intervalMs: number = 10000): Promise<void> {
  // Check if background workers are enabled via environment variable
  const workersEnabled = process.env.ENABLE_BACKGROUND_WORKERS === 'true' || process.env.NODE_ENV === 'development';
  
  if (!workersEnabled) {
    logger.info('Background workers disabled (set ENABLE_BACKGROUND_WORKERS=true to enable)');
    return;
  }
  
  if (workerLoopRunning) {
    logger.warn("Worker loop already running");
    return;
  }
  
  workerLoopRunning = true;
  logger.info({ intervalMs }, `Starting background job worker loop (${intervalMs}ms interval)`);
  
  const processNextBatch = async () => {
    try {
      // Get all pending jobs
      const pendingJobs = await storage.getPendingBackgroundJobs();
      
      if (pendingJobs.length > 0) {
        logger.info({ count: pendingJobs.length }, `Processing ${pendingJobs.length} pending job(s)`);
        
        // Process each job (sequentially to avoid overload)
        for (const job of pendingJobs) {
          await processJob(job.id);
        }
      }
    } catch (error) {
      logger.error({ err: error }, "Worker loop error");
    }
    
    // Schedule next batch
    if (workerLoopRunning) {
      setTimeout(processNextBatch, intervalMs);
    }
  };
  
  // Start the loop
  processNextBatch();
}

export function stopWorkerLoop(): void {
  workerLoopRunning = false;
  logger.info("Stopped background job worker loop");
}

/**
 * Schedule a recurring job (simple cron-like scheduler)
 */
export interface JobSchedule {
  jobType: JobType;
  payload: JobPayload;
  intervalMs: number; // How often to run (in milliseconds)
}

const scheduledJobs = new Map<string, NodeJS.Timeout>();

export function scheduleRecurringJob(schedule: JobSchedule, scheduleId: string): void {
  // Check if background workers are enabled via environment variable
  const workersEnabled = process.env.ENABLE_BACKGROUND_WORKERS === 'true' || process.env.NODE_ENV === 'development';
  
  if (!workersEnabled) {
    logger.info({ scheduleId }, `Skipping scheduled job ${scheduleId} (background workers disabled)`);
    return;
  }
  
  // Clear existing schedule if any
  if (scheduledJobs.has(scheduleId)) {
    clearInterval(scheduledJobs.get(scheduleId)!);
  }
  
  logger.info({ scheduleId, jobType: schedule.jobType, intervalMs: schedule.intervalMs }, `Scheduled recurring job: ${scheduleId}`);
  
  // Create recurring job
  const intervalId = setInterval(async () => {
    logger.info({ scheduleId }, `Triggering scheduled job: ${scheduleId}`);
    await enqueueJob(schedule.jobType, schedule.payload);
  }, schedule.intervalMs);
  
  scheduledJobs.set(scheduleId, intervalId);
}

export function cancelScheduledJob(scheduleId: string): void {
  if (scheduledJobs.has(scheduleId)) {
    clearInterval(scheduledJobs.get(scheduleId)!);
    scheduledJobs.delete(scheduleId);
    logger.info({ scheduleId }, `Cancelled scheduled job: ${scheduleId}`);
  }
}

/**
 * Initialize default job handlers
 */
export async function initializeJobHandlers(): Promise<void> {
  // Register certification processor
  const { processCertificationApplication } = await import("./certification-processor");
  
  registerJobHandler("certification_workflow", async (payload: JobPayload) => {
    const result = await processCertificationApplication(payload.applicationId);
    // Always return success=true to complete job cleanly
    // Application status and result payload encode actual pass/fail
    return { success: true, data: result };
  });
  
  // Register predictive alerts generator
  const { predictiveAlertService } = await import("./predictive-alert-service");
  
  registerJobHandler("predictive_alerts", async (payload: JobPayload) => {
    const healthSystemId = payload.healthSystemId;
    const alertsGenerated = await predictiveAlertService.generatePredictiveAlertsForHealthSystem(healthSystemId);
    return { 
      success: true, 
      data: { 
        healthSystemId, 
        alertsGenerated,
        timestamp: new Date().toISOString()
      } 
    };
  });
  
  // Register automated action executor
  const { actionExecutor } = await import("./action-executor");
  
  registerJobHandler("action_executor", async (payload: JobPayload) => {
    const result = await actionExecutor.processPendingActions();
    return {
      success: true,
      data: {
        executed: result.executed,
        failed: result.failed,
        timestamp: new Date().toISOString()
      }
    };
  });
  
  logger.info("Job handlers initialized");
}
