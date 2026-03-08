/**
 * @repo/console-validation
 *
 * Centralized validation schemas for the Lightfast Console application.
 *
 * This package provides:
 * - Primitive Zod schemas (IDs, slugs, names, timestamps)
 * - Domain-specific schemas (workspace, organization, store, job, etc.)
 * - Form validation schemas (client-side React Hook Form)
 * - Database schema integration (Drizzle ORM)
 * - Reusable validation utilities
 *
 * @example
 * ```typescript
 * // Import primitives
 * import { clerkOrgSlugSchema, workspaceNameSchema } from "@repo/console-validation/primitives";
 *
 * // Import domain schemas
 * import { workspaceCreateInputSchema } from "@repo/console-validation/schemas";
 *
 * // Import form schemas
 * import { workspaceFormSchema } from "@repo/console-validation/forms";
 *
 * // Import database schemas
 * import { insertWorkspaceSchema } from "@repo/console-validation/database";
 *
 * // Import constants
 * import { WORKSPACE_NAME, NAMING_ERRORS } from "@repo/console-validation/constants";
 * ```
 */

export {
  CHUNKING_DEFAULTS,
  EMBEDDING_DEFAULTS,
  EMBEDDING_MODEL_DEFAULTS,
  type EmbeddingDefaults,
  PINECONE_DEFAULTS,
} from "./constants/embedding";
// Constants (explicit exports from leaf modules)
export {
  CLERK_ORG_SLUG,
  NAMING_ERRORS,
  STORE_NAME,
  validateOrgSlug,
  validateStoreName,
  validateWorkspaceName,
  WORKSPACE_NAME,
} from "./constants/naming";
export * from "./forms/team-form";
// Forms (direct to leaf modules)
export * from "./forms/workspace-form";
// Primitives (direct to leaf modules)
export * from "./primitives/ids";
export * from "./primitives/names";
export * from "./primitives/slugs";
export * from "./schemas/activities";
export * from "./schemas/classification";
export * from "./schemas/entities";
export * from "./schemas/ingestion";
export * from "./schemas/job";
export * from "./schemas/metrics";
export * from "./schemas/org-api-key";
export * from "./schemas/organization";
export * from "./schemas/source-event";
export * from "./schemas/source-metadata";
export * from "./schemas/sources";
export * from "./schemas/store";
export * from "./schemas/workflow-io";
// Schemas (direct to leaf modules - these are heavy runtime Zod objects)
export * from "./schemas/workspace";

// Utils (direct to leaf module)
export * from "./utils/workspace-names";
