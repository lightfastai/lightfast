ALTER TABLE "lightfast_workspace_integrations" DROP CONSTRAINT IF EXISTS "lightfast_workspace_integrations_installation_id_lightfast_gw_installations_id_fk";
ALTER TABLE "lightfast_workspace_integrations" DROP CONSTRAINT IF EXISTS "lightfast_workspace_integrations_installation_id_lightfast_gw_i";
--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" ALTER COLUMN "installation_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" ADD CONSTRAINT "lightfast_workspace_integrations_installation_id_lightfast_gw_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."lightfast_gw_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_gw_installations" DROP COLUMN "account_login";