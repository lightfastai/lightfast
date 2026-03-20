CREATE TABLE "lightfast_workspace_neural_observations" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"store_id" varchar(191) NOT NULL,
	"cluster_id" varchar(191),
	"occurred_at" timestamp with time zone NOT NULL,
	"captured_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"actor" jsonb,
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
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_workspace_observation_clusters" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"topic_label" varchar(255) NOT NULL,
	"topic_embedding_id" varchar(191),
	"keywords" jsonb,
	"primary_entities" jsonb,
	"primary_actors" jsonb,
	"status" varchar(50) DEFAULT 'open' NOT NULL,
	"summary" text,
	"summary_generated_at" timestamp with time zone,
	"observation_count" integer DEFAULT 0 NOT NULL,
	"first_observation_at" timestamp with time zone,
	"last_observation_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
DROP INDEX "idx_stores_ws";--> statement-breakpoint
DROP INDEX "uq_ws_slug";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_neural_observations" ADD CONSTRAINT "lightfast_workspace_neural_observations_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_neural_observations" ADD CONSTRAINT "lightfast_workspace_neural_observations_store_id_lightfast_workspace_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."lightfast_workspace_stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_observation_clusters" ADD CONSTRAINT "lightfast_workspace_observation_clusters_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "obs_workspace_occurred_idx" ON "lightfast_workspace_neural_observations" USING btree ("workspace_id","occurred_at");--> statement-breakpoint
CREATE INDEX "obs_cluster_idx" ON "lightfast_workspace_neural_observations" USING btree ("cluster_id");--> statement-breakpoint
CREATE INDEX "obs_source_idx" ON "lightfast_workspace_neural_observations" USING btree ("workspace_id","source","source_type");--> statement-breakpoint
CREATE INDEX "obs_source_id_idx" ON "lightfast_workspace_neural_observations" USING btree ("workspace_id","source_id");--> statement-breakpoint
CREATE INDEX "obs_type_idx" ON "lightfast_workspace_neural_observations" USING btree ("workspace_id","observation_type");--> statement-breakpoint
CREATE INDEX "cluster_workspace_status_idx" ON "lightfast_workspace_observation_clusters" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "cluster_last_observation_idx" ON "lightfast_workspace_observation_clusters" USING btree ("workspace_id","last_observation_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ws_store" ON "lightfast_workspace_stores" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "lightfast_workspace_stores" DROP COLUMN "slug";