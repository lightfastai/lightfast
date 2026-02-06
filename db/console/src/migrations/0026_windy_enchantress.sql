CREATE TABLE "lightfast_workspace_observation_relationships" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lightfast_workspace_observation_relationships_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"external_id" varchar(21) NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"source_observation_id" bigint NOT NULL,
	"target_observation_id" bigint NOT NULL,
	"relationship_type" varchar(50) NOT NULL,
	"linking_key" varchar(500),
	"linking_key_type" varchar(50),
	"confidence" real DEFAULT 1 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "lightfast_workspace_observation_relationships_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
DROP TABLE "lightfast_observation_relationships" CASCADE;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_observation_relationships" ADD CONSTRAINT "lightfast_workspace_observation_relationships_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_observation_relationships" ADD CONSTRAINT "lightfast_workspace_observation_relationships_source_observation_id_lightfast_workspace_neural_observations_id_fk" FOREIGN KEY ("source_observation_id") REFERENCES "public"."lightfast_workspace_neural_observations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_observation_relationships" ADD CONSTRAINT "lightfast_workspace_observation_relationships_target_observation_id_lightfast_workspace_neural_observations_id_fk" FOREIGN KEY ("target_observation_id") REFERENCES "public"."lightfast_workspace_neural_observations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ws_obs_rel_external_id_idx" ON "lightfast_workspace_observation_relationships" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "ws_obs_rel_source_idx" ON "lightfast_workspace_observation_relationships" USING btree ("workspace_id","source_observation_id");--> statement-breakpoint
CREATE INDEX "ws_obs_rel_target_idx" ON "lightfast_workspace_observation_relationships" USING btree ("workspace_id","target_observation_id");--> statement-breakpoint
CREATE INDEX "ws_obs_rel_linking_key_idx" ON "lightfast_workspace_observation_relationships" USING btree ("workspace_id","linking_key");--> statement-breakpoint
CREATE UNIQUE INDEX "ws_obs_rel_unique_edge_idx" ON "lightfast_workspace_observation_relationships" USING btree ("workspace_id","source_observation_id","target_observation_id","relationship_type");