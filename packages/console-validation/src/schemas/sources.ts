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
 */
export const integrationProviderSchema = z.enum([
  "github",
  "notion",
  "linear",
  "sentry",
]);

export type IntegrationProvider = z.infer<typeof integrationProviderSchema>;

/**
 * Source Type
 *
 * Defines all supported data sources for document indexing.
 * Used in docs_documents table to identify document origin.
 */
export const sourceTypeSchema = z.enum([
  "github",
  "linear",
  "notion",
  "sentry",
  "vercel",
  "zendesk",
]);

export type SourceType = z.infer<typeof sourceTypeSchema>;

/**
 * Configuration Status Type
 *
 * Tracks lightfast.yml configuration state for repositories.
 * Used in connected_repository table.
 */
export const configStatusSchema = z.enum([
  "configured",    // lightfast.yml exists and is valid
  "unconfigured",  // No lightfast.yml or invalid
  "ingesting",     // Currently processing configuration
  "error",         // Configuration error detected
  "pending",       // Configuration check pending
]);

export type ConfigStatus = z.infer<typeof configStatusSchema>;
