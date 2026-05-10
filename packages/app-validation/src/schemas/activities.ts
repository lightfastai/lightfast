/**
 * User Activity Validation Schemas
 *
 * Type definitions for org user activity tracking.
 * Used for audit trails, compliance (GDPR/SOC2), and product analytics.
 */

import { z } from "zod";

/**
 * Activity Category Enum
 *
 * High-level grouping of activity types for filtering and reporting.
 *
 * Categories:
 * - auth: Authentication and session events
 * - integration: Integration connections (GitHub, Linear, Notion)
 * - store: Knowledge store operations
 * - job: Background job management
 * - search: Search queries and interactions
 * - document: Document operations
 * - permission: Permission and role changes
 * - api_key: API key management
 * - settings: Configuration changes
 */
export const activityCategorySchema = z.enum([
  "auth",
  "integration",
  "store",
  "job",
  "search",
  "document",
  "permission",
  "api_key",
  "settings",
]);

export type ActivityCategory = z.infer<typeof activityCategorySchema>;

/**
 * Activity Metadata Schemas
 *
 * Strongly typed metadata schemas for different activity types.
 * Note: The action field is NOT included in metadata - it's a top-level field.
 * We use a mapped type approach to maintain type safety.
 */

// ============================================================================
// Integration Activities
// ============================================================================

/**
 * Metadata for integration.connected action
 */
const integrationConnectedMetadataSchema = z
  .object({
    provider: z.string(),
    repoFullName: z.string(),
    repoId: z.string(),
    isPrivate: z.boolean(),
    syncConfig: z.record(z.string(), z.unknown()),
  })
  .passthrough();

/**
 * Metadata for integration.status_updated action
 */
const integrationStatusUpdatedMetadataSchema = z
  .object({
    provider: z.string(),
    status: z.string(),
    reason: z.string().optional(),
    githubRepoId: z.string(),
  })
  .passthrough();

/**
 * Metadata for integration.config_updated action
 */
const integrationConfigUpdatedMetadataSchema = z
  .object({
    provider: z.string(),
    configStatus: z.string(),
    configPath: z.string().nullable().optional(),
    githubRepoId: z.string(),
  })
  .passthrough();

/**
 * Metadata for integration.disconnected action
 *
 * Disconnection can happen at repo level (githubRepoId) or
 * installation level (githubInstallationId), so both are optional.
 */
const integrationDisconnectedMetadataSchema = z
  .object({
    provider: z.string(),
    reason: z.string(),
    githubRepoId: z.string().optional(),
    githubInstallationId: z.string().optional(),
  })
  .passthrough();

/**
 * Metadata for integration.deleted action
 */
const integrationDeletedMetadataSchema = z
  .object({
    provider: z.string(),
    reason: z.string(),
    githubRepoId: z.string(),
  })
  .passthrough();

/**
 * Metadata for integration.metadata_updated action
 *
 * After stripping mutable display fields from providerConfig,
 * this action only records that a touch/timestamp update occurred.
 */
const integrationMetadataUpdatedMetadataSchema = z
  .object({
    provider: z.string(),
    githubRepoId: z.string(),
  })
  .passthrough();

// ============================================================================
// Store Activities
// ============================================================================

/**
 * Metadata for store.created action
 */
const storeCreatedMetadataSchema = z
  .object({
    storeSlug: z.string(),
    embeddingDim: z.number(),
    indexName: z.string(),
  })
  .passthrough();

// ============================================================================
// Job Activities
// ============================================================================

/**
 * Metadata for job.cancelled action
 */
const jobCancelledMetadataSchema = z
  .object({
    jobName: z.string(),
    previousStatus: z.string(),
    inngestFunctionId: z.string().optional(),
  })
  .passthrough();

/**
 * Metadata for job.restarted action
 */
const jobRestartedMetadataSchema = z
  .object({
    jobName: z.string(),
    originalStatus: z.string(),
    inngestFunctionId: z.string().optional(),
  })
  .passthrough();

// ============================================================================
// API Key Activities
// ============================================================================

/**
 * Metadata for apikey.created action
 */
const apiKeyCreatedMetadataSchema = z
  .object({
    keyId: z.string(),
    keyName: z.string(),
    keyPreview: z.string(), // e.g., "sk_live_...abc1"
    expiresAt: z.string().datetime().nullable(),
  })
  .passthrough();

/**
 * Metadata for apikey.revoked action
 */
const apiKeyRevokedMetadataSchema = z
  .object({
    keyId: z.string(),
    keyName: z.string(),
    keyPreview: z.string(),
  })
  .passthrough();

/**
 * Metadata for apikey.deleted action
 */
const apiKeyDeletedMetadataSchema = z
  .object({
    keyId: z.string(),
    keyName: z.string(),
    keyPreview: z.string(),
    originallyCreatedAt: z.string().datetime(),
  })
  .passthrough();

/**
 * Metadata for apikey.rotated action
 */
const apiKeyRotatedMetadataSchema = z
  .object({
    oldKeyId: z.string(),
    newKeyId: z.string(),
    keyName: z.string(),
    newKeyPreview: z.string(),
  })
  .passthrough();

// ============================================================================
// Search Activities (v1 API)
// ============================================================================

/**
 * Metadata for search.query action
 */
const searchQueryMetadataSchema = z
  .object({
    query: z.string(),
    limit: z.number(),
    offset: z.number(),
    mode: z.enum(["fast", "balanced", "thorough"]),
    hasFilters: z.boolean(),
    resultCount: z.number(),
    totalMatches: z.number(),
    latencyMs: z.number(),
    authType: z.enum(["api-key", "session"]),
    apiKeyId: z.string().optional(),
  })
  .passthrough();

/**
 * Metadata for search.findsimilar action
 */
const searchFindSimilarMetadataSchema = z
  .object({
    sourceId: z.string(),
    sourceType: z.string(),
    inputMethod: z.enum(["id", "url"]),
    limit: z.number(),
    threshold: z.number(),
    similarCount: z.number(),
    latencyMs: z.number(),
    authType: z.enum(["api-key", "session"]),
    apiKeyId: z.string().optional(),
  })
  .passthrough();

/**
 * Metadata for search.contents action
 */
const searchContentsMetadataSchema = z
  .object({
    requestedCount: z.number(),
    foundCount: z.number(),
    missingCount: z.number(),
    latencyMs: z.number(),
    authType: z.enum(["api-key", "session"]),
    apiKeyId: z.string().optional(),
  })
  .passthrough();

// ============================================================================
// Discriminated Union for Runtime Validation
// ============================================================================

/**
 * Integration Connected Activity
 */
const integrationConnectedActivitySchema = z.object({
  category: z.literal("integration"),
  action: z.literal("integration.connected"),
  metadata: integrationConnectedMetadataSchema,
});

/**
 * Integration Status Updated Activity
 */
const integrationStatusUpdatedActivitySchema = z.object({
  category: z.literal("integration"),
  action: z.literal("integration.status_updated"),
  metadata: integrationStatusUpdatedMetadataSchema,
});

/**
 * Integration Config Updated Activity
 */
const integrationConfigUpdatedActivitySchema = z.object({
  category: z.literal("integration"),
  action: z.literal("integration.config_updated"),
  metadata: integrationConfigUpdatedMetadataSchema,
});

/**
 * Integration Disconnected Activity
 */
const integrationDisconnectedActivitySchema = z.object({
  category: z.literal("integration"),
  action: z.literal("integration.disconnected"),
  metadata: integrationDisconnectedMetadataSchema,
});

/**
 * Integration Deleted Activity
 */
const integrationDeletedActivitySchema = z.object({
  category: z.literal("integration"),
  action: z.literal("integration.deleted"),
  metadata: integrationDeletedMetadataSchema,
});

/**
 * Integration Metadata Updated Activity
 */
const integrationMetadataUpdatedActivitySchema = z.object({
  category: z.literal("integration"),
  action: z.literal("integration.metadata_updated"),
  metadata: integrationMetadataUpdatedMetadataSchema,
});

/**
 * Store Created Activity
 */
const storeCreatedActivitySchema = z.object({
  category: z.literal("store"),
  action: z.literal("store.created"),
  metadata: storeCreatedMetadataSchema,
});

/**
 * Job Cancelled Activity
 */
const jobCancelledActivitySchema = z.object({
  category: z.literal("job"),
  action: z.literal("job.cancelled"),
  metadata: jobCancelledMetadataSchema,
});

/**
 * Job Restarted Activity
 */
const jobRestartedActivitySchema = z.object({
  category: z.literal("job"),
  action: z.literal("job.restarted"),
  metadata: jobRestartedMetadataSchema,
});

/**
 * API Key Created Activity
 */
const apiKeyCreatedActivitySchema = z.object({
  category: z.literal("api_key"),
  action: z.literal("apikey.created"),
  metadata: apiKeyCreatedMetadataSchema,
});

/**
 * API Key Revoked Activity
 */
const apiKeyRevokedActivitySchema = z.object({
  category: z.literal("api_key"),
  action: z.literal("apikey.revoked"),
  metadata: apiKeyRevokedMetadataSchema,
});

/**
 * API Key Deleted Activity
 */
const apiKeyDeletedActivitySchema = z.object({
  category: z.literal("api_key"),
  action: z.literal("apikey.deleted"),
  metadata: apiKeyDeletedMetadataSchema,
});

/**
 * API Key Rotated Activity
 */
const apiKeyRotatedActivitySchema = z.object({
  category: z.literal("api_key"),
  action: z.literal("apikey.rotated"),
  metadata: apiKeyRotatedMetadataSchema,
});

/**
 * Search Query Activity
 */
const searchQueryActivitySchema = z.object({
  category: z.literal("search"),
  action: z.literal("search.query"),
  metadata: searchQueryMetadataSchema,
});

/**
 * Search FindSimilar Activity
 */
const searchFindSimilarActivitySchema = z.object({
  category: z.literal("search"),
  action: z.literal("search.findsimilar"),
  metadata: searchFindSimilarMetadataSchema,
});

/**
 * Search Contents Activity
 */
const searchContentsActivitySchema = z.object({
  category: z.literal("search"),
  action: z.literal("search.contents"),
  metadata: searchContentsMetadataSchema,
});

/**
 * Discriminated Union of All Activity Types
 *
 * This discriminated union ensures type safety and runtime validation:
 * - The discriminator is the 'action' field
 * - Each action has its corresponding metadata structure
 * - Category is enforced to match the action type
 * - Zod will validate both structure and content at runtime
 *
 * Usage:
 * ```typescript
 * const result = activityTypeSchema.safeParse({
 *   action: "integration.connected",
 *   category: "integration",
 *   metadata: { provider, repoFullName, repoId, isPrivate, syncConfig }
 * });
 * ```
 */
export const activityTypeSchema = z.discriminatedUnion("action", [
  integrationConnectedActivitySchema,
  integrationStatusUpdatedActivitySchema,
  integrationConfigUpdatedActivitySchema,
  integrationDisconnectedActivitySchema,
  integrationDeletedActivitySchema,
  integrationMetadataUpdatedActivitySchema,
  storeCreatedActivitySchema,
  jobCancelledActivitySchema,
  jobRestartedActivitySchema,
  // API Key activities
  apiKeyCreatedActivitySchema,
  apiKeyRevokedActivitySchema,
  apiKeyDeletedActivitySchema,
  apiKeyRotatedActivitySchema,
  // Search activities
  searchQueryActivitySchema,
  searchFindSimilarActivitySchema,
  searchContentsActivitySchema,
]);

export type ActivityType = z.infer<typeof activityTypeSchema>;

// For backward compatibility with database schema
export type ActivityMetadata = ActivityType["metadata"];
