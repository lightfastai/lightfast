ALTER TABLE "lightfast_workspace_neural_entities" DROP CONSTRAINT "lightfast_workspace_neural_entities_source_observation_id_lightfast_workspace_neural_observations_id_fk";
--> statement-breakpoint
DROP INDEX "obs_embedding_title_idx";--> statement-breakpoint
DROP INDEX "obs_embedding_content_idx";--> statement-breakpoint
DROP INDEX "obs_embedding_summary_idx";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_neural_entities" DROP COLUMN "source_observation_id";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_neural_observations" DROP COLUMN "topics";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_neural_observations" DROP COLUMN "significance_score";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_neural_observations" DROP COLUMN "embedding_vector_id";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_neural_observations" DROP COLUMN "embedding_title_id";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_neural_observations" DROP COLUMN "embedding_content_id";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_neural_observations" DROP COLUMN "embedding_summary_id";