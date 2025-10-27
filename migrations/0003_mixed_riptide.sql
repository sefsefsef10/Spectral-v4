CREATE TABLE "billing_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"health_system_id" varchar,
	"vendor_id" varchar,
	"stripe_customer_id" text,
	"payment_method_id" text,
	"billing_email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_accounts_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "compliance_control_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"control_id" text NOT NULL,
	"version" text NOT NULL,
	"changes" jsonb,
	"effective_date" timestamp NOT NULL,
	"deprecated_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "control_toggles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"health_system_id" varchar NOT NULL,
	"ai_system_id" varchar,
	"control_id" varchar NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"disable_reason" text,
	"disabled_by" varchar,
	"disabled_at" timestamp,
	"regulatory_guardrail" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_compliance_controls" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"health_system_id" varchar NOT NULL,
	"framework" text DEFAULT 'INTERNAL' NOT NULL,
	"control_id" text NOT NULL,
	"control_name" text NOT NULL,
	"description" text NOT NULL,
	"mapped_event_types" jsonb NOT NULL,
	"severity" text NOT NULL,
	"requires_reporting" boolean DEFAULT false NOT NULL,
	"reporting_deadline_days" integer,
	"detection_logic" text,
	"remediation_steps" jsonb,
	"created_by" varchar NOT NULL,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"approval_date" timestamp,
	"effective_date" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customization_approvals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"health_system_id" varchar NOT NULL,
	"customization_type" text NOT NULL,
	"customization_id" varchar NOT NULL,
	"requested_by" varchar NOT NULL,
	"request_justification" text NOT NULL,
	"regulatory_context" text,
	"impact_assessment" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"assigned_reviewer" varchar,
	"review_started_at" timestamp,
	"review_completed_at" timestamp,
	"review_decision" text,
	"review_notes" text,
	"reviewer_feedback" jsonb,
	"sla_deadline" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customization_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"health_system_id" varchar NOT NULL,
	"customization_type" text NOT NULL,
	"customization_id" varchar NOT NULL,
	"action" text NOT NULL,
	"field" text,
	"original_value" text,
	"new_value" text,
	"changed_by" varchar NOT NULL,
	"change_reason" text,
	"regulatory_impact" text,
	"approval_required" boolean DEFAULT false NOT NULL,
	"approval_status" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_account_id" varchar NOT NULL,
	"subscription_id" varchar NOT NULL,
	"invoice_number" text NOT NULL,
	"stripe_invoice_id" text,
	"stripe_payment_intent_id" text,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"subtotal" text NOT NULL,
	"tax" text DEFAULT '0' NOT NULL,
	"total" text NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"amount_due" integer NOT NULL,
	"amount_paid" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"line_items" jsonb,
	"due_date" timestamp,
	"paid_at" timestamp,
	"finalized_at" timestamp,
	"voided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number"),
	CONSTRAINT "invoices_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id")
);
--> statement-breakpoint
CREATE TABLE "policy_change_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_version_id" varchar NOT NULL,
	"change_type" text NOT NULL,
	"previous_version" text,
	"new_version" text NOT NULL,
	"change_reason" text NOT NULL,
	"changed_by" varchar NOT NULL,
	"reviewed_by" varchar,
	"approved_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"event_type" text NOT NULL,
	"framework" text NOT NULL,
	"encrypted_rule_logic" text NOT NULL,
	"rule_hash" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"effective_date" timestamp DEFAULT now() NOT NULL,
	"deprecated_date" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"health_system_id" varchar NOT NULL,
	"provider_type" text NOT NULL,
	"base_url" text NOT NULL,
	"credentials" text NOT NULL,
	"status" text DEFAULT 'inactive' NOT NULL,
	"last_sync_at" timestamp,
	"last_sync_status" text,
	"last_sync_systems_discovered" integer,
	"last_sync_systems_created" integer,
	"last_sync_systems_updated" integer,
	"last_sync_error" text,
	"last_sync_duration_ms" integer,
	"sync_enabled" boolean DEFAULT false NOT NULL,
	"sync_interval_minutes" integer DEFAULT 1440 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roi_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"health_system_id" varchar,
	"vendor_id" varchar,
	"metric_type" text NOT NULL,
	"metric_category" text NOT NULL,
	"value" integer NOT NULL,
	"unit" text NOT NULL,
	"description" text NOT NULL,
	"ai_system_id" varchar,
	"certification_id" varchar,
	"metadata" jsonb,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_account_id" varchar NOT NULL,
	"stripe_subscription_id" text,
	"plan_tier" text NOT NULL,
	"plan_price" text DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" text NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"cancel_at" timestamp,
	"canceled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "telemetry_polling_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ai_system_id" varchar NOT NULL,
	"project_name" text NOT NULL,
	"poll_interval_minutes" integer DEFAULT 15 NOT NULL,
	"lookback_minutes" integer DEFAULT 15 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_polled_at" timestamp,
	"last_poll_status" text,
	"last_poll_events_ingested" integer DEFAULT 0,
	"last_poll_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "threshold_overrides" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"health_system_id" varchar NOT NULL,
	"ai_system_id" varchar,
	"event_type" text NOT NULL,
	"control_id" varchar,
	"original_threshold" text,
	"custom_threshold" text NOT NULL,
	"threshold_unit" text,
	"override_reason" text NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"effective_date" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meter_id" varchar,
	"health_system_id" varchar,
	"vendor_id" varchar,
	"metric_name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"increment" integer DEFAULT 1 NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_meters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" varchar,
	"health_system_id" varchar,
	"vendor_id" varchar,
	"meter_type" text NOT NULL,
	"metric_name" text NOT NULL,
	"unit_price" text DEFAULT '0' NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"reset_frequency" text DEFAULT 'monthly' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validation_datasets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"test_cases" jsonb NOT NULL,
	"metadata_source" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_delivery_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_name" text NOT NULL,
	"endpoint" text NOT NULL,
	"signature_valid" boolean,
	"payload_valid" boolean,
	"status_code" integer,
	"error_message" text,
	"ip_address" text,
	"request_headers" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_secrets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_name" text NOT NULL,
	"secret_key" text NOT NULL,
	"algorithm" text DEFAULT 'hmac-sha256' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"rotated_at" timestamp,
	CONSTRAINT "webhook_secrets_service_name_unique" UNIQUE("service_name")
);
--> statement-breakpoint
ALTER TABLE "ai_systems" ADD COLUMN "verification_tier" text;--> statement-breakpoint
ALTER TABLE "ai_systems" ADD COLUMN "verification_date" timestamp;--> statement-breakpoint
ALTER TABLE "ai_systems" ADD COLUMN "verification_expiry" timestamp;--> statement-breakpoint
ALTER TABLE "ai_systems" ADD COLUMN "provider_type" text;--> statement-breakpoint
ALTER TABLE "ai_systems" ADD COLUMN "provider_system_id" text;--> statement-breakpoint
ALTER TABLE "ai_systems" ADD COLUMN "last_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "ai_telemetry_events" ADD COLUMN "encrypted_payload" text;--> statement-breakpoint
ALTER TABLE "ai_telemetry_events" ADD COLUMN "phi_redacted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_telemetry_events" ADD COLUMN "phi_entities_detected" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "compliance_violations" ADD COLUMN "encrypted_description" text;--> statement-breakpoint
ALTER TABLE "health_systems" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "health_systems" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "health_systems" ADD COLUMN "subscription_tier" text;--> statement-breakpoint
ALTER TABLE "health_systems" ADD COLUMN "subscription_status" text;--> statement-breakpoint
ALTER TABLE "health_systems" ADD COLUMN "current_period_start" timestamp;--> statement-breakpoint
ALTER TABLE "health_systems" ADD COLUMN "current_period_end" timestamp;--> statement-breakpoint
ALTER TABLE "health_systems" ADD COLUMN "trial_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "health_systems" ADD COLUMN "ai_system_limit" integer;--> statement-breakpoint
ALTER TABLE "monitoring_alerts" ADD COLUMN "resolved_at" timestamp;--> statement-breakpoint
ALTER TABLE "monitoring_alerts" ADD COLUMN "response_time_seconds" integer;--> statement-breakpoint
ALTER TABLE "monitoring_alerts" ADD COLUMN "resolved_by" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verification_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verification_token_expiry" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_reset_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_reset_token_expiry" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sso_provider" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sso_external_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sso_organization_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "subscription_status" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "current_period_start" timestamp;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "current_period_end" timestamp;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "certification_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_health_system_id_health_systems_id_fk" FOREIGN KEY ("health_system_id") REFERENCES "public"."health_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_toggles" ADD CONSTRAINT "control_toggles_health_system_id_health_systems_id_fk" FOREIGN KEY ("health_system_id") REFERENCES "public"."health_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_toggles" ADD CONSTRAINT "control_toggles_ai_system_id_ai_systems_id_fk" FOREIGN KEY ("ai_system_id") REFERENCES "public"."ai_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_toggles" ADD CONSTRAINT "control_toggles_control_id_compliance_controls_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."compliance_controls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_toggles" ADD CONSTRAINT "control_toggles_disabled_by_users_id_fk" FOREIGN KEY ("disabled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_compliance_controls" ADD CONSTRAINT "custom_compliance_controls_health_system_id_health_systems_id_fk" FOREIGN KEY ("health_system_id") REFERENCES "public"."health_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_compliance_controls" ADD CONSTRAINT "custom_compliance_controls_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_compliance_controls" ADD CONSTRAINT "custom_compliance_controls_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customization_approvals" ADD CONSTRAINT "customization_approvals_health_system_id_health_systems_id_fk" FOREIGN KEY ("health_system_id") REFERENCES "public"."health_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customization_approvals" ADD CONSTRAINT "customization_approvals_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customization_approvals" ADD CONSTRAINT "customization_approvals_assigned_reviewer_users_id_fk" FOREIGN KEY ("assigned_reviewer") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customization_audit_log" ADD CONSTRAINT "customization_audit_log_health_system_id_health_systems_id_fk" FOREIGN KEY ("health_system_id") REFERENCES "public"."health_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customization_audit_log" ADD CONSTRAINT "customization_audit_log_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_change_logs" ADD CONSTRAINT "policy_change_logs_policy_version_id_policy_versions_id_fk" FOREIGN KEY ("policy_version_id") REFERENCES "public"."policy_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_change_logs" ADD CONSTRAINT "policy_change_logs_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_change_logs" ADD CONSTRAINT "policy_change_logs_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_health_system_id_health_systems_id_fk" FOREIGN KEY ("health_system_id") REFERENCES "public"."health_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roi_metrics" ADD CONSTRAINT "roi_metrics_health_system_id_health_systems_id_fk" FOREIGN KEY ("health_system_id") REFERENCES "public"."health_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roi_metrics" ADD CONSTRAINT "roi_metrics_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roi_metrics" ADD CONSTRAINT "roi_metrics_ai_system_id_ai_systems_id_fk" FOREIGN KEY ("ai_system_id") REFERENCES "public"."ai_systems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roi_metrics" ADD CONSTRAINT "roi_metrics_certification_id_compliance_certifications_id_fk" FOREIGN KEY ("certification_id") REFERENCES "public"."compliance_certifications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_polling_configs" ADD CONSTRAINT "telemetry_polling_configs_ai_system_id_ai_systems_id_fk" FOREIGN KEY ("ai_system_id") REFERENCES "public"."ai_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threshold_overrides" ADD CONSTRAINT "threshold_overrides_health_system_id_health_systems_id_fk" FOREIGN KEY ("health_system_id") REFERENCES "public"."health_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threshold_overrides" ADD CONSTRAINT "threshold_overrides_ai_system_id_ai_systems_id_fk" FOREIGN KEY ("ai_system_id") REFERENCES "public"."ai_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threshold_overrides" ADD CONSTRAINT "threshold_overrides_control_id_compliance_controls_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."compliance_controls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threshold_overrides" ADD CONSTRAINT "threshold_overrides_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_meter_id_usage_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."usage_meters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_health_system_id_health_systems_id_fk" FOREIGN KEY ("health_system_id") REFERENCES "public"."health_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_meters" ADD CONSTRAINT "usage_meters_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_meters" ADD CONSTRAINT "usage_meters_health_system_id_health_systems_id_fk" FOREIGN KEY ("health_system_id") REFERENCES "public"."health_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_meters" ADD CONSTRAINT "usage_meters_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_alerts" ADD CONSTRAINT "monitoring_alerts_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;