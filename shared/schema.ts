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
  settings: text("settings"), // JSON: org preferences, branding, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const vendors = pgTable("vendors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  certificationTier: text("certification_tier"),
  verified: boolean("verified").notNull().default(false),
  logoUrl: text("logo_url"),
  website: text("website"),
  trustPageUrl: text("trust_page_url"),
  settings: text("settings"), // JSON: org preferences, branding, etc.
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
  payload: text("payload"), // Full JSON payload from webhook
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
  description: text("description").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 🔒 TRANSLATION ENGINE - Required Actions
// Stores remediation actions generated from compliance violations
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
