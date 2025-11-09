CREATE TYPE "public"."config_status" AS ENUM('configured', 'unconfigured', 'ingesting', 'error', 'pending');--> statement-breakpoint
CREATE TABLE "lightfast_deus_connected_repository" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"organization_id" varchar(191) NOT NULL,
	"github_repo_id" varchar(191) NOT NULL,
	"github_installation_id" varchar(191) NOT NULL,
	"permissions" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
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
	CONSTRAINT "lightfast_deus_connected_repository_github_repo_id_unique" UNIQUE("github_repo_id")
);
--> statement-breakpoint
CREATE TABLE "lf_docs_documents" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"store_id" varchar(191) NOT NULL,
	"path" varchar(512) NOT NULL,
	"slug" varchar(256) NOT NULL,
	"title" varchar(256),
	"description" text,
	"content_hash" varchar(64) NOT NULL,
	"commit_sha" varchar(64) NOT NULL,
	"committed_at" timestamp DEFAULT now() NOT NULL,
	"frontmatter" jsonb,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lf_ingestion_commits" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"store_id" varchar(191) NOT NULL,
	"before_sha" varchar(64) NOT NULL,
	"after_sha" varchar(64) NOT NULL,
	"delivery_id" varchar(191) NOT NULL,
	"status" varchar(16) DEFAULT 'processed' NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_deus_organizations" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"github_org_id" integer NOT NULL,
	"github_installation_id" integer NOT NULL,
	"github_org_slug" varchar(255) NOT NULL,
	"github_org_name" varchar(255) NOT NULL,
	"github_org_avatar_url" text,
	"clerk_org_id" varchar(191),
	"clerk_org_slug" varchar(255),
	"claimed_by" varchar(191) NOT NULL,
	"claimed_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "lightfast_deus_organizations_github_org_id_unique" UNIQUE("github_org_id"),
	CONSTRAINT "lightfast_deus_organizations_clerk_org_id_unique" UNIQUE("clerk_org_id")
);
--> statement-breakpoint
CREATE TABLE "lf_stores" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"name" varchar(191) NOT NULL,
	"index_name" varchar(191) NOT NULL,
	"embedding_dim" integer DEFAULT 1536 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lf_vector_entries" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"store_id" varchar(191) NOT NULL,
	"doc_id" varchar(191) NOT NULL,
	"chunk_index" integer NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"index_name" varchar(191) NOT NULL,
	"upserted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_workspaces" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"organization_id" varchar(191) NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(191) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"settings" jsonb,
	"pinecone_index" varchar(255),
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX "org_id_idx" ON "lightfast_deus_connected_repository" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "org_active_idx" ON "lightfast_deus_connected_repository" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "workspace_active_idx" ON "lightfast_deus_connected_repository" USING btree ("workspace_id","is_active","is_enabled");--> statement-breakpoint
CREATE INDEX "installation_idx" ON "lightfast_deus_connected_repository" USING btree ("github_installation_id");--> statement-breakpoint
CREATE INDEX "idx_docs_store" ON "lf_docs_documents" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_docs_store_slug" ON "lf_docs_documents" USING btree ("store_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_docs_store_path" ON "lf_docs_documents" USING btree ("store_id","path");--> statement-breakpoint
CREATE INDEX "idx_commits_store" ON "lf_ingestion_commits" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_commit_after" ON "lf_ingestion_commits" USING btree ("store_id","after_sha");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_commit_delivery" ON "lf_ingestion_commits" USING btree ("store_id","delivery_id");--> statement-breakpoint
CREATE INDEX "org_slug_idx" ON "lightfast_deus_organizations" USING btree ("github_org_slug");--> statement-breakpoint
CREATE INDEX "org_installation_idx" ON "lightfast_deus_organizations" USING btree ("github_installation_id");--> statement-breakpoint
CREATE INDEX "org_clerk_org_idx" ON "lightfast_deus_organizations" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE INDEX "idx_stores_ws" ON "lf_stores" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ws_name" ON "lf_stores" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "idx_vec_store_doc" ON "lf_vector_entries" USING btree ("store_id","doc_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_vec_unique" ON "lf_vector_entries" USING btree ("store_id","doc_id","chunk_index","content_hash");--> statement-breakpoint
CREATE INDEX "workspace_org_id_idx" ON "lightfast_workspaces" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workspace_org_default_idx" ON "lightfast_workspaces" USING btree ("organization_id","is_default");--> statement-breakpoint
CREATE INDEX "workspace_org_slug_idx" ON "lightfast_workspaces" USING btree ("organization_id","slug");