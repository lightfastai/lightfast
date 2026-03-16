CREATE TABLE "lightfast_gateway_backfill_runs" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"installation_id" varchar(191) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"since" timestamp with time zone NOT NULL,
	"depth" integer NOT NULL,
	"status" varchar(50) NOT NULL,
	"pages_processed" integer DEFAULT 0 NOT NULL,
	"events_produced" integer DEFAULT 0 NOT NULL,
	"events_dispatched" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_gateway_installations" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"provider" varchar(50) NOT NULL,
	"external_id" varchar(191) NOT NULL,
	"connected_by" varchar(191) NOT NULL,
	"org_id" varchar(191) NOT NULL,
	"status" varchar(50) NOT NULL,
	"webhook_secret" text,
	"metadata" jsonb,
	"provider_account_info" jsonb,
	"backfill_config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_gateway_resources" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"installation_id" varchar(191) NOT NULL,
	"provider_resource_id" varchar(191) NOT NULL,
	"resource_name" varchar(500),
	"status" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_gateway_tokens" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"installation_id" varchar(191) NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"token_type" varchar(50),
	"scope" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_gateway_webhook_deliveries" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"provider" varchar(50) NOT NULL,
	"delivery_id" varchar(191) NOT NULL,
	"event_type" varchar(191) NOT NULL,
	"installation_id" varchar(191),
	"status" varchar(50) NOT NULL,
	"payload" text,
	"received_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_workspace_entity_edges" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lightfast_workspace_entity_edges_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"external_id" varchar(21) NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"source_entity_id" bigint NOT NULL,
	"target_entity_id" bigint NOT NULL,
	"relationship_type" varchar(50) NOT NULL,
	"source_event_id" bigint,
	"confidence" real DEFAULT 1 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_workspace_event_entities" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lightfast_workspace_event_entities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"entity_id" bigint NOT NULL,
	"event_id" bigint NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"ref_label" varchar(50),
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_workspace_ingest_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lightfast_workspace_ingest_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"workspace_id" varchar(191) NOT NULL,
	"delivery_id" varchar(191) NOT NULL,
	"source" varchar(50) NOT NULL,
	"source_type" varchar(100) NOT NULL,
	"source_event" jsonb NOT NULL,
	"ingestion_source" varchar(20) DEFAULT 'webhook' NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lightfast_gw_backfill_runs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lightfast_gw_installations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lightfast_gw_resources" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lightfast_gw_tokens" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lightfast_gw_webhook_deliveries" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_edges" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_entity_events" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_ingest_log" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "lightfast_gw_backfill_runs" CASCADE;--> statement-breakpoint
DROP TABLE "lightfast_gw_installations" CASCADE;--> statement-breakpoint
DROP TABLE "lightfast_gw_resources" CASCADE;--> statement-breakpoint
DROP TABLE "lightfast_gw_tokens" CASCADE;--> statement-breakpoint
DROP TABLE "lightfast_gw_webhook_deliveries" CASCADE;--> statement-breakpoint
DROP TABLE "lightfast_workspace_edges" CASCADE;--> statement-breakpoint
DROP TABLE "lightfast_workspace_entity_events" CASCADE;--> statement-breakpoint
DROP TABLE "lightfast_workspace_ingest_log" CASCADE;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" DROP CONSTRAINT IF EXISTS "lightfast_workspace_integrations_installation_id_lightfast_gw_installations_id_fk";
ALTER TABLE "lightfast_workspace_integrations" DROP CONSTRAINT IF EXISTS "lightfast_workspace_integrations_installation_id_lightfast_gw_i";
--> statement-breakpoint
ALTER TABLE "lightfast_gateway_backfill_runs" ADD CONSTRAINT "lightfast_gateway_backfill_runs_installation_id_lightfast_gateway_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."lightfast_gateway_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_gateway_resources" ADD CONSTRAINT "lightfast_gateway_resources_installation_id_lightfast_gateway_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."lightfast_gateway_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_gateway_tokens" ADD CONSTRAINT "lightfast_gateway_tokens_installation_id_lightfast_gateway_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."lightfast_gateway_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_entity_edges" ADD CONSTRAINT "lightfast_workspace_entity_edges_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_entity_edges" ADD CONSTRAINT "lightfast_workspace_entity_edges_source_entity_id_lightfast_workspace_entities_id_fk" FOREIGN KEY ("source_entity_id") REFERENCES "public"."lightfast_workspace_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_entity_edges" ADD CONSTRAINT "lightfast_workspace_entity_edges_target_entity_id_lightfast_workspace_entities_id_fk" FOREIGN KEY ("target_entity_id") REFERENCES "public"."lightfast_workspace_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_entity_edges" ADD CONSTRAINT "lightfast_workspace_entity_edges_source_event_id_lightfast_workspace_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."lightfast_workspace_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_event_entities" ADD CONSTRAINT "lightfast_workspace_event_entities_entity_id_lightfast_workspace_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."lightfast_workspace_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_event_entities" ADD CONSTRAINT "lightfast_workspace_event_entities_event_id_lightfast_workspace_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."lightfast_workspace_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_event_entities" ADD CONSTRAINT "lightfast_workspace_event_entities_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_ingest_logs" ADD CONSTRAINT "lightfast_workspace_ingest_logs_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_br_installation_entity_idx" ON "lightfast_gateway_backfill_runs" USING btree ("installation_id","entity_type");--> statement-breakpoint
CREATE INDEX "gateway_br_installation_idx" ON "lightfast_gateway_backfill_runs" USING btree ("installation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_inst_provider_external_idx" ON "lightfast_gateway_installations" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "gateway_inst_org_id_idx" ON "lightfast_gateway_installations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "gateway_inst_org_provider_idx" ON "lightfast_gateway_installations" USING btree ("org_id","provider");--> statement-breakpoint
CREATE INDEX "gateway_inst_connected_by_idx" ON "lightfast_gateway_installations" USING btree ("connected_by");--> statement-breakpoint
CREATE INDEX "gateway_res_installation_id_idx" ON "lightfast_gateway_resources" USING btree ("installation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_res_provider_resource_idx" ON "lightfast_gateway_resources" USING btree ("installation_id","provider_resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_tok_installation_id_idx" ON "lightfast_gateway_tokens" USING btree ("installation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_wd_provider_delivery_idx" ON "lightfast_gateway_webhook_deliveries" USING btree ("provider","delivery_id");--> statement-breakpoint
CREATE INDEX "gateway_wd_status_idx" ON "lightfast_gateway_webhook_deliveries" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "edge_external_id_idx" ON "lightfast_workspace_entity_edges" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "edge_source_idx" ON "lightfast_workspace_entity_edges" USING btree ("workspace_id","source_entity_id");--> statement-breakpoint
CREATE INDEX "edge_target_idx" ON "lightfast_workspace_entity_edges" USING btree ("workspace_id","target_entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "edge_unique_idx" ON "lightfast_workspace_entity_edges" USING btree ("workspace_id","source_entity_id","target_entity_id","relationship_type");--> statement-breakpoint
CREATE INDEX "edge_source_event_idx" ON "lightfast_workspace_entity_edges" USING btree ("source_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_entity_idx" ON "lightfast_workspace_event_entities" USING btree ("entity_id","event_id");--> statement-breakpoint
CREATE INDEX "event_entity_entity_idx" ON "lightfast_workspace_event_entities" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "event_entity_event_idx" ON "lightfast_workspace_event_entities" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "workspace_event_cursor_idx" ON "lightfast_workspace_ingest_logs" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE INDEX "event_delivery_idx" ON "lightfast_workspace_ingest_logs" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "workspace_event_source_idx" ON "lightfast_workspace_ingest_logs" USING btree ("workspace_id","source","source_type");--> statement-breakpoint
CREATE INDEX "workspace_event_date_idx" ON "lightfast_workspace_ingest_logs" USING btree ("workspace_id","received_at");--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" ADD CONSTRAINT "lightfast_workspace_integrations_installation_id_lightfast_gateway_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."lightfast_gateway_installations"("id") ON DELETE cascade ON UPDATE no action;