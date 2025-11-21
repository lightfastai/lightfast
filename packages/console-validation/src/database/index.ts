/**
 * Database Schema Generation
 *
 * Generates Zod schemas from Drizzle table definitions.
 * This is the single source of truth for all database validation.
 *
 * Pattern:
 * - @db/console defines pure Drizzle tables (no Zod)
 * - @repo/console-validation imports tables and generates Zod schemas
 * - Business logic imports schemas from validation package
 *
 * Architecture:
 * - Base schemas: Generated from tables without refinements (for composition)
 * - Refined schemas: Base + validation rules (for database operations)
 */

import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import {
  workspaces,
  stores,
  apiKeys,
  jobs,
  connectedSources,
  docsDocuments,
} from "@db/console/schema";

// ============================================================================
// WORKSPACE SCHEMAS
// ============================================================================

/**
 * Base workspace insert schema (no refinements)
 * Use this for deriving API/form schemas
 */
export const insertWorkspaceSchemaBase = createInsertSchema(workspaces);

/**
 * Workspace insert schema with validation
 * Use this for database operations
 */
export const insertWorkspaceSchema = insertWorkspaceSchemaBase
  .refine(
    (data) => {
      // Validate name format (GitHub repo naming rules)
      const name = data.name;
      if (!name) return true;
      return (
        /^[A-Za-z0-9_.-]+$/.test(name) &&
        name.length >= 1 &&
        name.length <= 100
      );
    },
    {
      message: "Workspace name must contain only letters, numbers, hyphens, periods, and underscores (1-100 chars)",
      path: ["name"],
    }
  )
  .refine(
    (data) => {
      // Validate slug format (internal identifier for Pinecone)
      const slug = data.slug;
      if (!slug) return true;
      return (
        /^[a-z0-9-]+$/.test(slug) &&
        !/^-|-$|--/.test(slug) &&
        slug.length <= 20
      );
    },
    {
      message: "Workspace slug must be lowercase alphanumeric with hyphens only, no leading/trailing/consecutive hyphens, max 20 chars",
      path: ["slug"],
    }
  );

export const selectWorkspaceSchema = createSelectSchema(workspaces);

// ============================================================================
// STORE SCHEMAS
// ============================================================================

/**
 * Base store insert schema (no refinements)
 * Use this for deriving API/form schemas
 */
export const insertStoreSchemaBase = createInsertSchema(stores);

/**
 * Store insert schema with validation
 * Use this for database operations
 */
export const insertStoreSchema = insertStoreSchemaBase.refine(
  (data) => {
    // Validate store slug format (lowercase alphanumeric + hyphens, max 20 chars)
    const slug = data.slug;
    if (!slug) return true;
    return (
      /^[a-z0-9-]+$/.test(slug) &&
      !/^-|-$|--/.test(slug) &&
      slug.length <= 20
    );
  },
  {
    message: "Store slug must be lowercase alphanumeric with hyphens only, no leading/trailing/consecutive hyphens, max 20 chars",
    path: ["slug"],
  }
);

export const selectStoreSchema = createSelectSchema(stores);

// ============================================================================
// API KEY SCHEMAS
// ============================================================================

/**
 * Base API key insert schema (no refinements)
 * Use this for deriving API/form schemas
 */
export const insertApiKeySchemaBase = createInsertSchema(apiKeys);

/**
 * API key insert schema with validation
 * Use this for database operations
 */
export const insertApiKeySchema = insertApiKeySchemaBase.refine(
  (data) => {
    // Validate name is not empty and reasonable length
    const name = data.name;
    return name && name.length >= 1 && name.length <= 100;
  },
  {
    message: "API key name must be between 1 and 100 characters",
    path: ["name"],
  }
);

export const selectApiKeySchema = createSelectSchema(apiKeys);

// ============================================================================
// JOB SCHEMAS
// ============================================================================

export const insertJobSchema = createInsertSchema(jobs);
export const selectJobSchema = createSelectSchema(jobs);

// ============================================================================
// CONNECTED SOURCE SCHEMAS
// ============================================================================

export const insertConnectedSourceSchema = createInsertSchema(connectedSources);
export const selectConnectedSourceSchema = createSelectSchema(connectedSources);

// ============================================================================
// DOCUMENT SCHEMAS
// ============================================================================

export const insertDocsDocumentSchema = createInsertSchema(docsDocuments);
export const selectDocsDocumentSchema = createSelectSchema(docsDocuments);

// ============================================================================
// TYPE RE-EXPORTS
// ============================================================================

export type {
  Workspace,
  InsertWorkspace,
  Store,
  InsertStore,
  ApiKey,
  InsertApiKey,
  Job,
  InsertJob,
  ConnectedSource,
  InsertConnectedSource,
  DocsDocument,
  InsertDocsDocument,
} from "@db/console/schema";
