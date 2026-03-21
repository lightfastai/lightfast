ALTER TABLE "lightfast_workspace_api_keys" DROP CONSTRAINT "lightfast_workspace_api_keys_workspace_id_lightfast_org_workspaces_id_fk";
--> statement-breakpoint
DROP INDEX "ws_api_key_workspace_id_idx";--> statement-breakpoint
DROP INDEX "ws_api_key_workspace_active_idx";--> statement-breakpoint
CREATE INDEX "org_api_key_clerk_org_active_idx" ON "lightfast_workspace_api_keys" USING btree ("clerk_org_id","is_active");--> statement-breakpoint
ALTER TABLE "lightfast_workspace_api_keys" DROP COLUMN "workspace_id";