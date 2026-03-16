ALTER TABLE "lightfast_workspace_entities" ADD COLUMN "state" varchar(100);--> statement-breakpoint
ALTER TABLE "lightfast_workspace_entities" ADD COLUMN "url" varchar(2048);--> statement-breakpoint
ALTER TABLE "lightfast_workspace_entity_edges" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_event_entities" ADD COLUMN "category" varchar(50);--> statement-breakpoint
ALTER TABLE "lightfast_workspace_events" ADD COLUMN "ingest_log_id" bigint;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_events" ADD CONSTRAINT "lightfast_workspace_events_ingest_log_id_lightfast_workspace_ingest_logs_id_fk" FOREIGN KEY ("ingest_log_id") REFERENCES "public"."lightfast_workspace_ingest_logs"("id") ON DELETE set null ON UPDATE no action;