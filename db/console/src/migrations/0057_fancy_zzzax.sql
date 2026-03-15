DROP INDEX "gateway_br_installation_entity_idx";--> statement-breakpoint
ALTER TABLE "lightfast_gateway_backfill_runs" ADD COLUMN "provider_resource_id" varchar(191) DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_br_installation_resource_entity_idx" ON "lightfast_gateway_backfill_runs" USING btree ("installation_id","provider_resource_id","entity_type");