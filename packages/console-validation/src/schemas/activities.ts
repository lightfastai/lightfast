/**
 * User Activity Validation Schemas
 *
 * Type definitions for workspace user activities tracking.
 * Used for audit trails, compliance (GDPR/SOC2), and product analytics.
 */

import { z } from "zod";

/**
 * Actor Type Enum
 *
 * Defines who or what triggered the activity.
 *
 * - user: Human user action (via UI or API)
 * - system: Automated system action (cron, job completion)
 * - webhook: External webhook trigger (GitHub, Linear, etc.)
 * - api: API client or integration (using API key)
 */
export const actorTypeSchema = z.enum(["user", "system", "webhook", "api"]);

export type ActorType = z.infer<typeof actorTypeSchema>;

/**
 * Activity Category Enum
 *
 * High-level grouping of activity types for filtering and reporting.
 *
 * Categories:
 * - auth: Authentication and session events
 * - workspace: Workspace management (create, update, delete)
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
  "workspace",
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
 * Common Activity Actions
 *
 * Standard verbs used across different activity types.
 * Not exhaustive - custom actions can be used for specific use cases.
 */
export const activityActionSchema = z.string().min(1).max(100);

export type ActivityAction = z.infer<typeof activityActionSchema>;

// Common action values for reference (not enforced at schema level)
export const ACTIVITY_ACTIONS = {
  // CRUD operations
  CREATED: "created",
  UPDATED: "updated",
  DELETED: "deleted",

  // Connection/auth
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  AUTHENTICATED: "authenticated",
  LOGGED_OUT: "logged_out",

  // Execution
  TRIGGERED: "triggered",
  STARTED: "started",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",

  // Access
  VIEWED: "viewed",
  ACCESSED: "accessed",
  EXPORTED: "exported",

  // Configuration
  CONFIGURED: "configured",
  ENABLED: "enabled",
  DISABLED: "disabled",

  // Permissions
  GRANTED: "granted",
  REVOKED: "revoked",
  INVITED: "invited",
  REMOVED: "removed",
} as const;

/**
 * Activity Metadata Schemas
 *
 * Strongly typed metadata schemas for different activity types.
 * Note: The action field is NOT included in metadata - it's a top-level field.
 * We use a mapped type approach to maintain type safety.
 */

// ============================================================================
// Workspace Activities
// ============================================================================

/**
 * Metadata for workspace.created action
 */
export const workspaceCreatedMetadataSchema = z
  .object({
    workspaceName: z.string(),
    workspaceSlug: z.string(),
    clerkOrgId: z.string(),
  })
  .passthrough();

/**
 * Metadata for workspace.updated action
 */
export const workspaceUpdatedMetadataSchema = z
  .object({
    changes: z
      .object({
        name: z
          .object({
            from: z.string(),
            to: z.string(),
          })
          .optional(),
        // Additional change types can be added here in the future
      })
      .passthrough(),
  })
  .passthrough();

// ============================================================================
// Integration Activities
// ============================================================================

/**
 * Metadata for integration.connected action
 */
export const integrationConnectedMetadataSchema = z
  .object({
    provider: z.string(),
    repoFullName: z.string(),
    repoId: z.string(),
    isPrivate: z.boolean(),
    syncConfig: z.record(z.unknown()),
  })
  .passthrough();

/**
 * Metadata for integration.status_updated action
 */
export const integrationStatusUpdatedMetadataSchema = z
  .object({
    provider: z.string(),
    isActive: z.boolean(),
    reason: z.string().optional(),
    githubRepoId: z.string(),
  })
  .passthrough();

/**
 * Metadata for integration.config_updated action
 */
export const integrationConfigUpdatedMetadataSchema = z
  .object({
    provider: z.string(),
    configStatus: z.string(),
    configPath: z.string().nullable().optional(),
    githubRepoId: z.string(),
  })
  .passthrough();

/**
 * Metadata for integration.disconnected action
 */
export const integrationDisconnectedMetadataSchema = z
  .object({
    provider: z.string(),
    reason: z.string(),
    githubInstallationId: z.string(),
  })
  .passthrough();

/**
 * Metadata for integration.deleted action
 */
export const integrationDeletedMetadataSchema = z
  .object({
    provider: z.string(),
    reason: z.string(),
    githubRepoId: z.string(),
  })
  .passthrough();

/**
 * Metadata for integration.metadata_updated action
 */
export const integrationMetadataUpdatedMetadataSchema = z
  .object({
    provider: z.string(),
    updates: z.record(z.unknown()),
    githubRepoId: z.string(),
  })
  .passthrough();

// ============================================================================
// Store Activities
// ============================================================================

/**
 * Metadata for store.created action
 */
export const storeCreatedMetadataSchema = z
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
export const jobCancelledMetadataSchema = z
  .object({
    jobName: z.string(),
    previousStatus: z.string(),
    inngestFunctionId: z.string().optional(),
  })
  .passthrough();

/**
 * Metadata for job.restarted action
 */
export const jobRestartedMetadataSchema = z
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
export const apiKeyCreatedMetadataSchema = z
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
export const apiKeyRevokedMetadataSchema = z
  .object({
    keyId: z.string(),
    keyName: z.string(),
    keyPreview: z.string(),
  })
  .passthrough();

/**
 * Metadata for apikey.deleted action
 */
export const apiKeyDeletedMetadataSchema = z
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
export const apiKeyRotatedMetadataSchema = z
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
export const searchQueryMetadataSchema = z
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
export const searchFindSimilarMetadataSchema = z
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
export const searchContentsMetadataSchema = z
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
 * Workspace Created Activity
 */
export const workspaceCreatedActivitySchema = z.object({
  category: z.literal("workspace"),
  action: z.literal("workspace.created"),
  metadata: workspaceCreatedMetadataSchema,
});

/**
 * Workspace Updated Activity
 */
export const workspaceUpdatedActivitySchema = z.object({
  category: z.literal("workspace"),
  action: z.literal("workspace.updated"),
  metadata: workspaceUpdatedMetadataSchema,
});

/**
 * Integration Connected Activity
 */
export const integrationConnectedActivitySchema = z.object({
  category: z.literal("integration"),
  action: z.literal("integration.connected"),
  metadata: integrationConnectedMetadataSchema,
});

/**
 * Integration Status Updated Activity
 */
export const integrationStatusUpdatedActivitySchema = z.object({
  category: z.literal("integration"),
  action: z.literal("integration.status_updated"),
  metadata: integrationStatusUpdatedMetadataSchema,
});

/**
 * Integration Config Updated Activity
 */
export const integrationConfigUpdatedActivitySchema = z.object({
  category: z.literal("integration"),
  action: z.literal("integration.config_updated"),
  metadata: integrationConfigUpdatedMetadataSchema,
});

/**
 * Integration Disconnected Activity
 */
export const integrationDisconnectedActivitySchema = z.object({
  category: z.literal("integration"),
  action: z.literal("integration.disconnected"),
  metadata: integrationDisconnectedMetadataSchema,
});

/**
 * Integration Deleted Activity
 */
export const integrationDeletedActivitySchema = z.object({
  category: z.literal("integration"),
  action: z.literal("integration.deleted"),
  metadata: integrationDeletedMetadataSchema,
});

/**
 * Integration Metadata Updated Activity
 */
export const integrationMetadataUpdatedActivitySchema = z.object({
  category: z.literal("integration"),
  action: z.literal("integration.metadata_updated"),
  metadata: integrationMetadataUpdatedMetadataSchema,
});

/**
 * Store Created Activity
 */
export const storeCreatedActivitySchema = z.object({
  category: z.literal("store"),
  action: z.literal("store.created"),
  metadata: storeCreatedMetadataSchema,
});

/**
 * Job Cancelled Activity
 */
export const jobCancelledActivitySchema = z.object({
  category: z.literal("job"),
  action: z.literal("job.cancelled"),
  metadata: jobCancelledMetadataSchema,
});

/**
 * Job Restarted Activity
 */
export const jobRestartedActivitySchema = z.object({
  category: z.literal("job"),
  action: z.literal("job.restarted"),
  metadata: jobRestartedMetadataSchema,
});

/**
 * API Key Created Activity
 */
export const apiKeyCreatedActivitySchema = z.object({
  category: z.literal("api_key"),
  action: z.literal("apikey.created"),
  metadata: apiKeyCreatedMetadataSchema,
});

/**
 * API Key Revoked Activity
 */
export const apiKeyRevokedActivitySchema = z.object({
  category: z.literal("api_key"),
  action: z.literal("apikey.revoked"),
  metadata: apiKeyRevokedMetadataSchema,
});

/**
 * API Key Deleted Activity
 */
export const apiKeyDeletedActivitySchema = z.object({
  category: z.literal("api_key"),
  action: z.literal("apikey.deleted"),
  metadata: apiKeyDeletedMetadataSchema,
});

/**
 * API Key Rotated Activity
 */
export const apiKeyRotatedActivitySchema = z.object({
  category: z.literal("api_key"),
  action: z.literal("apikey.rotated"),
  metadata: apiKeyRotatedMetadataSchema,
});

/**
 * Search Query Activity
 */
export const searchQueryActivitySchema = z.object({
  category: z.literal("search"),
  action: z.literal("search.query"),
  metadata: searchQueryMetadataSchema,
});

/**
 * Search FindSimilar Activity
 */
export const searchFindSimilarActivitySchema = z.object({
  category: z.literal("search"),
  action: z.literal("search.findsimilar"),
  metadata: searchFindSimilarMetadataSchema,
});

/**
 * Search Contents Activity
 */
export const searchContentsActivitySchema = z.object({
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
 *   action: "workspace.created",
 *   category: "workspace",
 *   metadata: { workspaceName, workspaceSlug, clerkOrgId }
 * });
 * ```
 */
export const activityTypeSchema = z.discriminatedUnion("action", [
  workspaceCreatedActivitySchema,
  workspaceUpdatedActivitySchema,
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

// ============================================================================
// Individual Metadata Types (for type-safe usage in code)
// ============================================================================

export type WorkspaceCreatedMetadata = z.infer<typeof workspaceCreatedMetadataSchema>;
export type WorkspaceUpdatedMetadata = z.infer<typeof workspaceUpdatedMetadataSchema>;
export type IntegrationConnectedMetadata = z.infer<typeof integrationConnectedMetadataSchema>;
export type IntegrationStatusUpdatedMetadata = z.infer<typeof integrationStatusUpdatedMetadataSchema>;
export type IntegrationConfigUpdatedMetadata = z.infer<typeof integrationConfigUpdatedMetadataSchema>;
export type IntegrationDisconnectedMetadata = z.infer<typeof integrationDisconnectedMetadataSchema>;
export type IntegrationDeletedMetadata = z.infer<typeof integrationDeletedMetadataSchema>;
export type IntegrationMetadataUpdatedMetadata = z.infer<typeof integrationMetadataUpdatedMetadataSchema>;
export type StoreCreatedMetadata = z.infer<typeof storeCreatedMetadataSchema>;
export type JobCancelledMetadata = z.infer<typeof jobCancelledMetadataSchema>;
export type JobRestartedMetadata = z.infer<typeof jobRestartedMetadataSchema>;
export type ApiKeyCreatedMetadata = z.infer<typeof apiKeyCreatedMetadataSchema>;
export type ApiKeyRevokedMetadata = z.infer<typeof apiKeyRevokedMetadataSchema>;
export type ApiKeyDeletedMetadata = z.infer<typeof apiKeyDeletedMetadataSchema>;
export type ApiKeyRotatedMetadata = z.infer<typeof apiKeyRotatedMetadataSchema>;
export type SearchQueryMetadata = z.infer<typeof searchQueryMetadataSchema>;
export type SearchFindSimilarMetadata = z.infer<typeof searchFindSimilarMetadataSchema>;
export type SearchContentsMetadata = z.infer<typeof searchContentsMetadataSchema>;


/**
 * Insert Activity Schema
 *
 * Validation for creating new activity records.
 */
export const insertActivitySchema = z.object({
  workspaceId: z.string(),

  // Actor information
  actorType: actorTypeSchema,
  actorUserId: z.string().optional(),
  actorEmail: z.string().email().optional(),
  actorIp: z.string().ip({ version: "v4" }).or(z.string().ip({ version: "v6" })).optional(),

  // Activity classification
  category: activityCategorySchema,
  action: activityActionSchema,

  // Target entity
  entityType: z.string().min(1).max(50),
  entityId: z.string().min(1).max(191),
  entityName: z.string().max(500).optional(),

  // Context - metadata is strongly typed based on activity type
  metadata: z.custom<ActivityMetadata>(),

  // Request context
  requestId: z.string().optional(),
  userAgent: z.string().optional(),

  // Relationships
  relatedActivityId: z.string().optional(),
});

export type InsertActivity = z.infer<typeof insertActivitySchema>;
