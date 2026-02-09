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

// Constants (explicit exports from leaf modules)
export {
  CLERK_ORG_SLUG,
  WORKSPACE_NAME,
  STORE_NAME,
  NAMING_ERRORS,
  validateOrgSlug,
  validateWorkspaceName,
  validateStoreName,
} from "./constants/naming";
export {
  PINECONE_DEFAULTS,
  EMBEDDING_MODEL_DEFAULTS,
  CHUNKING_DEFAULTS,
  EMBEDDING_DEFAULTS,
  type EmbeddingDefaults,
} from "./constants/embedding";

// Primitives (direct to leaf modules)
export * from "./primitives/ids";
export * from "./primitives/names";
export * from "./primitives/slugs";

// Schemas (direct to leaf modules - these are heavy runtime Zod objects)
export * from "./schemas/workspace";
export * from "./schemas/organization";
export * from "./schemas/store";
export * from "./schemas/job";
export * from "./schemas/sources";
export * from "./schemas/source-metadata";
export * from "./schemas/source-event";
export * from "./schemas/workflow-io";
export * from "./schemas/ingestion";
export * from "./schemas/metrics";
export * from "./schemas/activities";
export * from "./schemas/entities";
export * from "./schemas/org-api-key";
export * from "./schemas/classification";

// Forms (direct to leaf modules)
export * from "./forms/workspace-form";
export * from "./forms/team-form";

// Utils (direct to leaf module)
export * from "./utils/workspace-names";
