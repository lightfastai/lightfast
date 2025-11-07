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
ALTER TABLE "lightfast_deus_connected_repository" ADD COLUMN "is_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "workspace_org_id_idx" ON "lightfast_workspaces" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workspace_org_default_idx" ON "lightfast_workspaces" USING btree ("organization_id","is_default");--> statement-breakpoint
CREATE INDEX "workspace_org_slug_idx" ON "lightfast_workspaces" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "workspace_active_idx" ON "lightfast_deus_connected_repository" USING btree ("workspace_id","is_active","is_enabled");