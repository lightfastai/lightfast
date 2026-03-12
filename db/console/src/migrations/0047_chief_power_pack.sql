CREATE TABLE "lightfast_workspace_entities" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lightfast_workspace_entities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"external_id" varchar(21) NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"category" varchar(50) NOT NULL,
	"key" varchar(500) NOT NULL,
	"value" text,
	"aliases" jsonb,
	"evidence_snippet" text,
	"confidence" real DEFAULT 0.8,
	"extracted_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "lightfast_workspace_entities_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "lightfast_workspace_entity_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lightfast_workspace_entity_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"entity_id" bigint NOT NULL,
	"event_id" bigint NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"ref_label" varchar(50),
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_workspace_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lightfast_workspace_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"external_id" varchar(21) NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"captured_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"actor" jsonb,
	"actor_id" bigint,
	"observation_type" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"source" varchar(50) NOT NULL,
	"source_type" varchar(100) NOT NULL,
	"source_id" varchar(255) NOT NULL,
	"source_references" jsonb,
	"metadata" jsonb,
	"ingestion_source" varchar(20) DEFAULT 'webhook' NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "lightfast_workspace_events_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "lightfast_workspace_interpretations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lightfast_workspace_interpretations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"event_id" bigint NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"primary_category" varchar(50),
	"topics" jsonb,
	"significance_score" real,
	"embedding_title_id" varchar(191),
	"embedding_content_id" varchar(191),
	"embedding_summary_id" varchar(191),
	"model_version" varchar(100),
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lightfast_workspace_entity_observations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_neural_entities" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_neural_observations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_observation_interpretations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "lightfast_workspace_entity_observations" CASCADE;--> statement-breakpoint
DROP TABLE "lightfast_workspace_neural_entities" CASCADE;--> statement-breakpoint
DROP TABLE "lightfast_workspace_neural_observations" CASCADE;--> statement-breakpoint
DROP TABLE "lightfast_workspace_observation_interpretations" CASCADE;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_edges" DROP CONSTRAINT "lightfast_workspace_edges_source_entity_id_lightfast_workspace_neural_entities_id_fk";
--> statement-breakpoint
ALTER TABLE "lightfast_workspace_edges" DROP CONSTRAINT "lightfast_workspace_edges_target_entity_id_lightfast_workspace_neural_entities_id_fk";
--> statement-breakpoint
ALTER TABLE "lightfast_workspace_edges" DROP CONSTRAINT "lightfast_workspace_edges_source_event_id_lightfast_workspace_neural_observations_id_fk";
--> statement-breakpoint
ALTER TABLE "lightfast_workspace_entities" ADD CONSTRAINT "lightfast_workspace_entities_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_entity_events" ADD CONSTRAINT "lightfast_workspace_entity_events_entity_id_lightfast_workspace_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."lightfast_workspace_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_entity_events" ADD CONSTRAINT "lightfast_workspace_entity_events_event_id_lightfast_workspace_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."lightfast_workspace_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_entity_events" ADD CONSTRAINT "lightfast_workspace_entity_events_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_events" ADD CONSTRAINT "lightfast_workspace_events_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_interpretations" ADD CONSTRAINT "lightfast_workspace_interpretations_event_id_lightfast_workspace_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."lightfast_workspace_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_interpretations" ADD CONSTRAINT "lightfast_workspace_interpretations_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entity_external_id_idx" ON "lightfast_workspace_entities" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_workspace_category_key_idx" ON "lightfast_workspace_entities" USING btree ("workspace_id","category","key");--> statement-breakpoint
CREATE INDEX "entity_workspace_category_idx" ON "lightfast_workspace_entities" USING btree ("workspace_id","category");--> statement-breakpoint
CREATE INDEX "entity_workspace_key_idx" ON "lightfast_workspace_entities" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE INDEX "entity_workspace_last_seen_idx" ON "lightfast_workspace_entities" USING btree ("workspace_id","last_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ee_entity_event_idx" ON "lightfast_workspace_entity_events" USING btree ("entity_id","event_id");--> statement-breakpoint
CREATE INDEX "ee_entity_idx" ON "lightfast_workspace_entity_events" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "ee_event_idx" ON "lightfast_workspace_entity_events" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_external_id_idx" ON "lightfast_workspace_events" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "event_workspace_occurred_idx" ON "lightfast_workspace_events" USING btree ("workspace_id","occurred_at");--> statement-breakpoint
CREATE INDEX "event_source_idx" ON "lightfast_workspace_events" USING btree ("workspace_id","source","source_type");--> statement-breakpoint
CREATE INDEX "event_source_id_idx" ON "lightfast_workspace_events" USING btree ("workspace_id","source_id");--> statement-breakpoint
CREATE INDEX "event_type_idx" ON "lightfast_workspace_events" USING btree ("workspace_id","observation_type");--> statement-breakpoint
CREATE UNIQUE INDEX "interp_event_version_idx" ON "lightfast_workspace_interpretations" USING btree ("event_id","version");--> statement-breakpoint
CREATE INDEX "interp_event_idx" ON "lightfast_workspace_interpretations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "interp_workspace_processed_idx" ON "lightfast_workspace_interpretations" USING btree ("workspace_id","processed_at");--> statement-breakpoint
CREATE INDEX "interp_embedding_title_idx" ON "lightfast_workspace_interpretations" USING btree ("workspace_id","embedding_title_id");--> statement-breakpoint
CREATE INDEX "interp_embedding_content_idx" ON "lightfast_workspace_interpretations" USING btree ("workspace_id","embedding_content_id");--> statement-breakpoint
CREATE INDEX "interp_embedding_summary_idx" ON "lightfast_workspace_interpretations" USING btree ("workspace_id","embedding_summary_id");--> statement-breakpoint
ALTER TABLE "lightfast_workspace_edges" ADD CONSTRAINT "lightfast_workspace_edges_source_entity_id_lightfast_workspace_entities_id_fk" FOREIGN KEY ("source_entity_id") REFERENCES "public"."lightfast_workspace_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_edges" ADD CONSTRAINT "lightfast_workspace_edges_target_entity_id_lightfast_workspace_entities_id_fk" FOREIGN KEY ("target_entity_id") REFERENCES "public"."lightfast_workspace_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_edges" ADD CONSTRAINT "lightfast_workspace_edges_source_event_id_lightfast_workspace_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."lightfast_workspace_events"("id") ON DELETE set null ON UPDATE no action;