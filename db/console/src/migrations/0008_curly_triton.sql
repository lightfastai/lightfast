ALTER TABLE "lightfast_connected_repository" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lightfast_connected_sources" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lightfast_integration_resources" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lightfast_integrations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lightfast_organization_integrations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "lightfast_connected_repository" CASCADE;--> statement-breakpoint
DROP TABLE "lightfast_connected_sources" CASCADE;--> statement-breakpoint
DROP TABLE "lightfast_integration_resources" CASCADE;--> statement-breakpoint
DROP TABLE "lightfast_integrations" CASCADE;--> statement-breakpoint
DROP TABLE "lightfast_organization_integrations" CASCADE;--> statement-breakpoint
DROP TABLE "lightfast_workspace_integrations" CASCADE;--> statement-breakpoint
ALTER TABLE "lightfast_api_keys" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_api_keys" ALTER COLUMN "last_used_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_api_keys" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_api_keys" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "lightfast_api_keys" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_api_keys" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "lightfast_docs_documents" ALTER COLUMN "source_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "lightfast_docs_documents" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_docs_documents" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "lightfast_docs_documents" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_docs_documents" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "lightfast_ingestion_events" ALTER COLUMN "source_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "lightfast_ingestion_events" ALTER COLUMN "processed_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_ingestion_events" ALTER COLUMN "processed_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "lightfast_jobs" ALTER COLUMN "started_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_jobs" ALTER COLUMN "completed_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_jobs" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_jobs" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "lightfast_jobs" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_jobs" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "lightfast_metrics" ALTER COLUMN "timestamp" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_metrics" ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "lightfast_metrics" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_metrics" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "lightfast_user_sources" ALTER COLUMN "provider" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "lightfast_user_sources" ALTER COLUMN "token_expires_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_user_sources" ALTER COLUMN "connected_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_user_sources" ALTER COLUMN "connected_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "lightfast_user_sources" ALTER COLUMN "last_sync_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_user_sources" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_user_sources" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "lightfast_user_sources" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_user_sources" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_sources" ALTER COLUMN "last_synced_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_sources" ALTER COLUMN "connected_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_sources" ALTER COLUMN "connected_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "lightfast_workspace_sources" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_sources" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "lightfast_workspace_sources" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_sources" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "lightfast_stores" ALTER COLUMN "pinecone_metric" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "lightfast_stores" ALTER COLUMN "pinecone_cloud" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "lightfast_stores" ALTER COLUMN "embedding_provider" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "lightfast_stores" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_stores" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "lightfast_stores" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_stores" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "lightfast_vector_entries" ALTER COLUMN "upserted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_vector_entries" ALTER COLUMN "upserted_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "lightfast_workspaces" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_workspaces" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "lightfast_workspaces" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_workspaces" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_sources" ADD COLUMN "source_config" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_sources" ADD COLUMN "provider_resource_id" varchar(191) NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_stores" ADD COLUMN "namespace_name" varchar(191) NOT NULL;--> statement-breakpoint
CREATE INDEX "workspace_source_provider_resource_id_idx" ON "lightfast_workspace_sources" USING btree ("provider_resource_id");--> statement-breakpoint
ALTER TABLE "lightfast_workspace_sources" DROP COLUMN "resource_data";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_sources" DROP COLUMN "sync_config";--> statement-breakpoint
DROP TYPE "public"."config_status";--> statement-breakpoint
DROP TYPE "public"."source_type";--> statement-breakpoint
DROP TYPE "public"."integration_provider";--> statement-breakpoint
DROP TYPE "public"."embedding_provider";--> statement-breakpoint
DROP TYPE "public"."pinecone_cloud";--> statement-breakpoint
DROP TYPE "public"."pinecone_metric";