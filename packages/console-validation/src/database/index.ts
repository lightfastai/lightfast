/**
 * Database Schema Integration
 *
 * Re-exports Drizzle-generated Zod schemas from @db/console.
 * This provides a single import point for database validation while keeping
 * the actual table definitions in the database package.
 *
 * Pattern:
 * - @db/console defines tables and generates schemas with createInsertSchema/createSelectSchema
 * - @repo/console-validation re-exports those schemas for use in app/API
 * - Business logic imports from validation package, not database package
 */

export {
  // Workspace schemas
  insertWorkspaceSchema,
  selectWorkspaceSchema,

  // Store schemas
  insertStoreSchema,
  selectStoreSchema,

  // API Key schemas
  insertApiKeySchema,
  selectApiKeySchema,

  // Connected Sources schemas
  insertConnectedSourceSchema,
  selectConnectedSourceSchema,

  // Documents schemas
  insertDocsDocumentSchema,
  selectDocsDocumentSchema,

  // Jobs schemas (if they exist - add when created)
  // insertJobSchema,
  // selectJobSchema,

  // Repository schemas (if they exist)
  // insertRepositorySchema,
  // selectRepositorySchema,
} from "@db/console/schema";

// Re-export table types for convenience
export type {
  Workspace,
  InsertWorkspace,
  Store,
  InsertStore,
  ApiKey,
  InsertApiKey,
  ConnectedSource,
  InsertConnectedSource,
  DocsDocument,
  InsertDocsDocument,
} from "@db/console/schema";
