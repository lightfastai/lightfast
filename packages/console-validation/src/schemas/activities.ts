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
    repoId: z.number(),
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
    githubRepoId: z.number(),
  })
  .passthrough();

/**
 * Metadata for integration.config_updated action
 */
export const integrationConfigUpdatedMetadataSchema = z
  .object({
    provider: z.string(),
    configStatus: z.string(),
    configPath: z.string().optional(),
    githubRepoId: z.number(),
  })
  .passthrough();

/**
 * Metadata for integration.disconnected action
 */
export const integrationDisconnectedMetadataSchema = z
  .object({
    provider: z.string(),
    reason: z.string(),
    githubInstallationId: z.number(),
  })
  .passthrough();

/**
 * Metadata for integration.deleted action
 */
export const integrationDeletedMetadataSchema = z
  .object({
    provider: z.string(),
    reason: z.string(),
    githubRepoId: z.number(),
  })
  .passthrough();

/**
 * Metadata for integration.metadata_updated action
 */
export const integrationMetadataUpdatedMetadataSchema = z
  .object({
    provider: z.string(),
    updates: z.record(z.unknown()),
    githubRepoId: z.number(),
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
// Union Type for Runtime Validation
// ============================================================================

/**
 * Activity Metadata Schema
 *
 * Union of all activity metadata types for runtime validation.
 *
 * For backward compatibility with existing records, we also accept:
 * - Generic record type for activities not yet strongly typed
 * - Optional metadata (undefined)
 */
export const activityMetadataSchema = z.union([
  // Workspace activities
  workspaceCreatedMetadataSchema,
  workspaceUpdatedMetadataSchema,

  // Integration activities
  integrationConnectedMetadataSchema,
  integrationStatusUpdatedMetadataSchema,
  integrationConfigUpdatedMetadataSchema,
  integrationDisconnectedMetadataSchema,
  integrationDeletedMetadataSchema,
  integrationMetadataUpdatedMetadataSchema,

  // Store activities
  storeCreatedMetadataSchema,

  // Job activities
  jobCancelledMetadataSchema,
  jobRestartedMetadataSchema,

  // Backward compatibility
  z.record(z.unknown()),
]).optional();

export type ActivityMetadata = z.infer<typeof activityMetadataSchema>;

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

// ============================================================================
// Activity Metadata Map (for compile-time type checking by action)
// ============================================================================

/**
 * Map of action names to their metadata types.
 * Use this for type-safe metadata based on the action field.
 *
 * Example usage:
 * ```typescript
 * type MyMetadata = ActivityMetadataMap["workspace.created"];
 * // MyMetadata is WorkspaceCreatedMetadata
 *
 * function trackActivity<T extends keyof ActivityMetadataMap>(
 *   action: T,
 *   metadata: ActivityMetadataMap[T]
 * ) {
 *   // TypeScript will enforce correct metadata type based on action
 * }
 * ```
 */
export type ActivityMetadataMap = {
  "workspace.created": WorkspaceCreatedMetadata;
  "workspace.updated": WorkspaceUpdatedMetadata;
  "integration.connected": IntegrationConnectedMetadata;
  "integration.status_updated": IntegrationStatusUpdatedMetadata;
  "integration.config_updated": IntegrationConfigUpdatedMetadata;
  "integration.disconnected": IntegrationDisconnectedMetadata;
  "integration.deleted": IntegrationDeletedMetadata;
  "integration.metadata_updated": IntegrationMetadataUpdatedMetadata;
  "store.created": StoreCreatedMetadata;
  "job.cancelled": JobCancelledMetadata;
  "job.restarted": JobRestartedMetadata;
};

/**
 * Schema map for validating metadata by action at runtime.
 *
 * Example usage:
 * ```typescript
 * const action = "workspace.created";
 * const schema = activityMetadataSchemaMap[action];
 * const result = schema.safeParse(metadata);
 * ```
 */
export const activityMetadataSchemaMap = {
  "workspace.created": workspaceCreatedMetadataSchema,
  "workspace.updated": workspaceUpdatedMetadataSchema,
  "integration.connected": integrationConnectedMetadataSchema,
  "integration.status_updated": integrationStatusUpdatedMetadataSchema,
  "integration.config_updated": integrationConfigUpdatedMetadataSchema,
  "integration.disconnected": integrationDisconnectedMetadataSchema,
  "integration.deleted": integrationDeletedMetadataSchema,
  "integration.metadata_updated": integrationMetadataUpdatedMetadataSchema,
  "store.created": storeCreatedMetadataSchema,
  "job.cancelled": jobCancelledMetadataSchema,
  "job.restarted": jobRestartedMetadataSchema,
} as const;

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

  // Context
  metadata: activityMetadataSchema,

  // Request context
  requestId: z.string().optional(),
  userAgent: z.string().optional(),

  // Relationships
  relatedActivityId: z.string().optional(),
});

export type InsertActivity = z.infer<typeof insertActivitySchema>;
