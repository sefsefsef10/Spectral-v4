CREATE TABLE "adaptive_threshold_models" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"health_system_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"model_type" text NOT NULL,
	"model_config" jsonb,
	"thresholds" jsonb,
	"training_data_summary" jsonb,
	"last_trained_at" timestamp,
	"accuracy" text,
	"false_positive_rate" text,
	"false_negative_rate" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_discovery_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"health_system_id" varchar NOT NULL,
	"discovery_type" text NOT NULL,
	"data_source" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"ai_systems_found" integer DEFAULT 0,
	"ai_systems_new" integer DEFAULT 0,
	"ai_systems_updated" integer DEFAULT 0,
	"results" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_evidence_packages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"health_system_id" varchar NOT NULL,
	"framework" text NOT NULL,
	"package_type" text NOT NULL,
	"audit_period" text,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"evidence_items" jsonb,
	"controls_covered" jsonb,
	"completeness_score" text,
	"package_url" text,
	"generated_by" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"delivered_to" text,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "control_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"control_id" varchar NOT NULL,
	"version" integer NOT NULL,
	"changes" jsonb,
	"regulatory_source" text,
	"change_reason" text,
	"changed_by" varchar,
	"effective_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_types" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"category" text,
	"description" text NOT NULL,
	"telemetry_fields" jsonb,
	"normalizer" text,
	"default_severity" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_types_event_type_unique" UNIQUE("event_type")
);
--> statement-breakpoint
CREATE TABLE "executive_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"health_system_id" varchar NOT NULL,
	"report_type" text NOT NULL,
	"report_title" text NOT NULL,
	"report_period" text,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"narrative" text,
	"key_metrics" jsonb,
	"risk_summary" jsonb,
	"compliance_status" jsonb,
	"action_items" jsonb,
	"trend_analysis" jsonb,
	"pdf_url" text,
	"generated_by" varchar,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_system_rollup_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"health_system_id" varchar NOT NULL,
	"period" text NOT NULL,
	"total_ai_systems" integer DEFAULT 0,
	"active_ai_systems" integer DEFAULT 0,
	"average_risk_score" text,
	"portfolio_compliance_score" text,
	"open_violations" integer DEFAULT 0,
	"resolved_violations_this_period" integer DEFAULT 0,
	"average_resolution_time" text,
	"certified_vendor_percentage" text,
	"policy_compliance_rate" text,
	"executive_reports_generated" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_system_vendor_relationships" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"health_system_id" varchar NOT NULL,
	"vendor_id" varchar NOT NULL,
	"relationship_type" text NOT NULL,
	"contract_value" integer,
	"start_date" timestamp,
	"end_date" timestamp,
	"ai_systems_count" integer DEFAULT 0,
	"spectral_verified_required" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "network_effects_proof_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period" text NOT NULL,
	"total_health_systems" integer DEFAULT 0,
	"active_health_systems" integer DEFAULT 0,
	"total_vendors" integer DEFAULT 0,
	"certified_vendors" integer DEFAULT 0,
	"total_connections" integer DEFAULT 0,
	"spectral_standard_adopters" integer DEFAULT 0,
	"avg_acceptances_per_vendor" text,
	"network_density_score" text,
	"viral_coefficient" text,
	"cross_side_liquidity" text,
	"health_system_growth_rate" text,
	"vendor_growth_rate" text,
	"acceptance_growth_rate" text,
	"avg_sales_cycle_length" integer,
	"avg_deal_size" integer,
	"win_rate_with_network_effects" text,
	"churn_rate" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "network_metrics_daily_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_date" timestamp NOT NULL,
	"total_health_systems" integer NOT NULL,
	"active_health_systems" integer NOT NULL,
	"total_vendors" integer NOT NULL,
	"certified_vendors" integer NOT NULL,
	"total_acceptances" integer NOT NULL,
	"spectral_standard_adopters" integer NOT NULL,
	"network_density" text,
	"average_acceptance_rate" text,
	"new_health_systems_this_week" integer,
	"new_vendors_this_week" integer,
	"new_certifications_this_week" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_enforcement_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" varchar NOT NULL,
	"ai_system_id" varchar NOT NULL,
	"violation_type" text NOT NULL,
	"action_taken" text NOT NULL,
	"details" jsonb,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"health_system_id" varchar NOT NULL,
	"policy_name" text NOT NULL,
	"policy_type" text NOT NULL,
	"scope" text NOT NULL,
	"scope_filter" jsonb,
	"conditions" jsonb,
	"enforcement_actions" jsonb,
	"approval_workflow" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regulatory_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"framework" text NOT NULL,
	"alert_type" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"impact_level" text NOT NULL,
	"affected_controls" jsonb,
	"affected_health_systems" jsonb,
	"action_required" text,
	"deadline" timestamp,
	"source_url" text,
	"published_date" timestamp NOT NULL,
	"acknowledged_by" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regulatory_updates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"framework" text NOT NULL,
	"update_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"source" text,
	"impacted_controls" jsonb,
	"action_required" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"published_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"health_system_id" varchar NOT NULL,
	"report_type" text NOT NULL,
	"frequency" text NOT NULL,
	"day_of_week" integer,
	"day_of_month" integer,
	"month_of_quarter" integer,
	"recipients" jsonb,
	"include_executive_summary" boolean DEFAULT true,
	"include_detailed_metrics" boolean DEFAULT false,
	"last_run_at" timestamp,
	"next_run_at" timestamp NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spectral_standard_adoptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"health_system_id" varchar NOT NULL,
	"adoption_type" text NOT NULL,
	"scope" text,
	"categories" jsonb,
	"announced_date" timestamp NOT NULL,
	"effective_date" timestamp NOT NULL,
	"publicly_announced" boolean DEFAULT false,
	"press_release_url" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "state_regulations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" text NOT NULL,
	"regulation_name" text NOT NULL,
	"control_id" text NOT NULL,
	"control_name" text NOT NULL,
	"description" text NOT NULL,
	"requires_reporting" boolean DEFAULT false,
	"reporting_deadline_days" integer,
	"effective_date" timestamp NOT NULL,
	"sunset_date" timestamp,
	"mapped_event_types" jsonb,
	"detection_logic" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_acceptances" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"health_system_id" varchar NOT NULL,
	"vendor_id" varchar NOT NULL,
	"certification_id" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"accepted_date" timestamp,
	"expiration_date" timestamp,
	"accepted_by" varchar,
	"rejection_reason" text,
	"required_in_rfp" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_performance_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" varchar NOT NULL,
	"period" text NOT NULL,
	"customer_count" integer DEFAULT 0,
	"active_deployments" integer DEFAULT 0,
	"average_compliance_score" text,
	"violations_count" integer DEFAULT 0,
	"critical_violations" integer DEFAULT 0,
	"certification_renewal_rate" text,
	"customer_satisfaction" text,
	"uptime_percentage" text,
	"support_response_time" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "adaptive_threshold_models" ADD CONSTRAINT "adaptive_threshold_models_health_system_id_health_systems_id_fk" FOREIGN KEY ("health_system_id") REFERENCES "public"."health_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_discovery_jobs" ADD CONSTRAINT "ai_discovery_jobs_health_system_id_health_systems_id_fk" FOREIGN KEY ("health_system_id") REFERENCES "public"."health_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_discovery_jobs" ADD CONSTRAINT "ai_discovery_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_evidence_packages" ADD CONSTRAINT "audit_evidence_packages_health_system_id_health_systems_id_fk" FOREIGN KEY ("health_system_id") REFERENCES "public"."health_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_evidence_packages" ADD CONSTRAINT "audit_evidence_packages_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_versions" ADD CONSTRAINT "control_versions_control_id_compliance_controls_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."compliance_controls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_versions" ADD CONSTRAINT "control_versions_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executive_reports" ADD CONSTRAINT "executive_reports_health_system_id_health_systems_id_fk" FOREIGN KEY ("health_system_id") REFERENCES "public"."health_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executive_reports" ADD CONSTRAINT "executive_reports_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executive_reports" ADD CONSTRAINT "executive_reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_system_rollup_metrics" ADD CONSTRAINT "health_system_rollup_metrics_health_system_id_health_systems_id_fk" FOREIGN KEY ("health_system_id") REFERENCES "public"."health_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_system_vendor_relationships" ADD CONSTRAINT "health_system_vendor_relationships_health_system_id_health_systems_id_fk" FOREIGN KEY ("health_system_id") REFERENCES "public"."health_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_system_vendor_relationships" ADD CONSTRAINT "health_system_vendor_relationships_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_enforcement_logs" ADD CONSTRAINT "policy_enforcement_logs_policy_id_policy_rules_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policy_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_enforcement_logs" ADD CONSTRAINT "policy_enforcement_logs_ai_system_id_ai_systems_id_fk" FOREIGN KEY ("ai_system_id") REFERENCES "public"."ai_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_enforcement_logs" ADD CONSTRAINT "policy_enforcement_logs_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_rules" ADD CONSTRAINT "policy_rules_health_system_id_health_systems_id_fk" FOREIGN KEY ("health_system_id") REFERENCES "public"."health_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_rules" ADD CONSTRAINT "policy_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_updates" ADD CONSTRAINT "regulatory_updates_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_health_system_id_health_systems_id_fk" FOREIGN KEY ("health_system_id") REFERENCES "public"."health_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spectral_standard_adoptions" ADD CONSTRAINT "spectral_standard_adoptions_health_system_id_health_systems_id_fk" FOREIGN KEY ("health_system_id") REFERENCES "public"."health_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_acceptances" ADD CONSTRAINT "vendor_acceptances_health_system_id_health_systems_id_fk" FOREIGN KEY ("health_system_id") REFERENCES "public"."health_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_acceptances" ADD CONSTRAINT "vendor_acceptances_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_acceptances" ADD CONSTRAINT "vendor_acceptances_certification_id_compliance_certifications_id_fk" FOREIGN KEY ("certification_id") REFERENCES "public"."compliance_certifications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_acceptances" ADD CONSTRAINT "vendor_acceptances_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_performance_metrics" ADD CONSTRAINT "vendor_performance_metrics_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;