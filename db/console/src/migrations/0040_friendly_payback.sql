ALTER TABLE "lightfast_workspace_observation_clusters" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "lightfast_workspace_observation_clusters" CASCADE;--> statement-breakpoint
DROP INDEX "obs_cluster_idx";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_neural_observations" DROP COLUMN "cluster_id";