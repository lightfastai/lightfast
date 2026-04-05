DROP TABLE IF EXISTS "lightfast_org_entities" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "lightfast_org_entity_edges" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "lightfast_org_event_entities" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "lightfast_org_events" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "lightfast_org_ingest_logs" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "lightfast_org_integrations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "lightfast_org_user_activities" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "lightfast_org_workflow_runs" CASCADE;--> statement-breakpoint
CREATE TABLE "lightfast_org_entities" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lightfast_org_entities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"external_id" varchar(21) NOT NULL,
	"clerk_org_id" varchar(191) NOT NULL,
	"category" varchar(50) NOT NULL,
	"key" varchar(500) NOT NULL,
	"value" text,
	"aliases" jsonb,
	"evidence_snippet" text,
	"confidence" real DEFAULT 0.8,
	"state" varchar(100),
	"url" varchar(2048),
	"extracted_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_org_entity_edges" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lightfast_org_entity_edges_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"external_id" varchar(21) NOT NULL,
	"clerk_org_id" varchar(191) NOT NULL,
	"source_entity_id" bigint NOT NULL,
	"target_entity_id" bigint NOT NULL,
	"relationship_type" varchar(50) NOT NULL,
	"source_event_id" bigint,
	"confidence" real DEFAULT 1 NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_org_event_entities" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lightfast_org_event_entities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"entity_id" bigint NOT NULL,
	"event_id" bigint NOT NULL,
	"clerk_org_id" varchar(191) NOT NULL,
	"ref_label" varchar(50),
	"category" varchar(50),
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_org_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lightfast_org_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"external_id" varchar(21) NOT NULL,
	"clerk_org_id" varchar(191) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"captured_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"observation_type" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"source" varchar(50) NOT NULL,
	"source_type" varchar(100) NOT NULL,
	"source_id" varchar(255) NOT NULL,
	"source_references" jsonb,
	"metadata" jsonb,
	"ingestion_source" varchar(20) DEFAULT 'webhook' NOT NULL,
	"ingest_log_id" bigint,
	"significance_score" integer,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_org_ingest_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lightfast_org_ingest_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"clerk_org_id" varchar(191) NOT NULL,
	"delivery_id" varchar(191) NOT NULL,
	"source_event" jsonb NOT NULL,
	"ingestion_source" varchar(20) DEFAULT 'webhook' NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_org_integrations" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"clerk_org_id" varchar(191) NOT NULL,
	"installation_id" varchar(191) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_config" jsonb NOT NULL,
	"provider_resource_id" varchar(191) NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"status_reason" varchar(100),
	"last_synced_at" timestamp with time zone,
	"last_sync_status" varchar(50),
	"last_sync_error" text,
	"document_count" integer DEFAULT 0 NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_org_user_activities" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lightfast_org_user_activities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"clerk_org_id" varchar(191) NOT NULL,
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
);
--> statement-breakpoint
CREATE TABLE "lightfast_org_workflow_runs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lightfast_org_workflow_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"clerk_org_id" varchar(191) NOT NULL,
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
);
--> statement-breakpoint
DROP TABLE IF EXISTS "lightfast_org_workspaces" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "lightfast_workspace_entities" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "lightfast_workspace_entity_edges" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "lightfast_workspace_event_entities" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "lightfast_workspace_events" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "lightfast_workspace_ingest_logs" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "lightfast_workspace_integrations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "lightfast_workspace_user_activities" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "lightfast_workspace_workflow_runs" CASCADE;--> statement-breakpoint
ALTER TABLE "lightfast_org_entity_edges" DROP CONSTRAINT IF EXISTS "lightfast_org_entity_edges_source_entity_id_lightfast_org_entities_id_fk";--> statement-breakpoint
ALTER TABLE "lightfast_org_entity_edges" ADD CONSTRAINT "lightfast_org_entity_edges_source_entity_id_lightfast_org_entities_id_fk" FOREIGN KEY ("source_entity_id") REFERENCES "public"."lightfast_org_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_org_entity_edges" DROP CONSTRAINT IF EXISTS "lightfast_org_entity_edges_target_entity_id_lightfast_org_entities_id_fk";--> statement-breakpoint
ALTER TABLE "lightfast_org_entity_edges" ADD CONSTRAINT "lightfast_org_entity_edges_target_entity_id_lightfast_org_entities_id_fk" FOREIGN KEY ("target_entity_id") REFERENCES "public"."lightfast_org_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_org_entity_edges" DROP CONSTRAINT IF EXISTS "lightfast_org_entity_edges_source_event_id_lightfast_org_events_id_fk";--> statement-breakpoint
ALTER TABLE "lightfast_org_entity_edges" ADD CONSTRAINT "lightfast_org_entity_edges_source_event_id_lightfast_org_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."lightfast_org_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_org_event_entities" DROP CONSTRAINT IF EXISTS "lightfast_org_event_entities_entity_id_lightfast_org_entities_id_fk";--> statement-breakpoint
ALTER TABLE "lightfast_org_event_entities" ADD CONSTRAINT "lightfast_org_event_entities_entity_id_lightfast_org_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."lightfast_org_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_org_event_entities" DROP CONSTRAINT IF EXISTS "lightfast_org_event_entities_event_id_lightfast_org_events_id_fk";--> statement-breakpoint
ALTER TABLE "lightfast_org_event_entities" ADD CONSTRAINT "lightfast_org_event_entities_event_id_lightfast_org_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."lightfast_org_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_org_events" DROP CONSTRAINT IF EXISTS "lightfast_org_events_ingest_log_id_lightfast_org_ingest_logs_id_fk";--> statement-breakpoint
ALTER TABLE "lightfast_org_events" ADD CONSTRAINT "lightfast_org_events_ingest_log_id_lightfast_org_ingest_logs_id_fk" FOREIGN KEY ("ingest_log_id") REFERENCES "public"."lightfast_org_ingest_logs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_org_integrations" DROP CONSTRAINT IF EXISTS "lightfast_org_integrations_installation_id_lightfast_gateway_installations_id_fk";--> statement-breakpoint
ALTER TABLE "lightfast_org_integrations" ADD CONSTRAINT "lightfast_org_integrations_installation_id_lightfast_gateway_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."lightfast_gateway_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_entity_external_id_idx" ON "lightfast_org_entities" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_entity_clerk_org_category_key_idx" ON "lightfast_org_entities" USING btree ("clerk_org_id","category","key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_entity_org_category_idx" ON "lightfast_org_entities" USING btree ("clerk_org_id","category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_entity_org_key_idx" ON "lightfast_org_entities" USING btree ("clerk_org_id","key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_entity_org_last_seen_idx" ON "lightfast_org_entities" USING btree ("clerk_org_id","last_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_edge_external_id_idx" ON "lightfast_org_entity_edges" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_edge_source_idx" ON "lightfast_org_entity_edges" USING btree ("clerk_org_id","source_entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_edge_target_idx" ON "lightfast_org_entity_edges" USING btree ("clerk_org_id","target_entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_edge_unique_idx" ON "lightfast_org_entity_edges" USING btree ("clerk_org_id","source_entity_id","target_entity_id","relationship_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_edge_source_event_idx" ON "lightfast_org_entity_edges" USING btree ("source_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_event_entity_idx" ON "lightfast_org_event_entities" USING btree ("entity_id","event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_event_entity_entity_idx" ON "lightfast_org_event_entities" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_event_entity_event_idx" ON "lightfast_org_event_entities" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_event_external_id_idx" ON "lightfast_org_events" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_event_org_occurred_idx" ON "lightfast_org_events" USING btree ("clerk_org_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_event_source_idx" ON "lightfast_org_events" USING btree ("clerk_org_id","source","source_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_event_source_id_idx" ON "lightfast_org_events" USING btree ("clerk_org_id","source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_event_type_idx" ON "lightfast_org_events" USING btree ("clerk_org_id","observation_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_event_cursor_idx" ON "lightfast_org_ingest_logs" USING btree ("clerk_org_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_event_delivery_idx" ON "lightfast_org_ingest_logs" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_ingest_log_provider_idx" ON "lightfast_org_ingest_logs" USING btree (("source_event"->>'provider'));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_event_date_idx" ON "lightfast_org_ingest_logs" USING btree ("clerk_org_id","received_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_integration_clerk_org_id_idx" ON "lightfast_org_integrations" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_integration_installation_id_idx" ON "lightfast_org_integrations" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_integration_status_idx" ON "lightfast_org_integrations" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_integration_provider_resource_id_idx" ON "lightfast_org_integrations" USING btree ("provider_resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_activity_timestamp_idx" ON "lightfast_org_user_activities" USING btree ("clerk_org_id","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_activity_category_idx" ON "lightfast_org_user_activities" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_activity_entity_idx" ON "lightfast_org_user_activities" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_activity_category_timestamp_idx" ON "lightfast_org_user_activities" USING btree ("category","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_activity_related_idx" ON "lightfast_org_user_activities" USING btree ("related_activity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_activity_ts_idx" ON "lightfast_org_user_activities" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_activity_org_category_timestamp_idx" ON "lightfast_org_user_activities" USING btree ("clerk_org_id","category","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_run_clerk_org_id_idx" ON "lightfast_org_workflow_runs" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_run_repository_id_idx" ON "lightfast_org_workflow_runs" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_run_status_idx" ON "lightfast_org_workflow_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_run_inngest_run_id_idx" ON "lightfast_org_workflow_runs" USING btree ("inngest_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_run_org_created_at_idx" ON "lightfast_org_workflow_runs" USING btree ("clerk_org_id","created_at");