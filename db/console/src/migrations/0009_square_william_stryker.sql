CREATE TABLE "lightfast_org_workspaces" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"clerk_org_id" varchar(191) NOT NULL,
	"name" varchar(191) NOT NULL,
	"slug" varchar(191) NOT NULL,
	"settings" jsonb,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_workspace_stores" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"slug" varchar(191) NOT NULL,
	"index_name" varchar(191) NOT NULL,
	"namespace_name" varchar(191) NOT NULL,
	"embedding_dim" integer NOT NULL,
	"pinecone_metric" varchar(50) NOT NULL,
	"pinecone_cloud" varchar(50) NOT NULL,
	"pinecone_region" varchar(50) NOT NULL,
	"chunk_max_tokens" integer NOT NULL,
	"chunk_overlap" integer NOT NULL,
	"embedding_model" varchar(100) NOT NULL,
	"embedding_provider" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_workspace_knowledge_documents" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"store_id" varchar(191) NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"source_id" varchar(255) NOT NULL,
	"source_metadata" jsonb NOT NULL,
	"parent_doc_id" varchar(191),
	"slug" varchar(256) NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"config_hash" varchar(64),
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"relationships" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_workspace_knowledge_vector_chunks" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"store_id" varchar(191) NOT NULL,
	"doc_id" varchar(191) NOT NULL,
	"chunk_index" integer NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"upserted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_workspace_integrations" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"user_source_id" varchar(191) NOT NULL,
	"connected_by" varchar(191) NOT NULL,
	"source_config" jsonb NOT NULL,
	"provider_resource_id" varchar(191) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_sync_status" varchar(50),
	"last_sync_error" text,
	"document_count" integer DEFAULT 0 NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_workspace_workflow_runs" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"clerk_org_id" varchar(191) NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
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
CREATE TABLE "lightfast_workspace_metrics" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"clerk_org_id" varchar(191) NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"repository_id" varchar(191),
	"type" varchar(50) NOT NULL,
	"value" integer NOT NULL,
	"unit" varchar(20),
	"tags" jsonb,
	"timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_workspace_user_activities" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"actor_type" varchar(20) NOT NULL,
	"actor_user_id" varchar(191),
	"actor_email" varchar(255),
	"actor_ip" varchar(45),
	"category" varchar(50) NOT NULL,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(191) NOT NULL,
	"entity_name" varchar(500),
	"metadata" jsonb,
	"request_id" varchar(191),
	"user_agent" text,
	"related_activity_id" varchar(191),
	"timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
DROP TABLE "lightfast_docs_documents" CASCADE;--> statement-breakpoint
DROP TABLE "lightfast_ingestion_events" CASCADE;--> statement-breakpoint
DROP TABLE "lightfast_jobs" CASCADE;--> statement-breakpoint
DROP TABLE "lightfast_metrics" CASCADE;--> statement-breakpoint
DROP TABLE "lightfast_workspace_sources" CASCADE;--> statement-breakpoint
DROP TABLE "lightfast_stores" CASCADE;--> statement-breakpoint
DROP TABLE "lightfast_vector_entries" CASCADE;--> statement-breakpoint
DROP TABLE "lightfast_workspaces" CASCADE;--> statement-breakpoint
ALTER TABLE "lightfast_api_keys" RENAME TO "lightfast_user_api_keys";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_stores" ADD CONSTRAINT "lightfast_workspace_stores_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_knowledge_documents" ADD CONSTRAINT "lightfast_workspace_knowledge_documents_store_id_lightfast_workspace_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."lightfast_workspace_stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_knowledge_vector_chunks" ADD CONSTRAINT "lightfast_workspace_knowledge_vector_chunks_store_id_lightfast_workspace_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."lightfast_workspace_stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_knowledge_vector_chunks" ADD CONSTRAINT "lightfast_workspace_knowledge_vector_chunks_doc_id_lightfast_workspace_knowledge_documents_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."lightfast_workspace_knowledge_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" ADD CONSTRAINT "lightfast_workspace_integrations_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" ADD CONSTRAINT "lightfast_workspace_integrations_user_source_id_lightfast_user_sources_id_fk" FOREIGN KEY ("user_source_id") REFERENCES "public"."lightfast_user_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_clerk_org_id_idx" ON "lightfast_org_workspaces" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_org_name_idx" ON "lightfast_org_workspaces" USING btree ("clerk_org_id","name");--> statement-breakpoint
CREATE INDEX "workspace_slug_idx" ON "lightfast_org_workspaces" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_stores_ws" ON "lightfast_workspace_stores" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ws_slug" ON "lightfast_workspace_stores" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "idx_docs_store" ON "lightfast_workspace_knowledge_documents" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_docs_store_slug" ON "lightfast_workspace_knowledge_documents" USING btree ("store_id","slug");--> statement-breakpoint
CREATE INDEX "idx_docs_source_type" ON "lightfast_workspace_knowledge_documents" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "idx_docs_source_id" ON "lightfast_workspace_knowledge_documents" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_docs_store_source" ON "lightfast_workspace_knowledge_documents" USING btree ("store_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX "idx_vec_store_doc" ON "lightfast_workspace_knowledge_vector_chunks" USING btree ("store_id","doc_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_vec_unique" ON "lightfast_workspace_knowledge_vector_chunks" USING btree ("store_id","doc_id","chunk_index","content_hash");--> statement-breakpoint
CREATE INDEX "workspace_source_workspace_id_idx" ON "lightfast_workspace_integrations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_source_user_source_id_idx" ON "lightfast_workspace_integrations" USING btree ("user_source_id");--> statement-breakpoint
CREATE INDEX "workspace_source_connected_by_idx" ON "lightfast_workspace_integrations" USING btree ("connected_by");--> statement-breakpoint
CREATE INDEX "workspace_source_is_active_idx" ON "lightfast_workspace_integrations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "workspace_source_provider_resource_id_idx" ON "lightfast_workspace_integrations" USING btree ("provider_resource_id");--> statement-breakpoint
CREATE INDEX "job_clerk_org_id_idx" ON "lightfast_workspace_workflow_runs" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE INDEX "job_workspace_id_idx" ON "lightfast_workspace_workflow_runs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "job_repository_id_idx" ON "lightfast_workspace_workflow_runs" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "job_status_idx" ON "lightfast_workspace_workflow_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "job_inngest_run_id_idx" ON "lightfast_workspace_workflow_runs" USING btree ("inngest_run_id");--> statement-breakpoint
CREATE INDEX "job_workspace_created_at_idx" ON "lightfast_workspace_workflow_runs" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "metric_clerk_org_id_idx" ON "lightfast_workspace_metrics" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE INDEX "metric_workspace_id_idx" ON "lightfast_workspace_metrics" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "metric_repository_id_idx" ON "lightfast_workspace_metrics" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "metric_type_idx" ON "lightfast_workspace_metrics" USING btree ("type");--> statement-breakpoint
CREATE INDEX "metric_workspace_type_timestamp_idx" ON "lightfast_workspace_metrics" USING btree ("workspace_id","type","timestamp");--> statement-breakpoint
CREATE INDEX "metric_timestamp_idx" ON "lightfast_workspace_metrics" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "activity_workspace_timestamp_idx" ON "lightfast_workspace_user_activities" USING btree ("workspace_id","timestamp");--> statement-breakpoint
CREATE INDEX "activity_actor_idx" ON "lightfast_workspace_user_activities" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "activity_category_idx" ON "lightfast_workspace_user_activities" USING btree ("category");--> statement-breakpoint
CREATE INDEX "activity_entity_idx" ON "lightfast_workspace_user_activities" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "activity_category_timestamp_idx" ON "lightfast_workspace_user_activities" USING btree ("category","timestamp");--> statement-breakpoint
CREATE INDEX "activity_related_idx" ON "lightfast_workspace_user_activities" USING btree ("related_activity_id");--> statement-breakpoint
CREATE INDEX "activity_timestamp_idx" ON "lightfast_workspace_user_activities" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "activity_workspace_category_timestamp_idx" ON "lightfast_workspace_user_activities" USING btree ("workspace_id","category","timestamp");