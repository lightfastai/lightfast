-- Custom SQL migration file, put your code below! --

-- Migration: Unified sourceConfig architecture
-- This migration replaces the separate resourceData and syncConfig columns
-- with a unified sourceConfig column, and adds providerResourceId for fast lookups.

-- Step 1: Add new columns (nullable initially to allow data migration)
ALTER TABLE "lightfast_workspace_sources"
  ADD COLUMN "source_config" jsonb,
  ADD COLUMN "provider_resource_id" varchar(191);

-- Step 2: Migrate data from old columns to new columns
-- Merge resourceData + syncConfig into sourceConfig, extract providerResourceId

-- For GitHub repositories: merge fields and extract repoId
UPDATE "lightfast_workspace_sources"
SET
  "source_config" = jsonb_build_object(
    'provider', (resource_data->>'provider'),
    'type', (resource_data->>'type'),
    'installationId', (resource_data->>'installationId'),
    'repoId', (resource_data->>'repoId'),
    'repoName', (resource_data->>'repoName'),
    'repoFullName', (resource_data->>'repoFullName'),
    'defaultBranch', (resource_data->>'defaultBranch'),
    'isPrivate', (resource_data->>'isPrivate')::boolean,
    'isArchived', (resource_data->>'isArchived')::boolean,
    'sync', jsonb_build_object(
      'branches', COALESCE(sync_config->'branches', '[]'::jsonb),
      'paths', COALESCE(sync_config->'paths', '[]'::jsonb),
      'events', COALESCE(sync_config->'events', '[]'::jsonb),
      'autoSync', COALESCE((sync_config->>'autoSync')::boolean, true)
    )
  ),
  "provider_resource_id" = resource_data->>'repoId'
WHERE resource_data->>'provider' = 'github';

-- For Linear teams: merge fields and extract teamId
UPDATE "lightfast_workspace_sources"
SET
  "source_config" = jsonb_build_object(
    'provider', (resource_data->>'provider'),
    'type', (resource_data->>'type'),
    'teamId', (resource_data->>'teamId'),
    'teamKey', (resource_data->>'teamKey'),
    'teamName', (resource_data->>'teamName'),
    'sync', jsonb_build_object(
      'events', COALESCE(sync_config->'events', '[]'::jsonb),
      'autoSync', COALESCE((sync_config->>'autoSync')::boolean, true)
    )
  ),
  "provider_resource_id" = resource_data->>'teamId'
WHERE resource_data->>'provider' = 'linear';

-- For Notion pages/databases: merge fields and extract pageId or databaseId
UPDATE "lightfast_workspace_sources"
SET
  "source_config" = jsonb_build_object(
    'provider', (resource_data->>'provider'),
    'type', (resource_data->>'type'),
    'pageId', (resource_data->>'pageId'),
    'pageName', (resource_data->>'pageName'),
    'sync', jsonb_build_object(
      'events', COALESCE(sync_config->'events', '[]'::jsonb),
      'autoSync', COALESCE((sync_config->>'autoSync')::boolean, true)
    )
  ),
  "provider_resource_id" = COALESCE(
    resource_data->>'pageId',
    resource_data->>'databaseId'
  )
WHERE resource_data->>'provider' = 'notion';

-- For Sentry projects: merge fields and extract projectId
UPDATE "lightfast_workspace_sources"
SET
  "source_config" = jsonb_build_object(
    'provider', (resource_data->>'provider'),
    'type', (resource_data->>'type'),
    'orgSlug', (resource_data->>'orgSlug'),
    'projectSlug', (resource_data->>'projectSlug'),
    'projectId', (resource_data->>'projectId'),
    'sync', jsonb_build_object(
      'events', COALESCE(sync_config->'events', '[]'::jsonb),
      'autoSync', COALESCE((sync_config->>'autoSync')::boolean, true)
    )
  ),
  "provider_resource_id" = resource_data->>'projectId'
WHERE resource_data->>'provider' = 'sentry';

-- Step 3: Make new columns non-nullable (now that data is migrated)
ALTER TABLE "lightfast_workspace_sources"
  ALTER COLUMN "source_config" SET NOT NULL,
  ALTER COLUMN "provider_resource_id" SET NOT NULL;

-- Step 4: Create index on provider_resource_id for fast lookups
CREATE INDEX "workspace_source_provider_resource_id_idx"
  ON "lightfast_workspace_sources" USING btree ("provider_resource_id");

-- Step 5: Drop old columns
ALTER TABLE "lightfast_workspace_sources"
  DROP COLUMN "resource_data",
  DROP COLUMN "sync_config";

-- Migration complete!
-- Old columns (resourceData, syncConfig) have been merged into sourceConfig
-- New providerResourceId column added with index for fast lookups
