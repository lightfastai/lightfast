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
 * import { clerkOrgSlugSchema } from "@repo/app-validation/primitives";
 *
 * // Import domain schemas
 * import { jobListInputSchema } from "@repo/app-validation/schemas";
 *
 * // Import constants
 * import { NAMING_ERRORS } from "@repo/app-validation/constants";
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
} from "./constants/naming";
export * from "./forms/auth-form";
export * from "./forms/early-access-form";
export * from "./forms/team-form";
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
