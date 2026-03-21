CREATE TABLE "lightfast_workspace_neural_entities" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"category" varchar(50) NOT NULL,
	"key" varchar(500) NOT NULL,
	"value" text,
	"aliases" jsonb,
	"source_observation_id" varchar(191),
	"evidence_snippet" text,
	"confidence" real DEFAULT 0.8,
	"extracted_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lightfast_workspace_neural_entities" ADD CONSTRAINT "lightfast_workspace_neural_entities_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_neural_entities" ADD CONSTRAINT "lightfast_workspace_neural_entities_source_observation_id_lightfast_workspace_neural_observations_id_fk" FOREIGN KEY ("source_observation_id") REFERENCES "public"."lightfast_workspace_neural_observations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entity_workspace_category_key_idx" ON "lightfast_workspace_neural_entities" USING btree ("workspace_id","category","key");--> statement-breakpoint
CREATE INDEX "entity_workspace_category_idx" ON "lightfast_workspace_neural_entities" USING btree ("workspace_id","category");--> statement-breakpoint
CREATE INDEX "entity_workspace_key_idx" ON "lightfast_workspace_neural_entities" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE INDEX "entity_workspace_last_seen_idx" ON "lightfast_workspace_neural_entities" USING btree ("workspace_id","last_seen_at");