/**
 * @repo/app-validation
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
 * import { clerkOrgSlugSchema, workspaceNameSchema } from "@repo/app-validation/primitives";
 *
 * // Import domain schemas
 * import { workspaceCreateInputSchema } from "@repo/app-validation/schemas";
 *
 * // Import form schemas
 * import { workspaceFormSchema } from "@repo/app-validation/forms";
 *
 * // Import database schemas
 * import { insertWorkspaceSchema } from "@repo/app-validation/database";
 *
 * // Import constants
 * import { WORKSPACE_NAME, NAMING_ERRORS } from "@repo/app-validation/constants";
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
  EventBase,
  RerankMode,
  SearchFilters,
  SourceReference,
} from "./schemas/api/common";
export {
  EventBaseSchema,
  RerankModeSchema,
  SearchFiltersSchema,
  SourceReferenceSchema,
} from "./schemas/api/common";
// Canonical API schemas (versioning-free) — import from @repo/app-validation/api for subpath
export type {
  ContentItem,
  ContentsRequest,
  ContentsResponse,
} from "./schemas/api/contents";
export {
  ContentItemSchema,
  ContentsRequestSchema,
  ContentsResponseSchema,
} from "./schemas/api/contents";
export type {
  FindSimilarRequest,
  FindSimilarResponse,
  FindSimilarResult,
  FindSimilarSource,
} from "./schemas/api/findsimilar";
export {
  FindSimilarRequestSchema,
  FindSimilarResponseSchema,
  FindSimilarResultSchema,
  FindSimilarSourceSchema,
} from "./schemas/api/findsimilar";
export type {
  RelatedEdge,
  RelatedEvent,
  RelatedNode,
  RelatedRequest,
  RelatedResponse,
} from "./schemas/api/related";
export {
  RelatedEdgeSchema,
  RelatedEventSchema,
  RelatedNodeSchema,
  RelatedRequestSchema,
  RelatedResponseSchema,
} from "./schemas/api/related";
export type {
  SearchContext,
  SearchLatency,
  SearchRequest,
  SearchResponse,
  SearchResult,
} from "./schemas/api/search";
export {
  SearchContextSchema,
  SearchLatencySchema,
  SearchRequestSchema,
  SearchResponseSchema,
  SearchResultSchema,
} from "./schemas/api/search";

export * from "./schemas/entities";
export * from "./schemas/ingestion";
export * from "./schemas/job";
export * from "./schemas/neural";
export * from "./schemas/org-api-key";
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
