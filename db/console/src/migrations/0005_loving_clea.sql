ALTER TABLE "lightfast_stores" RENAME COLUMN "name" TO "slug";--> statement-breakpoint
DROP INDEX "uq_ws_name";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ws_slug" ON "lightfast_stores" USING btree ("workspace_id","slug");--> statement-breakpoint
ALTER TABLE "lightfast_workspaces" DROP COLUMN "name";