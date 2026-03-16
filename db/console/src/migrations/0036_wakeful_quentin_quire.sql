DELETE FROM "lightfast_workspace_integrations" WHERE "provider" IS NULL;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" ALTER COLUMN "provider" SET NOT NULL;