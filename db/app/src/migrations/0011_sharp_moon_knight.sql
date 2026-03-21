CREATE TABLE "lightfast_workspace_actor_profiles" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"actor_id" varchar(191) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"email" varchar(255),
	"avatar_url" text,
	"expertise_domains" jsonb,
	"contribution_types" jsonb,
	"active_hours" jsonb,
	"frequent_collaborators" jsonb,
	"profile_embedding_id" varchar(191),
	"observation_count" integer DEFAULT 0 NOT NULL,
	"last_active_at" timestamp with time zone,
	"profile_confidence" real,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_workspace_actor_identities" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"actor_id" varchar(191) NOT NULL,
	"source" varchar(50) NOT NULL,
	"source_id" varchar(255) NOT NULL,
	"source_username" varchar(255),
	"source_email" varchar(255),
	"mapping_method" varchar(50) NOT NULL,
	"confidence_score" real NOT NULL,
	"mapped_by" varchar(191),
	"mapped_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lightfast_workspace_neural_observations" ADD COLUMN "actor_id" varchar(191);--> statement-breakpoint
ALTER TABLE "lightfast_workspace_actor_profiles" ADD CONSTRAINT "lightfast_workspace_actor_profiles_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_actor_identities" ADD CONSTRAINT "lightfast_workspace_actor_identities_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "actor_profile_unique_idx" ON "lightfast_workspace_actor_profiles" USING btree ("workspace_id","actor_id");--> statement-breakpoint
CREATE INDEX "actor_profile_workspace_idx" ON "lightfast_workspace_actor_profiles" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "actor_profile_last_active_idx" ON "lightfast_workspace_actor_profiles" USING btree ("workspace_id","last_active_at");--> statement-breakpoint
CREATE UNIQUE INDEX "actor_identity_unique_idx" ON "lightfast_workspace_actor_identities" USING btree ("workspace_id","source","source_id");--> statement-breakpoint
CREATE INDEX "actor_identity_actor_idx" ON "lightfast_workspace_actor_identities" USING btree ("workspace_id","actor_id");--> statement-breakpoint
CREATE INDEX "actor_identity_email_idx" ON "lightfast_workspace_actor_identities" USING btree ("workspace_id","source_email");