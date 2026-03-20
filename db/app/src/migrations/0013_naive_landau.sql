CREATE TABLE "lightfast_workspace_temporal_states" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(191) NOT NULL,
	"entity_name" varchar(255),
	"state_type" varchar(50) NOT NULL,
	"state_value" varchar(255) NOT NULL,
	"previous_value" varchar(255),
	"state_metadata" jsonb,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"is_current" boolean DEFAULT true NOT NULL,
	"changed_by_actor_id" varchar(191),
	"change_reason" text,
	"source_observation_id" varchar(191),
	"source" varchar(50),
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lightfast_workspace_temporal_states" ADD CONSTRAINT "lightfast_workspace_temporal_states_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "temporal_entity_time_idx" ON "lightfast_workspace_temporal_states" USING btree ("workspace_id","entity_type","entity_id","state_type","valid_from");--> statement-breakpoint
CREATE INDEX "temporal_current_idx" ON "lightfast_workspace_temporal_states" USING btree ("workspace_id","entity_type","entity_id","is_current");--> statement-breakpoint
CREATE INDEX "temporal_workspace_entity_idx" ON "lightfast_workspace_temporal_states" USING btree ("workspace_id","entity_type");--> statement-breakpoint
CREATE INDEX "temporal_source_obs_idx" ON "lightfast_workspace_temporal_states" USING btree ("source_observation_id");