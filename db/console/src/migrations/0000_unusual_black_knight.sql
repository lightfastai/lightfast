CREATE TYPE "public"."config_status" AS ENUM('configured', 'unconfigured', 'ingesting', 'error', 'pending');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('github', 'linear', 'notion', 'sentry', 'vercel', 'zendesk');--> statement-breakpoint
CREATE TYPE "public"."integration_provider" AS ENUM('github', 'notion', 'linear', 'sentry');--> statement-breakpoint
CREATE TYPE "public"."embedding_provider" AS ENUM('cohere');--> statement-breakpoint
CREATE TYPE "public"."pinecone_cloud" AS ENUM('aws', 'gcp', 'azure');--> statement-breakpoint
CREATE TYPE "public"."pinecone_metric" AS ENUM('cosine', 'euclidean', 'dotproduct');--> statement-breakpoint
CREATE TABLE "lightfast_connected_repository" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"clerk_org_id" varchar(191) NOT NULL,
	"github_repo_id" varchar(191) NOT NULL,
	"github_installation_id" varchar(191) NOT NULL,
	"permissions" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"last_synced_at" timestamp,
	"config_status" "config_status" DEFAULT 'pending' NOT NULL,
	"config_path" varchar(255),
	"config_detected_at" timestamp,
	"workspace_id" varchar(191),
	"document_count" integer DEFAULT 0 NOT NULL,
	"last_ingested_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "lightfast_connected_repository_github_repo_id_unique" UNIQUE("github_repo_id")
);
--> statement-breakpoint
CREATE TABLE "lightfast_connected_sources" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"clerk_org_id" varchar(191) NOT NULL,
	"workspace_id" varchar(191),
	"source_type" "source_type" NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"source_metadata" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"document_count" integer DEFAULT 0 NOT NULL,
	"last_ingested_at" timestamp,
	"last_synced_at" timestamp,
	"connected_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_docs_documents" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"store_id" varchar(191) NOT NULL,
	"source_type" "source_type" NOT NULL,
	"source_id" varchar(255) NOT NULL,
	"source_metadata" jsonb NOT NULL,
	"parent_doc_id" varchar(191),
	"slug" varchar(256) NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"config_hash" varchar(64),
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"relationships" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_ingestion_events" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"store_id" varchar(191) NOT NULL,
	"source_type" "source_type" NOT NULL,
	"event_key" varchar(255) NOT NULL,
	"event_metadata" jsonb NOT NULL,
	"source" varchar(32) DEFAULT 'webhook' NOT NULL,
	"status" varchar(16) DEFAULT 'processed' NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_integration_resources" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"integration_id" varchar(191) NOT NULL,
	"resource_data" jsonb NOT NULL,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_integrations" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"user_id" varchar(191) NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"scopes" text[],
	"provider_data" jsonb NOT NULL,
	"last_sync_at" timestamp,
	"next_sync_at" timestamp,
	"sync_status" varchar(50),
	"error_message" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_organization_integrations" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"integration_id" varchar(191) NOT NULL,
	"clerk_org_id" varchar(191) NOT NULL,
	"authorized_by" varchar(191) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"authorized_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_workspace_integrations" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"resource_id" varchar(191) NOT NULL,
	"connected_by_user_id" varchar(191) NOT NULL,
	"sync_config" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp,
	"last_sync_status" varchar(50),
	"last_sync_error" text,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_stores" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"slug" varchar(191) NOT NULL,
	"index_name" varchar(191) NOT NULL,
	"embedding_dim" integer NOT NULL,
	"pinecone_metric" "pinecone_metric" NOT NULL,
	"pinecone_cloud" "pinecone_cloud" NOT NULL,
	"pinecone_region" varchar(50) NOT NULL,
	"chunk_max_tokens" integer NOT NULL,
	"chunk_overlap" integer NOT NULL,
	"embedding_model" varchar(100) NOT NULL,
	"embedding_provider" "embedding_provider" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_vector_entries" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"store_id" varchar(191) NOT NULL,
	"doc_id" varchar(191) NOT NULL,
	"chunk_index" integer NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"upserted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_workspaces" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"clerk_org_id" varchar(191) NOT NULL,
	"slug" varchar(191) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"settings" jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lightfast_connected_repository" ADD CONSTRAINT "lightfast_connected_repository_workspace_id_lightfast_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_connected_sources" ADD CONSTRAINT "lightfast_connected_sources_workspace_id_lightfast_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_docs_documents" ADD CONSTRAINT "lightfast_docs_documents_store_id_lightfast_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."lightfast_stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_ingestion_events" ADD CONSTRAINT "lightfast_ingestion_events_store_id_lightfast_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."lightfast_stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_integration_resources" ADD CONSTRAINT "lightfast_integration_resources_integration_id_lightfast_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."lightfast_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_organization_integrations" ADD CONSTRAINT "lightfast_organization_integrations_integration_id_lightfast_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."lightfast_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" ADD CONSTRAINT "lightfast_workspace_integrations_workspace_id_lightfast_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" ADD CONSTRAINT "lightfast_workspace_integrations_resource_id_lightfast_integration_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."lightfast_integration_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_stores" ADD CONSTRAINT "lightfast_stores_workspace_id_lightfast_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_vector_entries" ADD CONSTRAINT "lightfast_vector_entries_store_id_lightfast_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."lightfast_stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_vector_entries" ADD CONSTRAINT "lightfast_vector_entries_doc_id_lightfast_docs_documents_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."lightfast_docs_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clerk_org_id_idx" ON "lightfast_connected_repository" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE INDEX "org_active_idx" ON "lightfast_connected_repository" USING btree ("clerk_org_id","is_active");--> statement-breakpoint
CREATE INDEX "workspace_active_idx" ON "lightfast_connected_repository" USING btree ("workspace_id","is_active");--> statement-breakpoint
CREATE INDEX "installation_idx" ON "lightfast_connected_repository" USING btree ("github_installation_id");--> statement-breakpoint
CREATE INDEX "connected_sources_clerk_org_id_idx" ON "lightfast_connected_sources" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE INDEX "connected_sources_org_active_idx" ON "lightfast_connected_sources" USING btree ("clerk_org_id","is_active");--> statement-breakpoint
CREATE INDEX "connected_sources_workspace_active_idx" ON "lightfast_connected_sources" USING btree ("workspace_id","is_active");--> statement-breakpoint
CREATE INDEX "connected_sources_source_type_idx" ON "lightfast_connected_sources" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "connected_sources_org_source_type_idx" ON "lightfast_connected_sources" USING btree ("clerk_org_id","source_type");--> statement-breakpoint
CREATE INDEX "idx_docs_store" ON "lightfast_docs_documents" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_docs_store_slug" ON "lightfast_docs_documents" USING btree ("store_id","slug");--> statement-breakpoint
CREATE INDEX "idx_docs_source_type" ON "lightfast_docs_documents" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "idx_docs_source_id" ON "lightfast_docs_documents" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_docs_store_source" ON "lightfast_docs_documents" USING btree ("store_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX "idx_ingestion_events_store" ON "lightfast_ingestion_events" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_ingestion_events_source_type" ON "lightfast_ingestion_events" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "idx_ingestion_events_source" ON "lightfast_ingestion_events" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_ingestion_events_status" ON "lightfast_ingestion_events" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ingestion_event" ON "lightfast_ingestion_events" USING btree ("store_id","source_type","event_key");--> statement-breakpoint
CREATE INDEX "integration_resource_integration_id_idx" ON "lightfast_integration_resources" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX "integration_user_id_idx" ON "lightfast_integrations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "integration_provider_idx" ON "lightfast_integrations" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "integration_is_active_idx" ON "lightfast_integrations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "integration_user_provider_idx" ON "lightfast_integrations" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "org_integration_integration_id_idx" ON "lightfast_organization_integrations" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX "org_integration_clerk_org_id_idx" ON "lightfast_organization_integrations" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE INDEX "org_integration_is_active_idx" ON "lightfast_organization_integrations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "org_integration_unique_idx" ON "lightfast_organization_integrations" USING btree ("integration_id","clerk_org_id");--> statement-breakpoint
CREATE INDEX "workspace_integration_workspace_id_idx" ON "lightfast_workspace_integrations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_integration_resource_id_idx" ON "lightfast_workspace_integrations" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "workspace_integration_connected_by_user_id_idx" ON "lightfast_workspace_integrations" USING btree ("connected_by_user_id");--> statement-breakpoint
CREATE INDEX "workspace_integration_is_active_idx" ON "lightfast_workspace_integrations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "workspace_integration_unique_idx" ON "lightfast_workspace_integrations" USING btree ("workspace_id","resource_id");--> statement-breakpoint
CREATE INDEX "idx_stores_ws" ON "lightfast_stores" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ws_slug" ON "lightfast_stores" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "idx_vec_store_doc" ON "lightfast_vector_entries" USING btree ("store_id","doc_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_vec_unique" ON "lightfast_vector_entries" USING btree ("store_id","doc_id","chunk_index","content_hash");--> statement-breakpoint
CREATE INDEX "workspace_clerk_org_id_idx" ON "lightfast_workspaces" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE INDEX "workspace_org_default_idx" ON "lightfast_workspaces" USING btree ("clerk_org_id","is_default");--> statement-breakpoint
CREATE INDEX "workspace_org_slug_idx" ON "lightfast_workspaces" USING btree ("clerk_org_id","slug");