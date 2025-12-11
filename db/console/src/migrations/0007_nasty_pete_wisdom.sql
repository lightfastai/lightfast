CREATE TABLE "lightfast_workspace_webhook_payloads" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"delivery_id" varchar(191) NOT NULL,
	"source" varchar(50) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"headers" jsonb NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lightfast_workspace_webhook_payloads" ADD CONSTRAINT "lightfast_workspace_webhook_payloads_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_payload_workspace_received_idx" ON "lightfast_workspace_webhook_payloads" USING btree ("workspace_id","received_at");--> statement-breakpoint
CREATE INDEX "webhook_payload_delivery_idx" ON "lightfast_workspace_webhook_payloads" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "webhook_payload_workspace_source_idx" ON "lightfast_workspace_webhook_payloads" USING btree ("workspace_id","source","event_type");