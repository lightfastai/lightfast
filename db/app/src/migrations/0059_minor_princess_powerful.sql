CREATE TABLE "lightfast_gateway_lifecycle_logs" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"installation_id" varchar(191) NOT NULL,
	"event" varchar(50) NOT NULL,
	"from_status" varchar(50),
	"to_status" varchar(50),
	"resource_ids" jsonb,
	"metadata" jsonb,
	"reason" text,
	"occurred_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
DROP INDEX "workspace_source_is_active_idx";--> statement-breakpoint
ALTER TABLE "lightfast_gateway_installations" ADD COLUMN "health_status" varchar(50) DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_gateway_installations" ADD COLUMN "last_health_check_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lightfast_gateway_installations" ADD COLUMN "health_check_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_gateway_installations" ADD COLUMN "config_status" varchar(50) DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_gateway_webhook_deliveries" ADD COLUMN "fail_reason" varchar(100);--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" ADD COLUMN "status" varchar(50) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" ADD COLUMN "status_reason" varchar(100);--> statement-breakpoint
ALTER TABLE "lightfast_gateway_lifecycle_logs" ADD CONSTRAINT "lightfast_gateway_lifecycle_logs_installation_id_lightfast_gateway_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."lightfast_gateway_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gateway_ll_installation_idx" ON "lightfast_gateway_lifecycle_logs" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "gateway_ll_installation_occurred_idx" ON "lightfast_gateway_lifecycle_logs" USING btree ("installation_id","occurred_at");--> statement-breakpoint
CREATE INDEX "gateway_ll_event_idx" ON "lightfast_gateway_lifecycle_logs" USING btree ("event");--> statement-breakpoint
CREATE INDEX "gateway_wd_recovery_idx" ON "lightfast_gateway_webhook_deliveries" USING btree ("status","received_at") WHERE "lightfast_gateway_webhook_deliveries"."status" = 'received';--> statement-breakpoint
CREATE INDEX "workspace_source_status_idx" ON "lightfast_workspace_integrations" USING btree ("status");--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" DROP COLUMN "is_active";