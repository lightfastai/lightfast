-- Migration: Convert all timestamp columns to timestamptz
-- Generated: 2025-11-24
-- Purpose: Fix timezone handling bug where timestamps were stored without timezone information

-- Jobs table
ALTER TABLE "lightfast_jobs"
  ALTER COLUMN "started_at" TYPE timestamptz USING "started_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "completed_at" TYPE timestamptz USING "completed_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- Workspaces table
ALTER TABLE "lightfast_workspaces"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- Workspace Sources table
ALTER TABLE "lightfast_workspace_sources"
  ALTER COLUMN "last_synced_at" TYPE timestamptz USING "last_synced_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "connected_at" TYPE timestamptz USING "connected_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- User Sources table
ALTER TABLE "lightfast_user_sources"
  ALTER COLUMN "token_expires_at" TYPE timestamptz USING "token_expires_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "connected_at" TYPE timestamptz USING "connected_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "last_sync_at" TYPE timestamptz USING "last_sync_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- Metrics table
ALTER TABLE "lightfast_metrics"
  ALTER COLUMN "timestamp" TYPE timestamptz USING "timestamp" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

-- API Keys table
ALTER TABLE "lightfast_api_keys"
  ALTER COLUMN "expires_at" TYPE timestamptz USING "expires_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "last_used_at" TYPE timestamptz USING "last_used_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- Ingestion Events table
ALTER TABLE "lightfast_ingestion_events"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

-- Docs Documents table
ALTER TABLE "lightfast_docs_documents"
  ALTER COLUMN "last_modified" TYPE timestamptz USING "last_modified" AT TIME ZONE 'UTC',
  ALTER COLUMN "indexed_at" TYPE timestamptz USING "indexed_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- Vector Entries table
ALTER TABLE "lightfast_vector_entries"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

-- Stores table
ALTER TABLE "lightfast_stores"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- Connected Sources table
ALTER TABLE "lightfast_connected_sources"
  ALTER COLUMN "connected_at" TYPE timestamptz USING "connected_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "last_synced_at" TYPE timestamptz USING "last_synced_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- Connected Repository table (if exists)
ALTER TABLE "lightfast_connected_repository"
  ALTER COLUMN "connected_at" TYPE timestamptz USING "connected_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "last_synced_at" TYPE timestamptz USING "last_synced_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';
