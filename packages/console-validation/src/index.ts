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
export * from "./forms/auth-form";
export * from "./forms/early-access-form";
export * from "./forms/team-form";
// Forms (direct to leaf modules)
export * from "./forms/workspace-form";
// Primitives (direct to leaf modules)
export * from "./primitives/ids";
export * from "./primitives/names";
export * from "./primitives/slugs";
export * from "./schemas/activities";
export type {
  V1ContentItem,
  V1ContentsRequest,
  V1ContentsResponse,
} from "./schemas/api/v1/contents";
export {
  V1ContentsRequestSchema,
  V1ContentsResponseSchema,
} from "./schemas/api/v1/contents";
export type {
  V1FindSimilarRequest,
  V1FindSimilarResponse,
  V1FindSimilarResult,
  V1FindSimilarSource,
} from "./schemas/api/v1/findsimilar";
export {
  V1FindSimilarRequestSchema,
  V1FindSimilarResponseSchema,
} from "./schemas/api/v1/findsimilar";
export type {
  GraphEdge,
  GraphNode,
  GraphResponse,
  RelatedEvent,
  RelatedResponse,
  V1GraphRequest,
  V1RelatedRequest,
} from "./schemas/api/v1/graph";
export {
  GraphResponseSchema,
  RelatedResponseSchema,
  V1GraphRequestSchema,
  V1RelatedRequestSchema,
} from "./schemas/api/v1/graph";
export type {
  RerankMode,
  V1SearchContext,
  V1SearchFilters,
  V1SearchLatency,
  V1SearchMeta,
  V1SearchRequest,
  V1SearchResponse,
  V1SearchResult,
} from "./schemas/api/v1/search";
// API schemas (re-exported from api submodule for root import convenience)
export {
  V1SearchRequestSchema,
  V1SearchResponseSchema,
} from "./schemas/api/v1/search";
export * from "./schemas/classification";
export * from "./schemas/documents";
export * from "./schemas/entities";
export * from "./schemas/ingestion";
export * from "./schemas/job";
export * from "./schemas/metrics";
export * from "./schemas/neural";
export * from "./schemas/org-api-key";
export * from "./schemas/organization";
export * from "./schemas/source-metadata";
export * from "./schemas/sources";
export * from "./schemas/store";
export * from "./schemas/workflow-io";
// Schemas (direct to leaf modules - these are heavy runtime Zod objects)
export * from "./schemas/workspace";
// Workspace settings (JSON column schema — distinct from CRUD workspace schemas above)
export * from "./schemas/workspace-settings";

// Utils (direct to leaf module)
export * from "./utils/workspace-names";
