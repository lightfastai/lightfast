-- Backfill provider from providerConfig JSONB for rows added before this column existed
UPDATE "lightfast_workspace_integrations" SET "provider" = "provider_config"->>'provider' WHERE "provider" IS NULL;
ALTER TABLE "lightfast_workspace_integrations" ALTER COLUMN "provider" SET NOT NULL;