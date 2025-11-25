-- Custom SQL migration file, put your code below! --

-- Migration: Convert PostgreSQL enums to varchar for app-layer validation
-- Date: 2025-11-25
-- Description: Migrate from pgEnum() to varchar().$type<>() for maximum flexibility
--
-- This migration converts 8 enum types across 7 tables:
-- 1. integration_provider_enum → varchar in lightfast_user_sources
-- 2. embedding_provider_enum → varchar in lightfast_stores
-- 3. pinecone_metric_enum → varchar in lightfast_stores
-- 4. pinecone_cloud_enum → varchar in lightfast_stores
-- 5. source_type_enum → varchar in lightfast_docs_documents
-- 6. source_type_enum → varchar in lightfast_connected_sources
-- 7. source_type_enum → varchar in lightfast_ingestion_events
-- 8. config_status_enum → varchar in lightfast_connected_repository

-- Step 1: Convert integration_provider in lightfast_user_sources
ALTER TABLE "lightfast_user_sources"
  ALTER COLUMN "provider" TYPE varchar(50);

-- Step 2: Convert embedding_provider in lightfast_stores
ALTER TABLE "lightfast_stores"
  ALTER COLUMN "embedding_provider" TYPE varchar(50);

-- Step 3: Convert pinecone_metric in lightfast_stores
ALTER TABLE "lightfast_stores"
  ALTER COLUMN "pinecone_metric" TYPE varchar(50);

-- Step 4: Convert pinecone_cloud in lightfast_stores
ALTER TABLE "lightfast_stores"
  ALTER COLUMN "pinecone_cloud" TYPE varchar(50);

-- Step 5: Convert source_type in lightfast_docs_documents
ALTER TABLE "lightfast_docs_documents"
  ALTER COLUMN "source_type" TYPE varchar(50);

-- Step 6: Convert source_type in lightfast_connected_sources
ALTER TABLE "lightfast_connected_sources"
  ALTER COLUMN "source_type" TYPE varchar(50);

-- Step 7: Convert source_type in lightfast_ingestion_events
ALTER TABLE "lightfast_ingestion_events"
  ALTER COLUMN "source_type" TYPE varchar(50);

-- Step 8: Convert config_status in lightfast_connected_repository
ALTER TABLE "lightfast_connected_repository"
  ALTER COLUMN "config_status" TYPE varchar(50);

-- Step 9: Drop the enum types (CASCADE to handle dependencies)
DROP TYPE IF EXISTS "integration_provider_enum" CASCADE;
DROP TYPE IF EXISTS "embedding_provider_enum" CASCADE;
DROP TYPE IF EXISTS "pinecone_metric_enum" CASCADE;
DROP TYPE IF EXISTS "pinecone_cloud_enum" CASCADE;
DROP TYPE IF EXISTS "source_type_enum" CASCADE;
DROP TYPE IF EXISTS "config_status_enum" CASCADE;
