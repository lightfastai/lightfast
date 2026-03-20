-- Phase 4: Migrate Tier 1 Tables (6 internal-only tables) to BIGINT
-- Pre-production: DROP and CREATE approach (no data to preserve)

-- 1. workspace_operations_metrics
DROP TABLE IF EXISTS "lightfast_workspace_operations_metrics" CASCADE;--> statement-breakpoint
CREATE TABLE "lightfast_workspace_operations_metrics" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "clerk_org_id" varchar(191) NOT NULL,
  "workspace_id" varchar(191) NOT NULL REFERENCES "lightfast_org_workspaces"("id") ON DELETE CASCADE,
  "repository_id" varchar(191),
  "type" varchar(50) NOT NULL,
  "value" integer NOT NULL,
  "unit" varchar(20),
  "tags" jsonb,
  "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
CREATE INDEX "ops_metric_clerk_org_id_idx" ON "lightfast_workspace_operations_metrics" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE INDEX "ops_metric_workspace_id_idx" ON "lightfast_workspace_operations_metrics" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "ops_metric_repository_id_idx" ON "lightfast_workspace_operations_metrics" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "ops_metric_type_idx" ON "lightfast_workspace_operations_metrics" USING btree ("type");--> statement-breakpoint
CREATE INDEX "ops_metric_workspace_type_timestamp_idx" ON "lightfast_workspace_operations_metrics" USING btree ("workspace_id", "type", "timestamp");--> statement-breakpoint
CREATE INDEX "ops_metric_timestamp_idx" ON "lightfast_workspace_operations_metrics" USING btree ("timestamp");--> statement-breakpoint

-- 2. workspace_user_activities
DROP TABLE IF EXISTS "lightfast_workspace_user_activities" CASCADE;--> statement-breakpoint
CREATE TABLE "lightfast_workspace_user_activities" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "workspace_id" varchar(191) NOT NULL REFERENCES "lightfast_org_workspaces"("id") ON DELETE CASCADE,
  "actor_type" varchar(20) NOT NULL,
  "actor_user_id" varchar(191),
  "actor_email" varchar(255),
  "actor_ip" varchar(45),
  "category" varchar(50) NOT NULL,
  "action" varchar(100) NOT NULL,
  "entity_type" varchar(50) NOT NULL,
  "entity_id" varchar(191) NOT NULL,
  "entity_name" varchar(500),
  "metadata" jsonb NOT NULL,
  "request_id" varchar(191),
  "user_agent" text,
  "related_activity_id" varchar(191),
  "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
CREATE INDEX "activity_workspace_timestamp_idx" ON "lightfast_workspace_user_activities" USING btree ("workspace_id", "timestamp");--> statement-breakpoint
CREATE INDEX "activity_actor_idx" ON "lightfast_workspace_user_activities" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "activity_category_idx" ON "lightfast_workspace_user_activities" USING btree ("category");--> statement-breakpoint
CREATE INDEX "activity_entity_idx" ON "lightfast_workspace_user_activities" USING btree ("entity_type", "entity_id");--> statement-breakpoint
CREATE INDEX "activity_category_timestamp_idx" ON "lightfast_workspace_user_activities" USING btree ("category", "timestamp");--> statement-breakpoint
CREATE INDEX "activity_related_idx" ON "lightfast_workspace_user_activities" USING btree ("related_activity_id");--> statement-breakpoint
CREATE INDEX "activity_timestamp_idx" ON "lightfast_workspace_user_activities" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "activity_workspace_category_timestamp_idx" ON "lightfast_workspace_user_activities" USING btree ("workspace_id", "category", "timestamp");--> statement-breakpoint

-- 3. workspace_webhook_payloads
DROP TABLE IF EXISTS "lightfast_workspace_webhook_payloads" CASCADE;--> statement-breakpoint
CREATE TABLE "lightfast_workspace_webhook_payloads" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "workspace_id" varchar(191) NOT NULL REFERENCES "lightfast_org_workspaces"("id") ON DELETE CASCADE,
  "delivery_id" varchar(191) NOT NULL,
  "source" varchar(50) NOT NULL,
  "event_type" varchar(100) NOT NULL,
  "payload" jsonb NOT NULL,
  "headers" jsonb NOT NULL,
  "received_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "webhook_payload_workspace_received_idx" ON "lightfast_workspace_webhook_payloads" USING btree ("workspace_id", "received_at");--> statement-breakpoint
CREATE INDEX "webhook_payload_delivery_idx" ON "lightfast_workspace_webhook_payloads" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "webhook_payload_workspace_source_idx" ON "lightfast_workspace_webhook_payloads" USING btree ("workspace_id", "source", "event_type");--> statement-breakpoint

-- 4. workspace_actor_identities
DROP TABLE IF EXISTS "lightfast_workspace_actor_identities" CASCADE;--> statement-breakpoint
CREATE TABLE "lightfast_workspace_actor_identities" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "workspace_id" varchar(191) NOT NULL REFERENCES "lightfast_org_workspaces"("id") ON DELETE CASCADE,
  "actor_id" varchar(191) NOT NULL,
  "source" varchar(50) NOT NULL,
  "source_id" varchar(255) NOT NULL,
  "source_username" varchar(255),
  "source_email" varchar(255),
  "mapping_method" varchar(50) NOT NULL,
  "confidence_score" real NOT NULL,
  "mapped_by" varchar(191),
  "mapped_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "actor_identity_unique_idx" ON "lightfast_workspace_actor_identities" USING btree ("workspace_id", "source", "source_id");--> statement-breakpoint
CREATE INDEX "actor_identity_actor_idx" ON "lightfast_workspace_actor_identities" USING btree ("workspace_id", "actor_id");--> statement-breakpoint
CREATE INDEX "actor_identity_email_idx" ON "lightfast_workspace_actor_identities" USING btree ("workspace_id", "source_email");--> statement-breakpoint

-- 5. workspace_temporal_states
DROP TABLE IF EXISTS "lightfast_workspace_temporal_states" CASCADE;--> statement-breakpoint
CREATE TABLE "lightfast_workspace_temporal_states" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "workspace_id" varchar(191) NOT NULL REFERENCES "lightfast_org_workspaces"("id") ON DELETE CASCADE,
  "entity_type" varchar(50) NOT NULL,
  "entity_id" varchar(191) NOT NULL,
  "entity_name" varchar(255),
  "state_type" varchar(50) NOT NULL,
  "state_value" varchar(255) NOT NULL,
  "previous_value" varchar(255),
  "state_metadata" jsonb,
  "valid_from" timestamp with time zone NOT NULL,
  "valid_to" timestamp with time zone,
  "is_current" boolean DEFAULT true NOT NULL,
  "changed_by_actor_id" varchar(191),
  "change_reason" text,
  "source_observation_id" varchar(191),
  "source" varchar(50),
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
CREATE INDEX "temporal_entity_time_idx" ON "lightfast_workspace_temporal_states" USING btree ("workspace_id", "entity_type", "entity_id", "state_type", "valid_from");--> statement-breakpoint
CREATE INDEX "temporal_current_idx" ON "lightfast_workspace_temporal_states" USING btree ("workspace_id", "entity_type", "entity_id", "is_current");--> statement-breakpoint
CREATE INDEX "temporal_workspace_entity_idx" ON "lightfast_workspace_temporal_states" USING btree ("workspace_id", "entity_type");--> statement-breakpoint
CREATE INDEX "temporal_source_obs_idx" ON "lightfast_workspace_temporal_states" USING btree ("source_observation_id");--> statement-breakpoint

-- 6. workspace_workflow_runs
DROP TABLE IF EXISTS "lightfast_workspace_workflow_runs" CASCADE;--> statement-breakpoint
CREATE TABLE "lightfast_workspace_workflow_runs" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "clerk_org_id" varchar(191) NOT NULL,
  "workspace_id" varchar(191) NOT NULL REFERENCES "lightfast_org_workspaces"("id") ON DELETE CASCADE,
  "repository_id" varchar(191),
  "inngest_run_id" varchar(191) NOT NULL,
  "inngest_function_id" varchar(191) NOT NULL,
  "name" varchar(191) NOT NULL,
  "status" varchar(50) DEFAULT 'queued' NOT NULL,
  "trigger" varchar(50) NOT NULL,
  "triggered_by" varchar(191),
  "input" jsonb,
  "output" jsonb,
  "error_message" varchar(1000),
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "duration_ms" varchar(50),
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
CREATE INDEX "job_clerk_org_id_idx" ON "lightfast_workspace_workflow_runs" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE INDEX "job_workspace_id_idx" ON "lightfast_workspace_workflow_runs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "job_repository_id_idx" ON "lightfast_workspace_workflow_runs" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "job_status_idx" ON "lightfast_workspace_workflow_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "job_inngest_run_id_idx" ON "lightfast_workspace_workflow_runs" USING btree ("inngest_run_id");--> statement-breakpoint
CREATE INDEX "job_workspace_created_at_idx" ON "lightfast_workspace_workflow_runs" USING btree ("workspace_id", "created_at");
