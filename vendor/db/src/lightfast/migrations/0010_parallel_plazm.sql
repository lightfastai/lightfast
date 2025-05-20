ALTER TABLE "user" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspace" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "user" CASCADE;--> statement-breakpoint
DROP TABLE "workspace" CASCADE;--> statement-breakpoint
-- ALTER TABLE "session" DROP CONSTRAINT "session_workspace_id_workspace_id_fk";
--> statement-breakpoint
DROP INDEX "session_workspace_idx";--> statement-breakpoint
ALTER TABLE "session" DROP COLUMN "workspace_id";