-- Step 1: Add new columns to org_workspaces (store config migration)
ALTER TABLE "lightfast_org_workspaces" ADD COLUMN IF NOT EXISTS "index_name" varchar(191);--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" ADD COLUMN IF NOT EXISTS "namespace_name" varchar(191);--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" ADD COLUMN IF NOT EXISTS "embedding_dim" integer;--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" ADD COLUMN IF NOT EXISTS "embedding_model" varchar(100);--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" ADD COLUMN IF NOT EXISTS "embedding_provider" varchar(50);--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" ADD COLUMN IF NOT EXISTS "pinecone_metric" varchar(50);--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" ADD COLUMN IF NOT EXISTS "pinecone_cloud" varchar(50);--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" ADD COLUMN IF NOT EXISTS "pinecone_region" varchar(50);--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" ADD COLUMN IF NOT EXISTS "chunk_max_tokens" integer;--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" ADD COLUMN IF NOT EXISTS "chunk_overlap" integer;--> statement-breakpoint

-- Step 2: Migrate store config to workspaces (before dropping stores table)
UPDATE "lightfast_org_workspaces" w
SET
  index_name = s.index_name,
  namespace_name = s.namespace_name,
  embedding_dim = s.embedding_dim,
  embedding_model = s.embedding_model,
  embedding_provider = s.embedding_provider,
  pinecone_metric = s.pinecone_metric,
  pinecone_cloud = s.pinecone_cloud,
  pinecone_region = s.pinecone_region,
  chunk_max_tokens = s.chunk_max_tokens,
  chunk_overlap = s.chunk_overlap
FROM "lightfast_workspace_stores" s
WHERE s.workspace_id = w.id;--> statement-breakpoint

-- Step 3: Add workspace_id columns as NULLABLE first
ALTER TABLE "lightfast_workspace_knowledge_documents" ADD COLUMN IF NOT EXISTS "workspace_id" varchar(191);--> statement-breakpoint
ALTER TABLE "lightfast_workspace_knowledge_vector_chunks" ADD COLUMN IF NOT EXISTS "workspace_id" varchar(191);--> statement-breakpoint

-- Step 4: Migrate data - lookup workspace_id from stores table via store_id
UPDATE "lightfast_workspace_knowledge_documents" d
SET workspace_id = s.workspace_id
FROM "lightfast_workspace_stores" s
WHERE d.store_id = s.id AND d.workspace_id IS NULL;--> statement-breakpoint

UPDATE "lightfast_workspace_knowledge_vector_chunks" v
SET workspace_id = s.workspace_id
FROM "lightfast_workspace_stores" s
WHERE v.store_id = s.id AND v.workspace_id IS NULL;--> statement-breakpoint

-- Step 5: Make workspace_id NOT NULL after data migration
ALTER TABLE "lightfast_workspace_knowledge_documents" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_knowledge_vector_chunks" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint

-- Step 6: Drop old indexes
DROP INDEX IF EXISTS "idx_docs_store";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_docs_store_slug";--> statement-breakpoint
DROP INDEX IF EXISTS "uq_docs_store_source";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_vec_store_doc";--> statement-breakpoint
DROP INDEX IF EXISTS "job_store_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "uq_vec_unique";--> statement-breakpoint

-- Step 7: Add foreign key constraints
ALTER TABLE "lightfast_workspace_knowledge_documents" ADD CONSTRAINT "lightfast_workspace_knowledge_documents_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_knowledge_vector_chunks" ADD CONSTRAINT "lightfast_workspace_knowledge_vector_chunks_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Step 8: Create new indexes
CREATE INDEX IF NOT EXISTS "idx_docs_workspace" ON "lightfast_workspace_knowledge_documents" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_docs_workspace_slug" ON "lightfast_workspace_knowledge_documents" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_docs_workspace_source" ON "lightfast_workspace_knowledge_documents" USING btree ("workspace_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vec_workspace_doc" ON "lightfast_workspace_knowledge_vector_chunks" USING btree ("workspace_id","doc_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_vec_unique" ON "lightfast_workspace_knowledge_vector_chunks" USING btree ("workspace_id","doc_id","chunk_index","content_hash");--> statement-breakpoint

-- Step 9: Drop store_id columns from all tables
ALTER TABLE "lightfast_workspace_knowledge_documents" DROP COLUMN IF EXISTS "store_id";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_knowledge_vector_chunks" DROP COLUMN IF EXISTS "store_id";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_workflow_runs" DROP COLUMN IF EXISTS "store_id";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_neural_observations" DROP COLUMN IF EXISTS "store_id";--> statement-breakpoint

-- Step 10: Drop the workspace_stores table last (after all data migrated)
DROP TABLE IF EXISTS "lightfast_workspace_stores" CASCADE;