/**
 * Source and Integration Type Schemas
 *
 * Type definitions for external integrations and data sources.
 * Used across user sources, workspace sources, and document indexing.
 */

import { z } from "zod";

/**
 * Source Type
 *
 * Canonical type for all external integrations and data sources.
 * Used across:
 * - user_sources table (OAuth connections)
 * - workspace_integrations table (workspace-level sources)
 * - workspace_knowledge_documents table (document origin)
 * - Event schemas and workflows
 *
 * NOTE: Currently only "github" and "vercel" are implemented.
 * Add new sources here as they are implemented.
 */
export const sourceTypeSchema = z.enum([
  "github", // ✅ Implemented
  "vercel", // ✅ Implemented (Phase 01)
  "linear", // ✅ Transformer ready
  "sentry", // ✅ Transformer ready
]);

export type SourceType = z.infer<typeof sourceTypeSchema>;

/**
 * Configuration Status Type
 *
 * Tracks lightfast.yml configuration state for repositories.
 * Used in connected_repository table.
 */
export const configStatusSchema = z.enum([
  "configured", // lightfast.yml exists and is valid
  "awaiting_config", // No lightfast.yml or invalid - waiting for user to add config
  "ingesting", // Currently processing configuration
  "error", // Configuration error detected
  "pending", // Configuration check pending
]);

export type ConfigStatus = z.infer<typeof configStatusSchema>;

/**
 * Sync Status Type
 *
 * Tracks the status of the most recent sync operation for a workspace source.
 * Used in workspace_sources table to indicate sync health.
 *
 * - success: Last sync completed successfully
 * - failed: Last sync failed with an error
 * - pending: Sync is currently in progress or queued
 *
 * @example
 * ```typescript
 * syncStatusSchema.parse("success"); // ✅ Valid
 * syncStatusSchema.parse("failed"); // ✅ Valid
 * syncStatusSchema.parse("running"); // ❌ Not in enum
 * ```
 */
export const syncStatusSchema = z.enum(["success", "failed", "pending"]);

export type SyncStatus = z.infer<typeof syncStatusSchema>;

/**
 * Backfill Depth
 *
 * Number of days to backfill historical data.
 * Limited to 7, 30, or 90 days.
 */
export const backfillDepthSchema = z
  .number()
  .refine((d) => [7, 30, 90].includes(d), {
    message: "Depth must be 7, 30, or 90 days",
  });

/**
 * Backfill Status
 *
 * Tracks the lifecycle of a backfill run.
 */
export const backfillStatusSchema = z.enum([
  "idle",
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export type BackfillStatus = z.infer<typeof backfillStatusSchema>;

/**
 * GitHub Backfill Entity Types
 *
 * Entity types supported for GitHub backfill.
 */
export const githubBackfillEntityTypesSchema = z
  .array(z.enum(["pull_request", "issue", "release"]))
  .default(["pull_request", "issue", "release"]);

/**
 * Vercel Backfill Entity Types
 *
 * Entity types supported for Vercel backfill.
 */
export const vercelBackfillEntityTypesSchema = z
  .array(z.enum(["deployment"]))
  .default(["deployment"]);
