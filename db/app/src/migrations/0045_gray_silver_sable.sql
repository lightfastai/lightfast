CREATE TABLE "lightfast_workspace_edges" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lightfast_workspace_edges_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"external_id" varchar(21) NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"source_entity_id" bigint NOT NULL,
	"target_entity_id" bigint NOT NULL,
	"relationship_type" varchar(50) NOT NULL,
	"source_event_id" bigint,
	"confidence" real DEFAULT 1 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "lightfast_workspace_edges_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
ALTER TABLE "lightfast_workspace_edges" ADD CONSTRAINT "lightfast_workspace_edges_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_edges" ADD CONSTRAINT "lightfast_workspace_edges_source_entity_id_lightfast_workspace_neural_entities_id_fk" FOREIGN KEY ("source_entity_id") REFERENCES "public"."lightfast_workspace_neural_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_edges" ADD CONSTRAINT "lightfast_workspace_edges_target_entity_id_lightfast_workspace_neural_entities_id_fk" FOREIGN KEY ("target_entity_id") REFERENCES "public"."lightfast_workspace_neural_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_edges" ADD CONSTRAINT "lightfast_workspace_edges_source_event_id_lightfast_workspace_neural_observations_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."lightfast_workspace_neural_observations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "edge_external_id_idx" ON "lightfast_workspace_edges" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "edge_source_idx" ON "lightfast_workspace_edges" USING btree ("workspace_id","source_entity_id");--> statement-breakpoint
CREATE INDEX "edge_target_idx" ON "lightfast_workspace_edges" USING btree ("workspace_id","target_entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "edge_unique_idx" ON "lightfast_workspace_edges" USING btree ("workspace_id","source_entity_id","target_entity_id","relationship_type");--> statement-breakpoint
CREATE INDEX "edge_source_event_idx" ON "lightfast_workspace_edges" USING btree ("source_event_id");