CREATE TABLE "deployment_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ai_system_id" varchar NOT NULL,
	"version" text NOT NULL,
	"deployed_at" timestamp NOT NULL,
	"deployed_by" varchar,
	"status" text DEFAULT 'active' NOT NULL,
	"deployment_type" text NOT NULL,
	"rollback_from_version" text,
	"metadata" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rollback_executions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ai_system_id" varchar NOT NULL,
	"action_id" varchar,
	"from_version" text NOT NULL,
	"to_version" text NOT NULL,
	"trigger" text NOT NULL,
	"triggered_by" varchar,
	"approved_by" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rollback_policies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ai_system_id" varchar NOT NULL,
	"health_system_id" varchar NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"auto_rollback_on_critical" boolean DEFAULT false NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"approvers" text[],
	"rollback_triggers" jsonb,
	"max_auto_rollbacks" integer DEFAULT 3,
	"cooldown_minutes" integer DEFAULT 60,
	"notification_channels" text[] DEFAULT ARRAY['email', 'slack'],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "telemetry_polling_configs" ADD COLUMN "platform" text DEFAULT 'langsmith' NOT NULL;--> statement-breakpoint
ALTER TABLE "deployment_history" ADD CONSTRAINT "deployment_history_ai_system_id_ai_systems_id_fk" FOREIGN KEY ("ai_system_id") REFERENCES "public"."ai_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_history" ADD CONSTRAINT "deployment_history_deployed_by_users_id_fk" FOREIGN KEY ("deployed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rollback_executions" ADD CONSTRAINT "rollback_executions_ai_system_id_ai_systems_id_fk" FOREIGN KEY ("ai_system_id") REFERENCES "public"."ai_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rollback_executions" ADD CONSTRAINT "rollback_executions_action_id_required_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."required_actions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rollback_executions" ADD CONSTRAINT "rollback_executions_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rollback_executions" ADD CONSTRAINT "rollback_executions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rollback_policies" ADD CONSTRAINT "rollback_policies_ai_system_id_ai_systems_id_fk" FOREIGN KEY ("ai_system_id") REFERENCES "public"."ai_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rollback_policies" ADD CONSTRAINT "rollback_policies_health_system_id_health_systems_id_fk" FOREIGN KEY ("health_system_id") REFERENCES "public"."health_systems"("id") ON DELETE cascade ON UPDATE no action;