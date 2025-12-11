/**
 * Source and Integration Type Schemas
 *
 * Type definitions for external integrations and data sources.
 * Used across user sources, workspace sources, and document indexing.
 */

import { z } from "zod";

/**
 * Integration Provider Type
 *
 * Defines supported OAuth integration providers.
 * Used in user_sources table for personal OAuth connections.
 *
 * NOTE: Currently only "github" is fully implemented in workflows.
 * Other providers are defined for database schema compatibility and future use.
 */
export const integrationProviderSchema = z.enum([
  "github",      // ✅ Implemented
  "vercel",      // ✅ Implemented (Phase 01)
]);

export type IntegrationProvider = z.infer<typeof integrationProviderSchema>;

/**
 * Source Type
 *
 * Defines all supported data sources for document indexing.
 * Used in docs_documents table to identify document origin.
 *
 * NOTE: Currently only "github" is fully implemented in workflows.
 * Other sources are defined for database schema compatibility and future use.
 */
export const sourceTypeSchema = z.enum([
  "github",      // ✅ Implemented
  "vercel",      // ✅ Implemented (Phase 01)
]);

export type SourceType = z.infer<typeof sourceTypeSchema>;

/**
 * Configuration Status Type
 *
 * Tracks lightfast.yml configuration state for repositories.
 * Used in connected_repository table.
 */
export const configStatusSchema = z.enum([
  "configured",      // lightfast.yml exists and is valid
  "awaiting_config", // No lightfast.yml or invalid - waiting for user to add config
  "ingesting",       // Currently processing configuration
  "error",           // Configuration error detected
  "pending",         // Configuration check pending
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
export const syncStatusSchema = z.enum([
  "success",
  "failed",
  "pending",
]);

export type SyncStatus = z.infer<typeof syncStatusSchema>;
