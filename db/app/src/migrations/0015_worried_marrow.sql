-- Pre-production migration: Drop and recreate workspace_neural_observations with BIGINT PK
-- This is a breaking change - only safe because we're pre-production with no data to preserve

-- First drop the table (cascade will handle any FKs pointing to it)
DROP TABLE IF EXISTS "lightfast_workspace_neural_observations" CASCADE;--> statement-breakpoint

-- Recreate with new schema
CREATE TABLE "lightfast_workspace_neural_observations" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "external_id" varchar(21) NOT NULL UNIQUE,
  "workspace_id" varchar(191) NOT NULL REFERENCES "lightfast_org_workspaces"("id") ON DELETE CASCADE,
  "cluster_id" bigint,
  "occurred_at" timestamp with time zone NOT NULL,
  "captured_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actor" jsonb,
  "actor_id" bigint,
  "observation_type" varchar(100) NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "topics" jsonb,
  "significance_score" real,
  "source" varchar(50) NOT NULL,
  "source_type" varchar(100) NOT NULL,
  "source_id" varchar(255) NOT NULL,
  "source_references" jsonb,
  "metadata" jsonb,
  "embedding_vector_id" varchar(191),
  "embedding_title_id" varchar(191),
  "embedding_content_id" varchar(191),
  "embedding_summary_id" varchar(191),
  "created_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);--> statement-breakpoint

-- Create indexes
CREATE UNIQUE INDEX "obs_external_id_idx" ON "lightfast_workspace_neural_observations" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "obs_workspace_occurred_idx" ON "lightfast_workspace_neural_observations" USING btree ("workspace_id", "occurred_at");--> statement-breakpoint
CREATE INDEX "obs_cluster_idx" ON "lightfast_workspace_neural_observations" USING btree ("cluster_id");--> statement-breakpoint
CREATE INDEX "obs_source_idx" ON "lightfast_workspace_neural_observations" USING btree ("workspace_id", "source", "source_type");--> statement-breakpoint
CREATE INDEX "obs_source_id_idx" ON "lightfast_workspace_neural_observations" USING btree ("workspace_id", "source_id");--> statement-breakpoint
CREATE INDEX "obs_type_idx" ON "lightfast_workspace_neural_observations" USING btree ("workspace_id", "observation_type");--> statement-breakpoint
CREATE INDEX "obs_embedding_title_idx" ON "lightfast_workspace_neural_observations" USING btree ("workspace_id", "embedding_title_id");--> statement-breakpoint
CREATE INDEX "obs_embedding_content_idx" ON "lightfast_workspace_neural_observations" USING btree ("workspace_id", "embedding_content_id");--> statement-breakpoint
CREATE INDEX "obs_embedding_summary_idx" ON "lightfast_workspace_neural_observations" USING btree ("workspace_id", "embedding_summary_id");
