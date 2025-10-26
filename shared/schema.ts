import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerificationToken: text("email_verification_token"), // Token for email verification
  emailVerificationTokenExpiry: timestamp("email_verification_token_expiry"), // Token expiration
  passwordResetToken: text("password_reset_token"), // Token for password reset
  passwordResetTokenExpiry: timestamp("password_reset_token_expiry"), // Reset token expiration
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: text("role").notNull().default("health_system"), // 'health_system', 'vendor', 'admin'
  permissions: text("permissions").notNull().default("user"), // 'admin', 'user', 'viewer'
  status: text("status").notNull().default("active"), // 'active', 'inactive', 'invited'
  lastLogin: timestamp("last_login"),
  // MFA/2FA support
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  mfaSecret: text("mfa_secret"), // Encrypted TOTP secret
  backupCodes: text("backup_codes").array(), // Array of hashed backup codes
  // Enterprise SSO support (WorkOS)
  ssoProvider: text("sso_provider"), // 'workos', 'google', 'microsoft', 'okta', etc.
  ssoExternalId: text("sso_external_id"), // External user ID from SSO provider
  ssoOrganizationId: text("sso_organization_id"), // WorkOS organization ID for directory sync
  // Stripe billing (individual user subscriptions - rare, mostly org-level)
  stripeCustomerId: text("stripe_customer_id"), // Stripe customer ID if user has personal subscription
  stripeSubscriptionId: text("stripe_subscription_id"), // Stripe subscription ID
  healthSystemId: varchar("health_system_id").references(() => healthSystems.id, { onDelete: "set null" }),
  vendorId: varchar("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// User invitations for enterprise user management
export const userInvitations = pgTable("user_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  role: text("role").notNull(), // 'health_system', 'vendor'
  permissions: text("permissions").notNull().default("user"), // 'admin', 'user', 'viewer'
  healthSystemId: varchar("health_system_id").references(() => healthSystems.id, { onDelete: "cascade" }),
  vendorId: varchar("vendor_id").references(() => vendors.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(), // Bcrypt hash of the invitation token
  tokenPrefix: text("token_prefix").notNull(), // First 8 chars for identification
  invitedBy: varchar("invited_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // 'pending', 'accepted', 'expired'
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Comprehensive audit log for compliance tracking
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(), // 'create', 'update', 'delete', 'login', 'logout', 'invite_user', 'resolve_alert', etc.
  resourceType: text("resource_type").notNull(), // 'ai_system', 'user', 'alert', 'certification', etc.
  resourceId: text("resource_id"),
  resourceName: text("resource_name"),
  changes: jsonb("changes"), // JSONB: {before: {...}, after: {...}} for structured querying
  metadata: jsonb("metadata"), // JSONB: additional context for compliance investigations
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  healthSystemId: varchar("health_system_id").references(() => healthSystems.id, { onDelete: "set null" }),
  vendorId: varchar("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  // Index for time-based audit log queries (compliance reporting)
  createdAtIdx: sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON ${table} (created_at DESC)`,
}));

export const healthSystems = pgTable("health_systems", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  state: text("state"), // US state code (e.g., 'CA', 'NY', 'TX') for state-specific compliance
  settings: jsonb("settings"), // JSONB: org preferences, branding, compliance thresholds, etc.
  // Stripe billing for health system subscriptions
  stripeCustomerId: text("stripe_customer_id"), // Stripe customer ID
  stripeSubscriptionId: text("stripe_subscription_id"), // Active subscription
  subscriptionTier: text("subscription_tier"), // 'starter', 'professional', 'enterprise' ($75K/$200K/$400K)
  subscriptionStatus: text("subscription_status"), // 'active', 'trialing', 'past_due', 'canceled', 'incomplete'
  currentPeriodStart: timestamp("current_period_start"), // Billing cycle start
  currentPeriodEnd: timestamp("current_period_end"), // Billing cycle end
  trialEndsAt: timestamp("trial_ends_at"), // 30-day trial expiry
  aiSystemLimit: integer("ai_system_limit"), // Plan limit: Starter(3), Professional(10), Enterprise(unlimited)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const vendors = pgTable("vendors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  certificationTier: text("certification_tier"), // 'verified', 'certified', 'trusted'
  verified: boolean("verified").notNull().default(false),
  logoUrl: text("logo_url"),
  website: text("website"),
  trustPageUrl: text("trust_page_url"),
  settings: jsonb("settings"), // JSONB: org preferences, branding, etc.
  // Stripe billing for vendor certification subscriptions
  stripeCustomerId: text("stripe_customer_id"), // Stripe customer ID
  stripeSubscriptionId: text("stripe_subscription_id"), // Active certification subscription
  subscriptionStatus: text("subscription_status"), // 'active', 'trialing', 'past_due', 'canceled', 'incomplete'
  currentPeriodStart: timestamp("current_period_start"), // Annual billing cycle start
  currentPeriodEnd: timestamp("current_period_end"), // Annual billing cycle end
  certificationExpiresAt: timestamp("certification_expires_at"), // Certification expiry (annual renewal)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Partner API - API keys for vendor programmatic access
export const vendorApiKeys = pgTable("vendor_api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").notNull(), // Bcrypt hash of the API key
  keyPrefix: text("key_prefix").notNull(), // First 8 chars for identification (e.g., "sk_live_")
  name: text("name").notNull(), // User-friendly name for the key
  lastUsed: timestamp("last_used"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiSystems = pgTable("ai_systems", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  department: text("department").notNull(),
  riskLevel: text("risk_level").notNull(),
  status: text("status").notNull(),
  healthSystemId: varchar("health_system_id").notNull().references(() => healthSystems.id, { onDelete: "cascade" }),
  vendorId: varchar("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  integrationConfig: jsonb("integration_config"), // HIPAA-compliant: API keys stored here MUST be encrypted using server/services/encryption.ts
  lastCheck: timestamp("last_check"),
  // Beacon Certification Tiers (Phase 1: Grading Transformation)
  verificationTier: text("verification_tier"), // 'verified', 'certified', 'trusted' - aligns with Beacon pricing ($15K/$50K/$100K)
  verificationDate: timestamp("verification_date"), // When current tier was achieved
  verificationExpiry: timestamp("verification_expiry"), // Quarterly recertification required
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  // Index for filtering AI systems by health system (common query pattern)
  healthSystemIdx: sql`CREATE INDEX IF NOT EXISTS idx_ai_systems_health_system ON ${table} (health_system_id)`,
}));

export const monitoringAlerts = pgTable("monitoring_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  aiSystemId: varchar("ai_system_id").notNull().references(() => aiSystems.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  severity: text("severity").notNull(),
  message: text("message").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  // Response Time Tracking (Phase 2: High Priority Features)
  resolvedAt: timestamp("resolved_at"), // When alert was resolved (for "2-minute rollback" metrics)
  responseTimeSeconds: integer("response_time_seconds"), // Calculated: resolvedAt - createdAt
  resolvedBy: varchar("resolved_by").references(() => users.id, { onDelete: "set null" }), // Who resolved it
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  // Composite index for filtering unresolved alerts by AI system
  aiSystemResolvedIdx: sql`CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_system_resolved ON ${table} (ai_system_id, resolved)`,
}));

// Predictive alerts - forecasts future violations based on trend analysis
export const predictiveAlerts = pgTable("predictive_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  aiSystemId: varchar("ai_system_id").notNull().references(() => aiSystems.id, { onDelete: "cascade" }),
  predictionType: text("prediction_type").notNull(), // 'drift', 'error_spike', 'latency_degradation', 'bias', 'phi_exposure'
  metric: text("metric").notNull(), // 'drift_score', 'error_rate', 'latency_p95', 'bias_score', 'phi_leak_count'
  currentValue: text("current_value").notNull(), // Current metric value
  predictedValue: text("predicted_value").notNull(), // Forecasted value at predicted date
  threshold: text("threshold").notNull(), // Threshold that will be crossed
  predictedDate: timestamp("predicted_date").notNull(), // When threshold crossing is expected
  confidenceScore: integer("confidence_score").notNull(), // 0-100
  trendDirection: text("trend_direction").notNull(), // 'increasing', 'decreasing'
  trendVelocity: text("trend_velocity").notNull(), // Rate of change (numeric as text)
  datapointsAnalyzed: integer("datapoints_analyzed").notNull(), // Number of historical points used
  severity: text("severity").notNull(), // 'low', 'medium', 'high', 'critical'
  dismissed: boolean("dismissed").notNull().default(false),
  actualizedAt: timestamp("actualized_at"), // Set if prediction became real violation
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const deployments = pgTable("deployments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  healthSystemId: varchar("health_system_id").notNull().references(() => healthSystems.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const complianceCertifications = pgTable("compliance_certifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  status: text("status").notNull(),
  verifiedDate: timestamp("verified_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Background jobs table for async processing (certification workflows, scheduled checks, reports)
export const backgroundJobs = pgTable("background_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobType: text("job_type").notNull(), // 'certification_workflow', 'compliance_check', 'report_generation'
  status: text("status").notNull().default("pending"), // 'pending', 'running', 'completed', 'failed'
  payload: text("payload").notNull(), // JSON data for the job
  result: text("result"), // JSON result after completion
  error: text("error"), // Error message if failed
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Certification applications for vendor verification workflow
export const certificationApplications = pgTable("certification_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  tierRequested: text("tier_requested").notNull(), // 'Silver', 'Gold', 'Platinum'
  status: text("status").notNull().default("pending"), // 'pending', 'in_review', 'approved', 'rejected'
  apiEndpoint: text("api_endpoint"), // Vendor's AI API endpoint for testing
  documentationUrls: text("documentation_urls").array(),
  complianceStatements: text("compliance_statements"), // JSON: {hipaa: boolean, nist: boolean, fda: boolean}
  automatedChecksPassed: boolean("automated_checks_passed"),
  automatedChecksResult: text("automated_checks_result"), // JSON with check details
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  notes: text("notes"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 🧪 VENDOR TESTING SUITE - Makes Beacon certifications meaningful
// Tracks automated testing results for vendor AI systems
export const vendorTestResults = pgTable("vendor_test_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => certificationApplications.id, { onDelete: "cascade" }),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  testType: text("test_type").notNull(), // 'phi_exposure', 'clinical_accuracy', 'bias_detection', 'security_scan'
  status: text("status").notNull().default("pending"), // 'pending', 'running', 'passed', 'failed', 'error'
  score: integer("score"), // 0-100 percentage score
  passed: boolean("passed"),
  details: jsonb("details"), // Test-specific results and findings
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 🔒 TRANSLATION ENGINE - Core IP (The Moat)
// Maps AI telemetry to compliance controls across frameworks
export const complianceControls = pgTable("compliance_controls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  framework: text("framework").notNull(), // 'HIPAA', 'NIST_AI_RMF', 'FDA', 'ISO_42001'
  controlId: text("control_id").notNull(), // '164.312(b)', 'MANAGE-4.1'
  controlName: text("control_name").notNull(),
  description: text("description"),
  requirements: text("requirements").array(),
  testingCriteria: text("testing_criteria"), // JSONB for structured queries
  evidenceRequirements: text("evidence_requirements").array(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Uniqueness constraint: one control per framework
  frameworkControlIdx: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_controls_framework_control ON ${table} (framework, control_id)`,
}));

// Links AI systems to compliance controls with status tracking
export const complianceMappings = pgTable("compliance_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  aiSystemId: varchar("ai_system_id").notNull().references(() => aiSystems.id, { onDelete: "cascade" }),
  controlId: varchar("control_id").notNull().references(() => complianceControls.id, { onDelete: "cascade" }),
  status: text("status").notNull(), // 'compliant', 'non_compliant', 'not_applicable', 'in_review'
  lastVerified: timestamp("last_verified"),
  nextVerification: timestamp("next_verification"),
  evidenceLinks: text("evidence_links").array(), // S3 URLs
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Uniqueness constraint: one mapping per AI system per control
  aiSystemControlIdx: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_mappings_ai_control ON ${table} (ai_system_id, control_id)`,
  // Index for reverse lookups: which AI systems use a specific control
  controlIdx: sql`CREATE INDEX IF NOT EXISTS idx_compliance_mappings_control ON ${table} (control_id)`,
}));

// Generated compliance reports
export const complianceReports = pgTable("compliance_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  healthSystemId: varchar("health_system_id").notNull().references(() => healthSystems.id, { onDelete: "cascade" }),
  reportType: text("report_type").notNull(), // 'daily', 'weekly', 'monthly', 'board', 'audit'
  frameworks: text("frameworks").array(),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  summary: text("summary"), // JSON stored as text
  findings: text("findings"), // JSON stored as text
  recommendations: text("recommendations").array(),
  fileUrl: text("file_url"),
  generatedBy: varchar("generated_by").references(() => users.id, { onDelete: "set null" }),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
});

// Compliance template library - pre-built templates and frameworks for AI governance
export const complianceTemplates = pgTable("compliance_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  framework: text("framework").notNull(), // 'HIPAA', 'NIST_AI_RMF', 'FDA_SaMD', 'ISO_27001', 'ISO_42001', 'General'
  category: text("category").notNull(), // 'Risk Assessment', 'Data Privacy', 'Model Validation', 'Audit', 'Policy', 'Checklist'
  description: text("description").notNull(),
  content: text("content").notNull(), // Markdown or structured content
  fileType: text("file_type").notNull(), // 'markdown', 'pdf', 'checklist', 'policy'
  tags: text("tags").array(), // Searchable tags
  downloadable: boolean("downloadable").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// 🔒 PHASE 1: TRANSLATION ENGINE EXPANSION

// Control version history for quarterly regulatory updates
export const controlVersions = pgTable("control_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  controlId: varchar("control_id").notNull().references(() => complianceControls.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  changes: jsonb("changes"), // What changed from previous version
  regulatorySource: text("regulatory_source"), // HHS guidance, FDA update, etc.
  changeReason: text("change_reason"),
  changedBy: varchar("changed_by").references(() => users.id, { onDelete: "set null" }),
  effectiveDate: timestamp("effective_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Expanded event types taxonomy (15+ types vs current 5)
export const eventTypes = pgTable("event_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: text("event_type").notNull().unique(),
  category: text("category"), // 'privacy', 'performance', 'safety', 'security'
  description: text("description").notNull(),
  telemetryFields: jsonb("telemetry_fields"), // Expected fields in payload
  normalizer: text("normalizer"), // Which normalizer function to use
  defaultSeverity: text("default_severity"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// State-specific regulations (CA, CO, NYC)
export const stateRegulations = pgTable("state_regulations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  state: text("state").notNull(), // 'CA', 'CO', 'NY'
  regulationName: text("regulation_name").notNull(), // 'CA SB 1047', 'CO AI Act'
  controlId: text("control_id").notNull(),
  controlName: text("control_name").notNull(),
  description: text("description").notNull(),
  requiresReporting: boolean("requires_reporting").default(false),
  reportingDeadlineDays: integer("reporting_deadline_days"),
  effectiveDate: timestamp("effective_date").notNull(),
  sunsetDate: timestamp("sunset_date"),
  mappedEventTypes: jsonb("mapped_event_types"),
  detectionLogic: jsonb("detection_logic"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Adaptive threshold models (ML-based, per health system)
export const adaptiveThresholdModels = pgTable("adaptive_threshold_models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  healthSystemId: varchar("health_system_id").notNull().references(() => healthSystems.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  modelType: text("model_type").notNull(), // 'statistical', 'ml_regression', 'ensemble'
  modelConfig: jsonb("model_config"), // Hyperparameters
  thresholds: jsonb("thresholds"), // Current learned thresholds
  trainingDataSummary: jsonb("training_data_summary"),
  lastTrainedAt: timestamp("last_trained_at"),
  accuracy: text("accuracy"),
  falsePositiveRate: text("false_positive_rate"),
  falseNegativeRate: text("false_negative_rate"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Regulatory updates queue for continuous compliance
export const regulatoryUpdates = pgTable("regulatory_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  framework: text("framework").notNull(),
  updateType: text("update_type").notNull(), // 'new_control', 'control_revision', 'interpretation'
  title: text("title").notNull(),
  description: text("description").notNull(),
  source: text("source"), // URL to official guidance
  impactedControls: jsonb("impacted_controls"),
  actionRequired: text("action_required"),
  status: text("status").notNull().default("pending"),
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  publishedDate: timestamp("published_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 📡 AI MONITORING - LangSmith Integration
// Stores telemetry events from AI monitoring platforms
export const aiTelemetryEvents = pgTable("ai_telemetry_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  aiSystemId: varchar("ai_system_id").notNull().references(() => aiSystems.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // 'run', 'alert', 'error', 'feedback'
  source: text("source").notNull(), // 'langsmith', 'arize', 'manual'
  runId: text("run_id"), // External run ID from LangSmith
  ruleId: text("rule_id"), // LangSmith automation rule ID
  severity: text("severity"), // 'critical', 'high', 'medium', 'low'
  metric: text("metric"), // 'error_count', 'latency', 'feedback_score', 'cost'
  metricValue: text("metric_value"), // Numeric value as text for flexibility
  threshold: text("threshold"), // Threshold that was crossed
  payload: text("payload"), // DEPRECATED: Legacy unencrypted payload - DO NOT USE for new data
  // 🔒 HIPAA-COMPLIANT PHI ENCRYPTION (CRITICAL SECURITY FIX)
  encryptedPayload: text("encrypted_payload"), // AES-256-GCM encrypted payload with PHI redaction
  phiRedacted: boolean("phi_redacted").notNull().default(false), // True if PHI was detected and redacted
  phiEntitiesDetected: integer("phi_entities_detected").notNull().default(0), // Count of PHI entities found
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  // Index for time-based telemetry queries (trend analysis, compliance)
  createdAtIdx: sql`CREATE INDEX IF NOT EXISTS idx_ai_telemetry_created_at ON ${table} (created_at DESC)`,
  // Composite index for system-specific time-series queries
  aiSystemCreatedAtIdx: sql`CREATE INDEX IF NOT EXISTS idx_ai_telemetry_system_time ON ${table} (ai_system_id, created_at DESC)`,
}));

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  healthSystem: one(healthSystems, {
    fields: [users.healthSystemId],
    references: [healthSystems.id],
  }),
  vendor: one(vendors, {
    fields: [users.vendorId],
    references: [vendors.id],
  }),
}));

export const userInvitationsRelations = relations(userInvitations, ({ one }) => ({
  healthSystem: one(healthSystems, {
    fields: [userInvitations.healthSystemId],
    references: [healthSystems.id],
  }),
  vendor: one(vendors, {
    fields: [userInvitations.vendorId],
    references: [vendors.id],
  }),
  invitedByUser: one(users, {
    fields: [userInvitations.invitedBy],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
  healthSystem: one(healthSystems, {
    fields: [auditLogs.healthSystemId],
    references: [healthSystems.id],
  }),
  vendor: one(vendors, {
    fields: [auditLogs.vendorId],
    references: [vendors.id],
  }),
}));

export const healthSystemsRelations = relations(healthSystems, ({ many }) => ({
  aiSystems: many(aiSystems),
  deployments: many(deployments),
  users: many(users),
}));

export const vendorsRelations = relations(vendors, ({ many }) => ({
  aiSystems: many(aiSystems),
  deployments: many(deployments),
  certifications: many(complianceCertifications),
  certificationApplications: many(certificationApplications),
  users: many(users),
  apiKeys: many(vendorApiKeys),
}));

export const vendorApiKeysRelations = relations(vendorApiKeys, ({ one }) => ({
  vendor: one(vendors, {
    fields: [vendorApiKeys.vendorId],
    references: [vendors.id],
  }),
}));

export const aiSystemsRelations = relations(aiSystems, ({ one, many }) => ({
  healthSystem: one(healthSystems, {
    fields: [aiSystems.healthSystemId],
    references: [healthSystems.id],
  }),
  vendor: one(vendors, {
    fields: [aiSystems.vendorId],
    references: [vendors.id],
  }),
  alerts: many(monitoringAlerts),
  predictiveAlerts: many(predictiveAlerts),
  telemetryEvents: many(aiTelemetryEvents),
}));

export const monitoringAlertsRelations = relations(monitoringAlerts, ({ one }) => ({
  aiSystem: one(aiSystems, {
    fields: [monitoringAlerts.aiSystemId],
    references: [aiSystems.id],
  }),
}));

export const predictiveAlertsRelations = relations(predictiveAlerts, ({ one }) => ({
  aiSystem: one(aiSystems, {
    fields: [predictiveAlerts.aiSystemId],
    references: [aiSystems.id],
  }),
}));

export const deploymentsRelations = relations(deployments, ({ one }) => ({
  vendor: one(vendors, {
    fields: [deployments.vendorId],
    references: [vendors.id],
  }),
  healthSystem: one(healthSystems, {
    fields: [deployments.healthSystemId],
    references: [healthSystems.id],
  }),
}));

export const complianceCertificationsRelations = relations(complianceCertifications, ({ one }) => ({
  vendor: one(vendors, {
    fields: [complianceCertifications.vendorId],
    references: [vendors.id],
  }),
}));

export const certificationApplicationsRelations = relations(certificationApplications, ({ one, many }) => ({
  vendor: one(vendors, {
    fields: [certificationApplications.vendorId],
    references: [vendors.id],
  }),
  reviewedByUser: one(users, {
    fields: [certificationApplications.reviewedBy],
    references: [users.id],
  }),
  testResults: many(vendorTestResults),
}));

export const vendorTestResultsRelations = relations(vendorTestResults, ({ one }) => ({
  application: one(certificationApplications, {
    fields: [vendorTestResults.applicationId],
    references: [certificationApplications.id],
  }),
  vendor: one(vendors, {
    fields: [vendorTestResults.vendorId],
    references: [vendors.id],
  }),
}));

export const complianceControlsRelations = relations(complianceControls, ({ many }) => ({
  mappings: many(complianceMappings),
}));

export const complianceMappingsRelations = relations(complianceMappings, ({ one }) => ({
  aiSystem: one(aiSystems, {
    fields: [complianceMappings.aiSystemId],
    references: [aiSystems.id],
  }),
  control: one(complianceControls, {
    fields: [complianceMappings.controlId],
    references: [complianceControls.id],
  }),
}));

export const complianceReportsRelations = relations(complianceReports, ({ one }) => ({
  healthSystem: one(healthSystems, {
    fields: [complianceReports.healthSystemId],
    references: [healthSystems.id],
  }),
  generatedByUser: one(users, {
    fields: [complianceReports.generatedBy],
    references: [users.id],
  }),
}));

export const aiTelemetryEventsRelations = relations(aiTelemetryEvents, ({ one }) => ({
  aiSystem: one(aiSystems, {
    fields: [aiTelemetryEvents.aiSystemId],
    references: [aiSystems.id],
  }),
}));

// 🔒 TRANSLATION ENGINE - Compliance Violations
// Stores detected compliance violations from Translation Engine
export const complianceViolations = pgTable("compliance_violations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  telemetryEventId: varchar("telemetry_event_id").notNull().references(() => aiTelemetryEvents.id, { onDelete: "cascade" }),
  aiSystemId: varchar("ai_system_id").notNull().references(() => aiSystems.id, { onDelete: "cascade" }),
  framework: text("framework").notNull(), // 'HIPAA', 'NIST_AI_RMF', 'FDA_SaMD', etc.
  controlId: text("control_id").notNull(),
  controlName: text("control_name").notNull(),
  violationType: text("violation_type").notNull(), // 'breach', 'deviation', 'threshold_exceeded'
  severity: text("severity").notNull(), // 'low', 'medium', 'high', 'critical'
  requiresReporting: boolean("requires_reporting").notNull().default(false),
  reportingDeadline: timestamp("reporting_deadline"),
  description: text("description").notNull(), // DEPRECATED: Legacy unencrypted description
  // 🔒 HIPAA-COMPLIANT PHI ENCRYPTION (CRITICAL SECURITY FIX)
  encryptedDescription: text("encrypted_description"), // AES-256-GCM encrypted description with PHI redaction
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 🌐 PHASE 2: NETWORK EFFECTS & MARKETPLACE

// Vendor acceptance tracking
export const vendorAcceptances = pgTable("vendor_acceptances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  healthSystemId: varchar("health_system_id").notNull().references(() => healthSystems.id, { onDelete: "cascade" }),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  certificationId: varchar("certification_id").references(() => complianceCertifications.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"),
  acceptedDate: timestamp("accepted_date"),
  expirationDate: timestamp("expiration_date"),
  acceptedBy: varchar("accepted_by").references(() => users.id, { onDelete: "set null" }),
  rejectionReason: text("rejection_reason"),
  requiredInRFP: boolean("required_in_rfp").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Health system - vendor relationships for network density
export const healthSystemVendorRelationships = pgTable("health_system_vendor_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  healthSystemId: varchar("health_system_id").notNull().references(() => healthSystems.id, { onDelete: "cascade" }),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  relationshipType: text("relationship_type").notNull(),
  contractValue: integer("contract_value"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  aiSystemsCount: integer("ai_systems_count").default(0),
  spectralVerifiedRequired: boolean("spectral_verified_required").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Spectral Standard adoption tracking
export const spectralStandardAdoptions = pgTable("spectral_standard_adoptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  healthSystemId: varchar("health_system_id").notNull().references(() => healthSystems.id, { onDelete: "cascade" }),
  adoptionType: text("adoption_type").notNull(),
  scope: text("scope"),
  categories: jsonb("categories"),
  announcedDate: timestamp("announced_date").notNull(),
  effectiveDate: timestamp("effective_date").notNull(),
  publiclyAnnounced: boolean("publicly_announced").default(false),
  pressReleaseUrl: text("press_release_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Network metrics daily snapshots
export const networkMetricsDailySnapshots = pgTable("network_metrics_daily_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  snapshotDate: timestamp("snapshot_date").notNull(),
  totalHealthSystems: integer("total_health_systems").notNull(),
  activeHealthSystems: integer("active_health_systems").notNull(),
  totalVendors: integer("total_vendors").notNull(),
  certifiedVendors: integer("certified_vendors").notNull(),
  totalAcceptances: integer("total_acceptances").notNull(),
  spectralStandardAdopters: integer("spectral_standard_adopters").notNull(),
  networkDensity: text("network_density"),
  averageAcceptanceRate: text("average_acceptance_rate"),
  newHealthSystemsThisWeek: integer("new_health_systems_this_week"),
  newVendorsThisWeek: integer("new_vendors_this_week"),
  newCertificationsThisWeek: integer("new_certifications_this_week"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 📊 PHASE 3: EXECUTIVE REPORTING & AUTOMATION

// Executive reports
export const executiveReports = pgTable("executive_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  healthSystemId: varchar("health_system_id").notNull().references(() => healthSystems.id, { onDelete: "cascade" }),
  reportType: text("report_type").notNull(),
  reportTitle: text("report_title").notNull(),
  reportPeriod: text("report_period"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  narrative: text("narrative"),
  keyMetrics: jsonb("key_metrics"),
  riskSummary: jsonb("risk_summary"),
  complianceStatus: jsonb("compliance_status"),
  actionItems: jsonb("action_items"),
  trendAnalysis: jsonb("trend_analysis"),
  pdfUrl: text("pdf_url"),
  generatedBy: varchar("generated_by").references(() => users.id, { onDelete: "set null" }),
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Audit evidence packages
export const auditEvidencePackages = pgTable("audit_evidence_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  healthSystemId: varchar("health_system_id").notNull().references(() => healthSystems.id, { onDelete: "cascade" }),
  framework: text("framework").notNull(),
  packageType: text("package_type").notNull(),
  auditPeriod: text("audit_period"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  evidenceItems: jsonb("evidence_items"),
  controlsCovered: jsonb("controls_covered"),
  completenessScore: text("completeness_score"),
  packageUrl: text("package_url"),
  generatedBy: varchar("generated_by").references(() => users.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"),
  deliveredTo: text("delivered_to"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Report schedules
export const reportSchedules = pgTable("report_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  healthSystemId: varchar("health_system_id").notNull().references(() => healthSystems.id, { onDelete: "cascade" }),
  reportType: text("report_type").notNull(),
  frequency: text("frequency").notNull(),
  dayOfWeek: integer("day_of_week"),
  dayOfMonth: integer("day_of_month"),
  monthOfQuarter: integer("month_of_quarter"),
  recipients: jsonb("recipients"),
  includeExecutiveSummary: boolean("include_executive_summary").default(true),
  includeDetailedMetrics: boolean("include_detailed_metrics").default(false),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at").notNull(),
  active: boolean("active").notNull().default(true),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Regulatory alerts
export const regulatoryAlerts = pgTable("regulatory_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  framework: text("framework").notNull(),
  alertType: text("alert_type").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  impactLevel: text("impact_level").notNull(),
  affectedControls: jsonb("affected_controls"),
  affectedHealthSystems: jsonb("affected_health_systems"),
  actionRequired: text("action_required"),
  deadline: timestamp("deadline"),
  sourceUrl: text("source_url"),
  publishedDate: timestamp("published_date").notNull(),
  acknowledgedBy: jsonb("acknowledged_by"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 💰 PHASE 4: BUSINESS MODEL & PRODUCT POLISH

// Policy rules
export const policyRules = pgTable("policy_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  healthSystemId: varchar("health_system_id").notNull().references(() => healthSystems.id, { onDelete: "cascade" }),
  policyName: text("policy_name").notNull(),
  policyType: text("policy_type").notNull(),
  scope: text("scope").notNull(),
  scopeFilter: jsonb("scope_filter"),
  conditions: jsonb("conditions"),
  enforcementActions: jsonb("enforcement_actions"),
  approvalWorkflow: jsonb("approval_workflow"),
  active: boolean("active").notNull().default(true),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Policy enforcement logs
export const policyEnforcementLogs = pgTable("policy_enforcement_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  policyId: varchar("policy_id").notNull().references(() => policyRules.id, { onDelete: "cascade" }),
  aiSystemId: varchar("ai_system_id").notNull().references(() => aiSystems.id, { onDelete: "cascade" }),
  violationType: text("violation_type").notNull(),
  actionTaken: text("action_taken").notNull(),
  details: jsonb("details"),
  resolvedBy: varchar("resolved_by").references(() => users.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// AI discovery jobs
export const aiDiscoveryJobs = pgTable("ai_discovery_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  healthSystemId: varchar("health_system_id").notNull().references(() => healthSystems.id, { onDelete: "cascade" }),
  discoveryType: text("discovery_type").notNull(),
  dataSource: text("data_source"),
  status: text("status").notNull().default("pending"),
  aiSystemsFound: integer("ai_systems_found").default(0),
  aiSystemsNew: integer("ai_systems_new").default(0),
  aiSystemsUpdated: integer("ai_systems_updated").default(0),
  results: jsonb("results"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 🚀 PHASE 5: SCALE & ACQUISITION POSITIONING

// Vendor performance metrics
export const vendorPerformanceMetrics = pgTable("vendor_performance_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  period: text("period").notNull(),
  customerCount: integer("customer_count").default(0),
  activeDeployments: integer("active_deployments").default(0),
  averageComplianceScore: text("average_compliance_score"),
  violationsCount: integer("violations_count").default(0),
  criticalViolations: integer("critical_violations").default(0),
  certificationRenewalRate: text("certification_renewal_rate"),
  customerSatisfaction: text("customer_satisfaction"),
  uptimePercentage: text("uptime_percentage"),
  supportResponseTime: text("support_response_time"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Health system rollup metrics
export const healthSystemRollupMetrics = pgTable("health_system_rollup_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  healthSystemId: varchar("health_system_id").notNull().references(() => healthSystems.id, { onDelete: "cascade" }),
  period: text("period").notNull(),
  totalAISystems: integer("total_ai_systems").default(0),
  activeAISystems: integer("active_ai_systems").default(0),
  averageRiskScore: text("average_risk_score"),
  portfolioComplianceScore: text("portfolio_compliance_score"),
  openViolations: integer("open_violations").default(0),
  resolvedViolationsThisPeriod: integer("resolved_violations_this_period").default(0),
  averageResolutionTime: text("average_resolution_time"),
  certifiedVendorPercentage: text("certified_vendor_percentage"),
  policyComplianceRate: text("policy_compliance_rate"),
  executiveReportsGenerated: integer("executive_reports_generated").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Network effects proof metrics
export const networkEffectsProofMetrics = pgTable("network_effects_proof_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  period: text("period").notNull(),
  totalHealthSystems: integer("total_health_systems").default(0),
  activeHealthSystems: integer("active_health_systems").default(0),
  totalVendors: integer("total_vendors").default(0),
  certifiedVendors: integer("certified_vendors").default(0),
  totalConnections: integer("total_connections").default(0),
  spectralStandardAdopters: integer("spectral_standard_adopters").default(0),
  avgAcceptancesPerVendor: text("avg_acceptances_per_vendor"),
  networkDensityScore: text("network_density_score"),
  viralCoefficient: text("viral_coefficient"),
  crossSideLiquidity: text("cross_side_liquidity"),
  healthSystemGrowthRate: text("health_system_growth_rate"),
  vendorGrowthRate: text("vendor_growth_rate"),
  acceptanceGrowthRate: text("acceptance_growth_rate"),
  avgSalesCycleLength: integer("avg_sales_cycle_length"),
  avgDealSize: integer("avg_deal_size"),
  winRateWithNetworkEffects: text("win_rate_with_network_effects"),
  churnRate: text("churn_rate"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 🔒 TRANSLATION ENGINE - Required Actions
export const requiredActions = pgTable("required_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  violationId: varchar("violation_id").notNull().references(() => complianceViolations.id, { onDelete: "cascade" }),
  aiSystemId: varchar("ai_system_id").notNull().references(() => aiSystems.id, { onDelete: "cascade" }),
  actionType: text("action_type").notNull(), // 'rollback', 'notify', 'document', 'escalate', 'restrict'
  priority: text("priority").notNull(), // 'immediate', 'urgent', 'high', 'medium', 'low'
  description: text("description").notNull(),
  assignee: text("assignee").notNull(), // 'ciso', 'compliance_officer', 'clinical_owner', 'it_owner', 'privacy_officer'
  deadline: timestamp("deadline").notNull(),
  automated: boolean("automated").notNull().default(false),
  actionDetails: text("action_details"), // JSON for additional action metadata
  status: text("status").notNull().default("pending"), // 'pending', 'in_progress', 'completed', 'cancelled'
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const complianceViolationsRelations = relations(complianceViolations, ({ one, many }) => ({
  telemetryEvent: one(aiTelemetryEvents, {
    fields: [complianceViolations.telemetryEventId],
    references: [aiTelemetryEvents.id],
  }),
  aiSystem: one(aiSystems, {
    fields: [complianceViolations.aiSystemId],
    references: [aiSystems.id],
  }),
  actions: many(requiredActions),
}));

export const requiredActionsRelations = relations(requiredActions, ({ one }) => ({
  violation: one(complianceViolations, {
    fields: [requiredActions.violationId],
    references: [complianceViolations.id],
  }),
  aiSystem: one(aiSystems, {
    fields: [requiredActions.aiSystemId],
    references: [aiSystems.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, lastLogin: true });
export const insertUserInvitationSchema = createInsertSchema(userInvitations).omit({ id: true, createdAt: true, acceptedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertHealthSystemSchema = createInsertSchema(healthSystems).omit({ id: true, createdAt: true });
export const insertVendorSchema = createInsertSchema(vendors).omit({ id: true, createdAt: true });
export const insertVendorApiKeySchema = createInsertSchema(vendorApiKeys).omit({ id: true, createdAt: true, lastUsed: true });
export const insertAISystemSchema = createInsertSchema(aiSystems).omit({ id: true, createdAt: true });
export const insertMonitoringAlertSchema = createInsertSchema(monitoringAlerts).omit({ id: true, createdAt: true });
export const insertPredictiveAlertSchema = createInsertSchema(predictiveAlerts).omit({ id: true, createdAt: true });
export const insertDeploymentSchema = createInsertSchema(deployments).omit({ id: true, createdAt: true });
export const insertComplianceCertificationSchema = createInsertSchema(complianceCertifications).omit({ id: true, createdAt: true });
export const insertComplianceControlSchema = createInsertSchema(complianceControls).omit({ id: true, updatedAt: true });
export const insertComplianceMappingSchema = createInsertSchema(complianceMappings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertComplianceReportSchema = createInsertSchema(complianceReports).omit({ id: true, generatedAt: true });
export const insertComplianceTemplateSchema = createInsertSchema(complianceTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAITelemetryEventSchema = createInsertSchema(aiTelemetryEvents).omit({ id: true, createdAt: true });
export const insertComplianceViolationSchema = createInsertSchema(complianceViolations).omit({ id: true, createdAt: true });
export const insertRequiredActionSchema = createInsertSchema(requiredActions).omit({ id: true, createdAt: true });
export const insertBackgroundJobSchema = createInsertSchema(backgroundJobs).omit({ id: true, createdAt: true, startedAt: true, completedAt: true });
export const insertCertificationApplicationSchema = createInsertSchema(certificationApplications).omit({ id: true, createdAt: true, submittedAt: true });
export const insertVendorTestResultSchema = createInsertSchema(vendorTestResults).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type UserInvitation = typeof userInvitations.$inferSelect;
export type InsertUserInvitation = z.infer<typeof insertUserInvitationSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type HealthSystem = typeof healthSystems.$inferSelect;
export type InsertHealthSystem = z.infer<typeof insertHealthSystemSchema>;

export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;

export type VendorApiKey = typeof vendorApiKeys.$inferSelect;
export type InsertVendorApiKey = z.infer<typeof insertVendorApiKeySchema>;

export type AISystem = typeof aiSystems.$inferSelect;
export type InsertAISystem = z.infer<typeof insertAISystemSchema>;

export type MonitoringAlert = typeof monitoringAlerts.$inferSelect;
export type InsertMonitoringAlert = z.infer<typeof insertMonitoringAlertSchema>;

export type PredictiveAlert = typeof predictiveAlerts.$inferSelect;
export type InsertPredictiveAlert = z.infer<typeof insertPredictiveAlertSchema>;

export type Deployment = typeof deployments.$inferSelect;
export type InsertDeployment = z.infer<typeof insertDeploymentSchema>;

export type ComplianceCertification = typeof complianceCertifications.$inferSelect;
export type InsertComplianceCertification = z.infer<typeof insertComplianceCertificationSchema>;

export type ComplianceControl = typeof complianceControls.$inferSelect;
export type InsertComplianceControl = z.infer<typeof insertComplianceControlSchema>;

export type ComplianceMapping = typeof complianceMappings.$inferSelect;
export type InsertComplianceMapping = z.infer<typeof insertComplianceMappingSchema>;

export type ComplianceReport = typeof complianceReports.$inferSelect;
export type InsertComplianceReport = z.infer<typeof insertComplianceReportSchema>;

export type ComplianceTemplate = typeof complianceTemplates.$inferSelect;
export type InsertComplianceTemplate = z.infer<typeof insertComplianceTemplateSchema>;

export type AITelemetryEvent = typeof aiTelemetryEvents.$inferSelect;
export type InsertAITelemetryEvent = z.infer<typeof insertAITelemetryEventSchema>;

export type ComplianceViolation = typeof complianceViolations.$inferSelect;
export type InsertComplianceViolation = z.infer<typeof insertComplianceViolationSchema>;

export type RequiredAction = typeof requiredActions.$inferSelect;
export type InsertRequiredAction = z.infer<typeof insertRequiredActionSchema>;

export type BackgroundJob = typeof backgroundJobs.$inferSelect;
export type InsertBackgroundJob = z.infer<typeof insertBackgroundJobSchema>;

export type CertificationApplication = typeof certificationApplications.$inferSelect;
export type InsertCertificationApplication = z.infer<typeof insertCertificationApplicationSchema>;

export type VendorTestResult = typeof vendorTestResults.$inferSelect;
export type InsertVendorTestResult = z.infer<typeof insertVendorTestResultSchema>;

// ===== PHASE 1: WEBHOOK SECURITY =====

// Webhook secrets for signature verification
export const webhookSecrets = pgTable("webhook_secrets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceName: text("service_name").notNull().unique(), // 'langsmith', 'arize', 'epic', etc.
  secretKey: text("secret_key").notNull(), // Encrypted signing secret
  algorithm: text("algorithm").notNull().default('hmac-sha256'), // 'hmac-sha256', 'rsa'
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  rotatedAt: timestamp("rotated_at"),
});

// Webhook delivery logs for security monitoring
export const webhookDeliveryLogs = pgTable("webhook_delivery_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceName: text("service_name").notNull(),
  endpoint: text("endpoint").notNull(),
  signatureValid: boolean("signature_valid"),
  payloadValid: boolean("payload_valid"),
  statusCode: integer("status_code"),
  errorMessage: text("error_message"),
  ipAddress: text("ip_address"),
  requestHeaders: jsonb("request_headers"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  serviceIdx: sql`CREATE INDEX IF NOT EXISTS idx_webhook_logs_service ON ${table} (service_name, created_at DESC)`,
}));

export const insertWebhookSecretSchema = createInsertSchema(webhookSecrets);
export const insertWebhookDeliveryLogSchema = createInsertSchema(webhookDeliveryLogs);

// ===== PHASE 2: COMPLIANCE CONTROL VERSIONING =====

// Compliance control versions for quarterly regulatory updates
export const complianceControlVersions = pgTable("compliance_control_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  controlId: text("control_id").notNull(),
  version: text("version").notNull(), // Semantic versioning (e.g., '1.0.0', '1.1.0')
  changes: jsonb("changes"), // What changed from previous version
  effectiveDate: timestamp("effective_date").notNull(),
  deprecatedDate: timestamp("deprecated_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  controlVersionIdx: sql`CREATE INDEX IF NOT EXISTS idx_control_versions ON ${table} (control_id, version)`,
}));

export const insertComplianceControlVersionSchema = createInsertSchema(complianceControlVersions);

// ===== PHASE 3: ADVANCED VENDOR CERTIFICATION =====

// Validation datasets for automated clinical testing
export const validationDatasets = pgTable("validation_datasets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(), // 'radiology', 'pathology', 'cardiology', 'oncology', 'general'
  description: text("description"),
  testCases: jsonb("test_cases").notNull(), // Array of {input, expected_output, ground_truth}
  metadataSource: text("metadata_source"), // Where ground truth came from (FDA, peer-reviewed, etc.)
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertValidationDatasetSchema = createInsertSchema(validationDatasets);

// ===== PHASE 4: BILLING & REVENUE INFRASTRUCTURE =====

// Billing accounts for Stripe integration
export const billingAccounts = pgTable("billing_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  healthSystemId: varchar("health_system_id").references(() => healthSystems.id, { onDelete: "cascade" }),
  vendorId: varchar("vendor_id").references(() => vendors.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").unique(),
  paymentMethodId: text("payment_method_id"),
  billingEmail: text("billing_email").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  stripeCustomerIdx: sql`CREATE INDEX IF NOT EXISTS idx_billing_stripe_customer ON ${table} (stripe_customer_id)`,
}));

// Subscriptions for plan management
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  billingAccountId: varchar("billing_account_id").notNull().references(() => billingAccounts.id, { onDelete: "cascade" }),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  planTier: text("plan_tier").notNull(), // 'foundation', 'growth', 'enterprise'
  planPrice: text("plan_price").notNull().default('0'), // Monthly price in dollars (stored as string for precision)
  currency: text("currency").notNull().default('usd'),
  status: text("status").notNull(), // 'active', 'past_due', 'canceled', 'incomplete'
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelAt: timestamp("cancel_at"),
  canceledAt: timestamp("canceled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  stripeSubIdx: sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON ${table} (stripe_subscription_id)`,
}));

// Invoices for billing records
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  billingAccountId: varchar("billing_account_id").notNull().references(() => billingAccounts.id, { onDelete: "cascade" }),
  subscriptionId: varchar("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
  invoiceNumber: text("invoice_number").notNull().unique(),
  stripeInvoiceId: text("stripe_invoice_id").unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  subtotal: text("subtotal").notNull(), // Stored as string for precision
  tax: text("tax").notNull().default('0'),
  total: text("total").notNull(),
  currency: text("currency").notNull().default('usd'),
  amountDue: integer("amount_due").notNull(), // in cents
  amountPaid: integer("amount_paid").notNull().default(0),
  status: text("status").notNull(), // 'draft', 'open', 'paid', 'uncollectible', 'void'
  lineItems: jsonb("line_items"), // Array of {description, quantity, unitPrice, amount}
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  finalizedAt: timestamp("finalized_at"),
  voidedAt: timestamp("voided_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  stripeInvoiceIdx: sql`CREATE INDEX IF NOT EXISTS idx_invoices_stripe ON ${table} (stripe_invoice_id)`,
  invoiceNumberIdx: sql`CREATE INDEX IF NOT EXISTS idx_invoices_number ON ${table} (invoice_number)`,
  uniqueSubscriptionPeriod: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_subscription_period ON ${table} (subscription_id, period_start, period_end)`,
}));

// Usage meters for consumption tracking
export const usageMeters = pgTable("usage_meters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").references(() => subscriptions.id, { onDelete: "cascade" }),
  healthSystemId: varchar("health_system_id").references(() => healthSystems.id, { onDelete: "cascade" }),
  vendorId: varchar("vendor_id").references(() => vendors.id, { onDelete: "cascade" }),
  meterType: text("meter_type").notNull(), // 'ai_systems_monitored', 'compliance_checks_run', 'alerts_generated', etc.
  metricName: text("metric_name").notNull(), // 'ai_systems', 'alerts', 'reports', 'api_calls', 'users', 'certifications'
  unitPrice: text("unit_price").notNull().default('0'), // Price per unit (stored as string for precision)
  currentValue: integer("current_value").notNull().default(0),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  resetFrequency: text("reset_frequency").notNull().default('monthly'), // 'monthly', 'annual'
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  meterIdx: sql`CREATE INDEX IF NOT EXISTS idx_usage_meters ON ${table} (health_system_id, vendor_id, metric_name, period_start)`,
  subscriptionIdx: sql`CREATE INDEX IF NOT EXISTS idx_usage_meters_subscription ON ${table} (subscription_id)`,
}));

// Usage events for granular tracking
export const usageEvents = pgTable("usage_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meterId: varchar("meter_id").references(() => usageMeters.id, { onDelete: "cascade" }),
  healthSystemId: varchar("health_system_id").references(() => healthSystems.id, { onDelete: "cascade" }),
  vendorId: varchar("vendor_id").references(() => vendors.id, { onDelete: "cascade" }),
  metricName: text("metric_name").notNull(),
  quantity: integer("quantity").notNull().default(1), // Number of units consumed
  increment: integer("increment").notNull().default(1),
  timestamp: timestamp("timestamp").notNull().defaultNow(), // When the event occurred
  metadata: jsonb("metadata"),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
}, (table) => ({
  eventIdx: sql`CREATE INDEX IF NOT EXISTS idx_usage_events ON ${table} (health_system_id, vendor_id, recorded_at DESC)`,
  meterIdx: sql`CREATE INDEX IF NOT EXISTS idx_usage_events_meter ON ${table} (meter_id, timestamp DESC)`,
}));

// 🔒 TRANSLATION ENGINE IP MOAT - Versioned Policy System
// Stores encrypted, versioned compliance mapping policies (CORE IP)
export const policyVersions = pgTable("policy_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  version: text("version").notNull(), // Semantic versioning: '1.0.0', '1.1.0', '2.0.0'
  eventType: text("event_type").notNull(), // 'phi_exposure', 'bias_detected', etc.
  framework: text("framework").notNull(), // 'HIPAA', 'NIST_AI_RMF', 'FDA_SaMD'
  encryptedRuleLogic: text("encrypted_rule_logic").notNull(), // AES-256-GCM encrypted mapping logic
  ruleHash: text("rule_hash").notNull(), // SHA-256 hash for integrity verification
  status: text("status").notNull().default('active'), // 'active', 'deprecated', 'archived'
  effectiveDate: timestamp("effective_date").notNull().defaultNow(),
  deprecatedDate: timestamp("deprecated_date"),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  // Index for looking up active policies by event type
  eventTypeStatusIdx: sql`CREATE INDEX IF NOT EXISTS idx_policy_versions_event_status ON ${table} (event_type, status)`,
  // Unique constraint: one active policy per event+framework
  activeVersionIdx: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_active_version ON ${table} (event_type, framework) WHERE status = 'active'`,
}));

// Audit log for policy changes (critical for M&A due diligence)
export const policyChangeLogs = pgTable("policy_change_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  policyVersionId: varchar("policy_version_id").notNull().references(() => policyVersions.id, { onDelete: "cascade" }),
  changeType: text("change_type").notNull(), // 'created', 'activated', 'deprecated', 'archived'
  previousVersion: text("previous_version"), // Version being replaced
  newVersion: text("new_version").notNull(),
  changeReason: text("change_reason").notNull(), // Business justification for policy change
  changedBy: varchar("changed_by").notNull().references(() => users.id, { onDelete: "set null" }),
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  metadata: jsonb("metadata"), // Impact analysis, affected systems count, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPolicyVersionSchema = createInsertSchema(policyVersions);
export const insertPolicyChangeLogSchema = createInsertSchema(policyChangeLogs);
export const insertBillingAccountSchema = createInsertSchema(billingAccounts);
export const insertSubscriptionSchema = createInsertSchema(subscriptions);
export const insertInvoiceSchema = createInsertSchema(invoices);
export const insertUsageMeterSchema = createInsertSchema(usageMeters);
export const insertUsageEventSchema = createInsertSchema(usageEvents);

// Type exports
export type WebhookSecret = typeof webhookSecrets.$inferSelect;
export type InsertWebhookSecret = z.infer<typeof insertWebhookSecretSchema>;

export type WebhookDeliveryLog = typeof webhookDeliveryLogs.$inferSelect;
export type InsertWebhookDeliveryLog = z.infer<typeof insertWebhookDeliveryLogSchema>;

export type ComplianceControlVersion = typeof complianceControlVersions.$inferSelect;
export type InsertComplianceControlVersion = z.infer<typeof insertComplianceControlVersionSchema>;

export type ValidationDataset = typeof validationDatasets.$inferSelect;
export type InsertValidationDataset = z.infer<typeof insertValidationDatasetSchema>;

export type BillingAccount = typeof billingAccounts.$inferSelect;
export type InsertBillingAccount = z.infer<typeof insertBillingAccountSchema>;

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type UsageMeter = typeof usageMeters.$inferSelect;
export type InsertUsageMeter = z.infer<typeof insertUsageMeterSchema>;

export type UsageEvent = typeof usageEvents.$inferSelect;
export type InsertUsageEvent = z.infer<typeof insertUsageEventSchema>;

export type PolicyVersion = typeof policyVersions.$inferSelect;
export type InsertPolicyVersion = z.infer<typeof insertPolicyVersionSchema>;

export type PolicyChangeLog = typeof policyChangeLogs.$inferSelect;
export type InsertPolicyChangeLog = z.infer<typeof insertPolicyChangeLogSchema>;
