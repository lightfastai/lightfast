DROP INDEX "workspace_org_slug_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_org_name_idx" ON "lightfast_workspaces" USING btree ("clerk_org_id","name");--> statement-breakpoint
CREATE INDEX "workspace_slug_idx" ON "lightfast_workspaces" USING btree ("slug");