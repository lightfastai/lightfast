-- Migration: Phase 5 - Tier 2 Tables BIGINT Migration
-- Tables: workspace_neural_entities, workspace_observation_clusters, workspace_actor_profiles
-- Pattern: BIGINT primary key + externalId (nanoid)
-- Note: Pre-production - using DROP/CREATE since no data to preserve

-- ============================================================
-- workspace_observation_clusters
-- ============================================================
DROP TABLE IF EXISTS "lightfast_workspace_observation_clusters" CASCADE;--> statement-breakpoint

CREATE TABLE "lightfast_workspace_observation_clusters" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "external_id" varchar(21) NOT NULL UNIQUE,
  "workspace_id" varchar(191) NOT NULL REFERENCES "lightfast_org_workspaces"("id") ON DELETE CASCADE,
  "topic_label" varchar(255) NOT NULL,
  "topic_embedding_id" varchar(191),
  "keywords" jsonb,
  "primary_entities" jsonb,
  "primary_actors" jsonb,
  "status" varchar(50) NOT NULL DEFAULT 'open',
  "summary" text,
  "summary_generated_at" timestamp with time zone,
  "observation_count" integer NOT NULL DEFAULT 0,
  "first_observation_at" timestamp with time zone,
  "last_observation_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);--> statement-breakpoint

CREATE UNIQUE INDEX "cluster_external_id_idx" ON "lightfast_workspace_observation_clusters" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "cluster_workspace_status_idx" ON "lightfast_workspace_observation_clusters" USING btree ("workspace_id", "status");--> statement-breakpoint
CREATE INDEX "cluster_last_observation_idx" ON "lightfast_workspace_observation_clusters" USING btree ("workspace_id", "last_observation_at");--> statement-breakpoint

-- ============================================================
-- workspace_actor_profiles
-- ============================================================
DROP TABLE IF EXISTS "lightfast_workspace_actor_profiles" CASCADE;--> statement-breakpoint

CREATE TABLE "lightfast_workspace_actor_profiles" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "external_id" varchar(21) NOT NULL UNIQUE,
  "workspace_id" varchar(191) NOT NULL REFERENCES "lightfast_org_workspaces"("id") ON DELETE CASCADE,
  "actor_id" varchar(191) NOT NULL,
  "display_name" varchar(255) NOT NULL,
  "email" varchar(255),
  "avatar_url" text,
  "expertise_domains" jsonb,
  "contribution_types" jsonb,
  "active_hours" jsonb,
  "frequent_collaborators" jsonb,
  "profile_embedding_id" varchar(191),
  "observation_count" integer NOT NULL DEFAULT 0,
  "last_active_at" timestamp with time zone,
  "profile_confidence" real,
  "created_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);--> statement-breakpoint

CREATE UNIQUE INDEX "actor_profile_external_id_idx" ON "lightfast_workspace_actor_profiles" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "actor_profile_unique_idx" ON "lightfast_workspace_actor_profiles" USING btree ("workspace_id", "actor_id");--> statement-breakpoint
CREATE INDEX "actor_profile_workspace_idx" ON "lightfast_workspace_actor_profiles" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "actor_profile_last_active_idx" ON "lightfast_workspace_actor_profiles" USING btree ("workspace_id", "last_active_at");--> statement-breakpoint

-- ============================================================
-- workspace_neural_entities (depends on observations FK)
-- ============================================================
DROP TABLE IF EXISTS "lightfast_workspace_neural_entities" CASCADE;--> statement-breakpoint

CREATE TABLE "lightfast_workspace_neural_entities" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "external_id" varchar(21) NOT NULL UNIQUE,
  "workspace_id" varchar(191) NOT NULL REFERENCES "lightfast_org_workspaces"("id") ON DELETE CASCADE,
  "category" varchar(50) NOT NULL,
  "key" varchar(500) NOT NULL,
  "value" text,
  "aliases" jsonb,
  "source_observation_id" bigint REFERENCES "lightfast_workspace_neural_observations"("id") ON DELETE SET NULL,
  "evidence_snippet" text,
  "confidence" real DEFAULT 0.8,
  "extracted_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "occurrence_count" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);--> statement-breakpoint

CREATE UNIQUE INDEX "entity_external_id_idx" ON "lightfast_workspace_neural_entities" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_workspace_category_key_idx" ON "lightfast_workspace_neural_entities" USING btree ("workspace_id", "category", "key");--> statement-breakpoint
CREATE INDEX "entity_workspace_category_idx" ON "lightfast_workspace_neural_entities" USING btree ("workspace_id", "category");--> statement-breakpoint
CREATE INDEX "entity_workspace_key_idx" ON "lightfast_workspace_neural_entities" USING btree ("workspace_id", "key");--> statement-breakpoint
CREATE INDEX "entity_workspace_last_seen_idx" ON "lightfast_workspace_neural_entities" USING btree ("workspace_id", "last_seen_at");
