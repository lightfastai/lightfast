-- Step 1: Backfill existing NULL values with defaults (required before adding NOT NULL constraints)
UPDATE "lightfast_org_workspaces" SET "embedding_dim" = 1024 WHERE "embedding_dim" IS NULL;--> statement-breakpoint
UPDATE "lightfast_org_workspaces" SET "embedding_model" = 'embed-english-v3.0' WHERE "embedding_model" IS NULL;--> statement-breakpoint
UPDATE "lightfast_org_workspaces" SET "embedding_provider" = 'cohere' WHERE "embedding_provider" IS NULL;--> statement-breakpoint
UPDATE "lightfast_org_workspaces" SET "pinecone_metric" = 'cosine' WHERE "pinecone_metric" IS NULL;--> statement-breakpoint
UPDATE "lightfast_org_workspaces" SET "pinecone_cloud" = 'aws' WHERE "pinecone_cloud" IS NULL;--> statement-breakpoint
UPDATE "lightfast_org_workspaces" SET "pinecone_region" = 'us-east-1' WHERE "pinecone_region" IS NULL;--> statement-breakpoint
UPDATE "lightfast_org_workspaces" SET "chunk_max_tokens" = 512 WHERE "chunk_max_tokens" IS NULL;--> statement-breakpoint
UPDATE "lightfast_org_workspaces" SET "chunk_overlap" = 50 WHERE "chunk_overlap" IS NULL;--> statement-breakpoint
-- Step 2: Add column defaults for future inserts
ALTER TABLE "lightfast_org_workspaces" ALTER COLUMN "embedding_dim" SET DEFAULT 1024;--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" ALTER COLUMN "embedding_model" SET DEFAULT 'embed-english-v3.0';--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" ALTER COLUMN "embedding_provider" SET DEFAULT 'cohere';--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" ALTER COLUMN "pinecone_metric" SET DEFAULT 'cosine';--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" ALTER COLUMN "pinecone_cloud" SET DEFAULT 'aws';--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" ALTER COLUMN "pinecone_region" SET DEFAULT 'us-east-1';--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" ALTER COLUMN "chunk_max_tokens" SET DEFAULT 512;--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" ALTER COLUMN "chunk_overlap" SET DEFAULT 50;--> statement-breakpoint
-- Step 3: Add NOT NULL constraints (safe now that all rows have values)
ALTER TABLE "lightfast_org_workspaces" ALTER COLUMN "embedding_dim" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" ALTER COLUMN "embedding_model" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" ALTER COLUMN "embedding_provider" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" ALTER COLUMN "pinecone_metric" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" ALTER COLUMN "pinecone_cloud" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" ALTER COLUMN "pinecone_region" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" ALTER COLUMN "chunk_max_tokens" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" ALTER COLUMN "chunk_overlap" SET NOT NULL;