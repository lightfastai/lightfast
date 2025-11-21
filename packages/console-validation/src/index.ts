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

// Constants (re-export from @db/console)
export * from "./constants";

// Primitives
export * from "./primitives";

// Domain Schemas
export * from "./schemas";

// Form Schemas
export * from "./forms";

// Database Integration
export * from "./database";
