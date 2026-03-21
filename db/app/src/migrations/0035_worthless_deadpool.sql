CREATE TABLE "lightfast_workspace_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lightfast_workspace_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"workspace_id" varchar(191) NOT NULL,
	"delivery_id" varchar(191) NOT NULL,
	"source" varchar(50) NOT NULL,
	"source_type" varchar(100) NOT NULL,
	"source_event" jsonb NOT NULL,
	"ingestion_source" varchar(20) DEFAULT 'webhook' NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "lightfast_workspace_webhook_payloads" CASCADE;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_events" ADD CONSTRAINT "lightfast_workspace_events_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_event_cursor_idx" ON "lightfast_workspace_events" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE INDEX "event_delivery_idx" ON "lightfast_workspace_events" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "workspace_event_source_idx" ON "lightfast_workspace_events" USING btree ("workspace_id","source","source_type");