CREATE TABLE "lightfast_workspace_entity_observations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lightfast_workspace_entity_observations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"entity_id" bigint NOT NULL,
	"observation_id" bigint NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"ref_label" varchar(50),
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_workspace_observation_interpretations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lightfast_workspace_observation_interpretations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"observation_id" bigint NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"primary_category" varchar(50),
	"topics" jsonb,
	"significance_score" real,
	"embedding_title_id" varchar(191),
	"embedding_content_id" varchar(191),
	"embedding_summary_id" varchar(191),
	"model_version" varchar(100),
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lightfast_workspace_entity_observations" ADD CONSTRAINT "lightfast_workspace_entity_observations_entity_id_lightfast_workspace_neural_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."lightfast_workspace_neural_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_entity_observations" ADD CONSTRAINT "lightfast_workspace_entity_observations_observation_id_lightfast_workspace_neural_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."lightfast_workspace_neural_observations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_entity_observations" ADD CONSTRAINT "lightfast_workspace_entity_observations_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_observation_interpretations" ADD CONSTRAINT "lightfast_workspace_observation_interpretations_observation_id_lightfast_workspace_neural_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."lightfast_workspace_neural_observations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_observation_interpretations" ADD CONSTRAINT "lightfast_workspace_observation_interpretations_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "eo_entity_obs_idx" ON "lightfast_workspace_entity_observations" USING btree ("entity_id","observation_id");--> statement-breakpoint
CREATE INDEX "eo_entity_idx" ON "lightfast_workspace_entity_observations" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "eo_observation_idx" ON "lightfast_workspace_entity_observations" USING btree ("observation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "interp_obs_version_idx" ON "lightfast_workspace_observation_interpretations" USING btree ("observation_id","version");--> statement-breakpoint
CREATE INDEX "interp_obs_idx" ON "lightfast_workspace_observation_interpretations" USING btree ("observation_id");--> statement-breakpoint
CREATE INDEX "interp_workspace_processed_idx" ON "lightfast_workspace_observation_interpretations" USING btree ("workspace_id","processed_at");--> statement-breakpoint
CREATE INDEX "interp_embedding_title_idx" ON "lightfast_workspace_observation_interpretations" USING btree ("workspace_id","embedding_title_id");--> statement-breakpoint
CREATE INDEX "interp_embedding_content_idx" ON "lightfast_workspace_observation_interpretations" USING btree ("workspace_id","embedding_content_id");--> statement-breakpoint
CREATE INDEX "interp_embedding_summary_idx" ON "lightfast_workspace_observation_interpretations" USING btree ("workspace_id","embedding_summary_id");