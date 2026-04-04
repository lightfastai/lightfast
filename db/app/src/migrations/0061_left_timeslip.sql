CREATE INDEX "org_integration_provider_resource_status_idx" ON "lightfast_org_integrations" USING btree ("provider_resource_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "org_integration_installation_resource_idx" ON "lightfast_org_integrations" USING btree ("installation_id","provider_resource_id");--> statement-breakpoint
ALTER TABLE "lightfast_gateway_installations" DROP COLUMN "webhook_secret";--> statement-breakpoint
ALTER TABLE "lightfast_gateway_installations" DROP COLUMN "metadata";--> statement-breakpoint
ALTER TABLE "lightfast_gateway_installations" DROP COLUMN "config_status";--> statement-breakpoint
ALTER TABLE "lightfast_org_integrations" DROP COLUMN "last_synced_at";--> statement-breakpoint
ALTER TABLE "lightfast_org_integrations" DROP COLUMN "last_sync_status";--> statement-breakpoint
ALTER TABLE "lightfast_org_integrations" DROP COLUMN "last_sync_error";--> statement-breakpoint
ALTER TABLE "lightfast_org_integrations" DROP COLUMN "connected_at";