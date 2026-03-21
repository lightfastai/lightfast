DROP INDEX "workspace_event_source_idx";--> statement-breakpoint
CREATE INDEX "workspace_ingest_log_provider_idx" ON "lightfast_workspace_ingest_logs" USING btree (("source_event"->>'provider'));--> statement-breakpoint
ALTER TABLE "lightfast_workspace_ingest_logs" DROP COLUMN "source";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_ingest_logs" DROP COLUMN "source_type";