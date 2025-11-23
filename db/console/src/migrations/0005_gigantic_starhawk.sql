CREATE TABLE "lightfast_user_sources" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"user_id" varchar(191) NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"scopes" text[],
	"provider_metadata" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_workspace_sources" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"user_source_id" varchar(191) NOT NULL,
	"connected_by" varchar(191) NOT NULL,
	"resource_data" jsonb NOT NULL,
	"sync_config" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp,
	"last_sync_status" varchar(50),
	"last_sync_error" text,
	"document_count" integer DEFAULT 0 NOT NULL,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lightfast_workspace_sources" ADD CONSTRAINT "lightfast_workspace_sources_workspace_id_lightfast_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_sources" ADD CONSTRAINT "lightfast_workspace_sources_user_source_id_lightfast_user_sources_id_fk" FOREIGN KEY ("user_source_id") REFERENCES "public"."lightfast_user_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_source_user_id_idx" ON "lightfast_user_sources" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_source_provider_idx" ON "lightfast_user_sources" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "user_source_is_active_idx" ON "lightfast_user_sources" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "user_source_user_provider_idx" ON "lightfast_user_sources" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "workspace_source_workspace_id_idx" ON "lightfast_workspace_sources" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_source_user_source_id_idx" ON "lightfast_workspace_sources" USING btree ("user_source_id");--> statement-breakpoint
CREATE INDEX "workspace_source_connected_by_idx" ON "lightfast_workspace_sources" USING btree ("connected_by");--> statement-breakpoint
CREATE INDEX "workspace_source_is_active_idx" ON "lightfast_workspace_sources" USING btree ("is_active");