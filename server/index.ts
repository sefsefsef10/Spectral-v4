import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { ensureCsrfToken, validateCsrfToken } from "./middleware/csrf";
import { logger } from "./logger";
import { validateSpectralEnv } from "./utils/validate-env";
import { webhookSecretManager } from "./services/webhook-secret-manager";

// Validate environment variables on startup (dev + prod)
validateSpectralEnv();

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

// PostgreSQL session store configuration
const PgSession = connectPgSimple(session);
export const sessionStore = new PgSession({
  conString: process.env.DATABASE_URL,
  tableName: 'session',
  createTableIfMissing: true,
  pruneSessionInterval: 60 * 15, // Cleanup expired sessions every 15 minutes
});

// Session configuration with PostgreSQL store
// Note: SESSION_SECRET is validated by validateSpectralEnv() - no fallback allowed
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: 'strict', // CSRF protection
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  },
  name: 'spectral.sid', // Custom session cookie name
}));

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Disabled to allow Vite dev server in development
  crossOriginEmbedderPolicy: false, // Allow embedding for development
}));

// CSRF protection middleware
app.use(ensureCsrfToken); // Ensure CSRF token exists in session
app.use(validateCsrfToken); // Validate CSRF token on state-changing requests

// Structured HTTP request logging with Pino
app.use(pinoHttp({
  logger: logger,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} ${res.statusCode} - ${err?.message}`;
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      userId: (req.raw as any).session?.userId,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
}));

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

(async () => {
  // 🔒 CRITICAL SECURITY FIX: Fail-closed webhook security
  // Initialize webhook secrets BEFORE accepting any requests
  try {
    await webhookSecretManager.initializeSecrets();
    logger.info("Webhook secrets initialized successfully");
  } catch (error: any) {
    logger.fatal({ err: error }, "CRITICAL: Failed to initialize webhook secrets - refusing to start server");
    logger.fatal("Webhook endpoints would be unauthenticated - this is a HIPAA compliance violation");
    process.exit(1); // Exit immediately - DO NOT start server without webhook security
  }

  // Initialize database indexes (production-critical)
  try {
    const { initializeDatabaseIndexes } = await import("./init-db-indexes");
    await initializeDatabaseIndexes();
  } catch (error: any) {
    logger.error({ err: error }, "Failed to initialize database indexes");
    // Don't exit - allow server to start even if indexes fail
  }

  // Initialize compliance controls catalog and event types taxonomy (Phase 1)
  try {
    const { initializeComplianceCatalog } = await import("./services/initialize-catalog");
    await initializeComplianceCatalog();
  } catch (error: any) {
    logger.warn({ err: error }, "Failed to initialize compliance catalog");
  }

  // Initialize state regulations (Phase 1.4)
  try {
    const { stateLawEngine } = await import("./services/translation-engine/state-law-engine");
    await stateLawEngine.seedStateRegulations();
  } catch (error: any) {
    logger.warn({ err: error }, "Failed to seed state regulations");
    // Don't exit - allow server to start even if catalog initialization fails
  }

  // Initialize clinical validation datasets (Phase 3.2)
  try {
    const { clinicalDatasetLibrary } = await import("./services/clinical-validation/dataset-library");
    await clinicalDatasetLibrary.initializeSampleDatasets();
  } catch (error: any) {
    logger.warn({ err: error }, "Failed to initialize validation datasets");
  }

  // Verify PHI detection service dependencies (Phase 3.1)
  try {
    const { phiDetectionService } = await import("./services/phi-detection");
    // Test that spaCy model is available
    await phiDetectionService.detectPHI("test", { threshold: 0.9 });
    logger.info("PHI detection service initialized successfully");
  } catch (error: any) {
    logger.error({ err: error }, "Failed to initialize PHI detection service - spaCy model may be missing");
    logger.warn("Run: python3 -m spacy download en_core_web_sm");
  }
  
  // Seed database in development
  if (app.get("env") === "development") {
    try {
      const { seedDatabase } = await import("./seed");
      // Check if database is already seeded by trying to get a health system
      const { storage } = await import("./storage");
      const systems = await storage.getAISystems("any-id").catch(() => []);
      if (systems.length === 0) {
        await seedDatabase();
      }
    } catch (error: any) {
      logger.warn({ err: error }, "Error seeding database");
    }
  }

  // Start background job worker loop
  try {
    const { startWorkerLoop, initializeJobHandlers, scheduleRecurringJob } = await import("./services/background-jobs");
    await initializeJobHandlers(); // Register job handlers first
    await startWorkerLoop(30000); // Check every 30 seconds
    logger.info("Background job worker started");
    
    // Schedule hourly predictive alerts for all health systems
    const { storage } = await import("./storage");
    const { db } = await import("./db");
    const { healthSystems } = await import("@shared/schema");
    
    // Get all health systems
    const allHealthSystems = await db.select().from(healthSystems);
    
    // Schedule predictive alerts for each health system
    for (const healthSystem of allHealthSystems) {
      scheduleRecurringJob({
        jobType: "predictive_alerts",
        payload: { healthSystemId: healthSystem.id },
        intervalMs: 60 * 60 * 1000, // 1 hour
      }, `predictive-alerts-${healthSystem.id}`);
    }
    
    logger.info({ healthSystemCount: allHealthSystems.length }, `Scheduled hourly predictive alerts generation for ${allHealthSystems.length} health system(s)`);
    
    // Schedule automated action executor (runs every 5 minutes)
    scheduleRecurringJob({
      jobType: "action_executor",
      payload: {},
      intervalMs: 5 * 60 * 1000, // 5 minutes
    }, "automated-action-executor");
    
    logger.info("Scheduled automated action executor (every 5 minutes)");
  } catch (error: any) {
    logger.error({ err: error }, "Error starting background job worker");
  }

  const server = await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    
    logger.error({ 
      err, 
      method: req.method, 
      url: req.url,
      userId: (req as any).session?.userId 
    }, 'Unhandled error');
    
    const message = process.env.NODE_ENV === 'production'
      ? (status < 500 ? err.message : 'Internal server error')
      : err.message || "Internal Server Error";

    res.status(status).json({ 
      error: message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    logger.info({ port }, `serving on port ${port}`);
  });
})();
