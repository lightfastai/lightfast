CREATE TYPE "public"."source_type" AS ENUM('github', 'linear', 'notion', 'sentry', 'vercel', 'zendesk');--> statement-breakpoint
CREATE TYPE "public"."embedding_provider" AS ENUM('cohere');--> statement-breakpoint
CREATE TYPE "public"."pinecone_cloud" AS ENUM('aws', 'gcp', 'azure');--> statement-breakpoint
CREATE TYPE "public"."pinecone_metric" AS ENUM('cosine', 'euclidean', 'dotproduct');--> statement-breakpoint
CREATE TABLE "lightfast_connected_sources" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"organization_id" varchar(191) NOT NULL,
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
ALTER TABLE "lightfast_ingestion_commits" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lightfast_store_repositories" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "lightfast_ingestion_commits" CASCADE;--> statement-breakpoint
DROP TABLE "lightfast_store_repositories" CASCADE;--> statement-breakpoint
DROP INDEX "uq_docs_store_path";--> statement-breakpoint
-- WARNING: DESTRUCTIVE MIGRATION - Not backwards compatible
-- This migration deletes all existing documents and updates stores to Cohere
-- Stores will need to be re-ingested after this migration
DELETE FROM "lightfast_docs_documents";--> statement-breakpoint
DELETE FROM "lightfast_vector_entries";--> statement-breakpoint
-- Update existing stores to use only valid enum values
UPDATE "lightfast_stores" SET "embedding_provider" = 'cohere' WHERE "embedding_provider" = 'charHash';--> statement-breakpoint
UPDATE "lightfast_stores" SET "embedding_dim" = 1024 WHERE "embedding_provider" = 'cohere' AND "embedding_dim" = 1536;--> statement-breakpoint
UPDATE "lightfast_stores" SET "embedding_model" = 'embed-english-v3.0' WHERE "embedding_model" = 'char-hash-1536';--> statement-breakpoint
-- Drop all defaults FIRST before changing types
ALTER TABLE "lightfast_stores" ALTER COLUMN "embedding_dim" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "lightfast_stores" ALTER COLUMN "pinecone_metric" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "lightfast_stores" ALTER COLUMN "pinecone_cloud" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "lightfast_stores" ALTER COLUMN "pinecone_region" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "lightfast_stores" ALTER COLUMN "chunk_max_tokens" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "lightfast_stores" ALTER COLUMN "chunk_overlap" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "lightfast_stores" ALTER COLUMN "embedding_model" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "lightfast_stores" ALTER COLUMN "embedding_provider" DROP DEFAULT;--> statement-breakpoint
-- Now change column types to enums (after defaults are dropped)
ALTER TABLE "lightfast_stores" ALTER COLUMN "pinecone_metric" SET DATA TYPE "public"."pinecone_metric" USING "pinecone_metric"::"public"."pinecone_metric";--> statement-breakpoint
ALTER TABLE "lightfast_stores" ALTER COLUMN "pinecone_cloud" SET DATA TYPE "public"."pinecone_cloud" USING "pinecone_cloud"::"public"."pinecone_cloud";--> statement-breakpoint
ALTER TABLE "lightfast_stores" ALTER COLUMN "embedding_provider" SET DATA TYPE "public"."embedding_provider" USING "embedding_provider"::"public"."embedding_provider";--> statement-breakpoint
ALTER TABLE "lightfast_docs_documents" ADD COLUMN "source_type" "source_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_docs_documents" ADD COLUMN "source_id" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_docs_documents" ADD COLUMN "source_metadata" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_docs_documents" ADD COLUMN "parent_doc_id" varchar(191);--> statement-breakpoint
ALTER TABLE "lightfast_docs_documents" ADD COLUMN "relationships" jsonb;--> statement-breakpoint
ALTER TABLE "lightfast_connected_sources" ADD CONSTRAINT "lightfast_connected_sources_organization_id_lightfast_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."lightfast_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_connected_sources" ADD CONSTRAINT "lightfast_connected_sources_workspace_id_lightfast_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_ingestion_events" ADD CONSTRAINT "lightfast_ingestion_events_store_id_lightfast_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."lightfast_stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connected_sources_org_id_idx" ON "lightfast_connected_sources" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "connected_sources_org_active_idx" ON "lightfast_connected_sources" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "connected_sources_workspace_active_idx" ON "lightfast_connected_sources" USING btree ("workspace_id","is_active");--> statement-breakpoint
CREATE INDEX "connected_sources_source_type_idx" ON "lightfast_connected_sources" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "connected_sources_org_source_type_idx" ON "lightfast_connected_sources" USING btree ("organization_id","source_type");--> statement-breakpoint
CREATE INDEX "idx_ingestion_events_store" ON "lightfast_ingestion_events" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_ingestion_events_source_type" ON "lightfast_ingestion_events" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "idx_ingestion_events_source" ON "lightfast_ingestion_events" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_ingestion_events_status" ON "lightfast_ingestion_events" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ingestion_event" ON "lightfast_ingestion_events" USING btree ("store_id","source_type","event_key");--> statement-breakpoint
CREATE INDEX "idx_docs_source_type" ON "lightfast_docs_documents" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "idx_docs_source_id" ON "lightfast_docs_documents" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_docs_store_source" ON "lightfast_docs_documents" USING btree ("store_id","source_type","source_id");--> statement-breakpoint
ALTER TABLE "lightfast_docs_documents" DROP COLUMN "path";--> statement-breakpoint
ALTER TABLE "lightfast_docs_documents" DROP COLUMN "commit_sha";--> statement-breakpoint
ALTER TABLE "lightfast_docs_documents" DROP COLUMN "committed_at";--> statement-breakpoint
ALTER TABLE "lightfast_docs_documents" DROP COLUMN "frontmatter";