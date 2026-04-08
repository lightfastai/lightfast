CREATE TABLE "lightfast_org_repo_indexes" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"clerk_org_id" varchar(191) NOT NULL,
	"integration_id" varchar(191) NOT NULL,
	"repo_full_name" varchar(255) NOT NULL,
	"provider_resource_id" varchar(191) NOT NULL,
	"cached_content" text,
	"content_sha" varchar(64),
	"last_sync_commit_sha" varchar(64),
	"is_active" boolean DEFAULT true NOT NULL,
	"indexing_status" varchar(50) DEFAULT 'idle' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lightfast_org_repo_indexes" ADD CONSTRAINT "lightfast_org_repo_indexes_integration_id_lightfast_org_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."lightfast_org_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_repo_index_clerk_org_id_idx" ON "lightfast_org_repo_indexes" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE INDEX "org_repo_index_integration_id_idx" ON "lightfast_org_repo_indexes" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX "org_repo_index_provider_resource_id_idx" ON "lightfast_org_repo_indexes" USING btree ("provider_resource_id");