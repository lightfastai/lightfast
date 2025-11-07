CREATE TYPE "public"."config_status" AS ENUM('configured', 'unconfigured', 'ingesting', 'error', 'pending');--> statement-breakpoint
CREATE TABLE "lightfast_deus_connected_repository" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"organization_id" varchar(191) NOT NULL,
	"github_repo_id" varchar(191) NOT NULL,
	"github_installation_id" varchar(191) NOT NULL,
	"permissions" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"last_synced_at" timestamp,
	"config_status" "config_status" DEFAULT 'pending' NOT NULL,
	"config_path" varchar(255),
	"config_detected_at" timestamp,
	"workspace_id" varchar(191),
	"document_count" integer DEFAULT 0 NOT NULL,
	"last_ingested_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "lightfast_deus_connected_repository_github_repo_id_unique" UNIQUE("github_repo_id")
);
--> statement-breakpoint
CREATE TABLE "lightfast_deus_organizations" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"github_org_id" integer NOT NULL,
	"github_installation_id" integer NOT NULL,
	"github_org_slug" varchar(255) NOT NULL,
	"github_org_name" varchar(255) NOT NULL,
	"github_org_avatar_url" text,
	"clerk_org_id" varchar(191),
	"clerk_org_slug" varchar(255),
	"claimed_by" varchar(191) NOT NULL,
	"claimed_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "lightfast_deus_organizations_github_org_id_unique" UNIQUE("github_org_id"),
	CONSTRAINT "lightfast_deus_organizations_clerk_org_id_unique" UNIQUE("clerk_org_id")
);
--> statement-breakpoint
CREATE INDEX "org_id_idx" ON "lightfast_deus_connected_repository" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "org_active_idx" ON "lightfast_deus_connected_repository" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "installation_idx" ON "lightfast_deus_connected_repository" USING btree ("github_installation_id");--> statement-breakpoint
CREATE INDEX "org_slug_idx" ON "lightfast_deus_organizations" USING btree ("github_org_slug");--> statement-breakpoint
CREATE INDEX "org_installation_idx" ON "lightfast_deus_organizations" USING btree ("github_installation_id");--> statement-breakpoint
CREATE INDEX "org_clerk_org_idx" ON "lightfast_deus_organizations" USING btree ("clerk_org_id");