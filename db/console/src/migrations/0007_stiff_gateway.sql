DROP INDEX "workspace_active_idx";--> statement-breakpoint
CREATE INDEX "workspace_active_idx" ON "lightfast_connected_repository" USING btree ("workspace_id","is_active");--> statement-breakpoint
ALTER TABLE "lightfast_connected_repository" DROP COLUMN "is_enabled";--> statement-breakpoint
ALTER TABLE "lightfast_docs_documents" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "lightfast_docs_documents" DROP COLUMN "description";