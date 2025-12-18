ALTER TABLE "lightfast_org_workspaces" ALTER COLUMN "settings" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" DROP COLUMN "index_name";--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" DROP COLUMN "namespace_name";--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" DROP COLUMN "embedding_dim";--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" DROP COLUMN "embedding_model";--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" DROP COLUMN "embedding_provider";--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" DROP COLUMN "pinecone_metric";--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" DROP COLUMN "pinecone_cloud";--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" DROP COLUMN "pinecone_region";--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" DROP COLUMN "chunk_max_tokens";--> statement-breakpoint
ALTER TABLE "lightfast_org_workspaces" DROP COLUMN "chunk_overlap";