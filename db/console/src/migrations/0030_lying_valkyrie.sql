ALTER TABLE "lightfast_user_sources" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "lightfast_user_sources" CASCADE;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" DROP CONSTRAINT "lightfast_workspace_integrations_installation_id_lightfast_gw_installations_id_fk";
--> statement-breakpoint
DROP INDEX "workspace_source_user_source_id_idx";--> statement-breakpoint
DROP INDEX "gw_res_provider_resource_idx";--> statement-breakpoint
ALTER TABLE "lightfast_gw_resources" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" ADD CONSTRAINT "lightfast_workspace_integrations_installation_id_lightfast_gw_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."lightfast_gw_installations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gw_res_provider_resource_idx" ON "lightfast_gw_resources" USING btree ("installation_id","provider_resource_id");--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" DROP COLUMN "user_source_id";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" DROP COLUMN "gateway_installation_id";