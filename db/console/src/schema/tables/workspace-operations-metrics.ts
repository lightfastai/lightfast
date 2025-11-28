import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import type {
  OperationMetricType,
  OperationMetricUnit,
  JobDurationTags,
  DocumentsIndexedTags,
  ErrorTags,
} from "@repo/console-validation";

/**
 * Operations Metrics Table - Internal System Health
 *
 * Tracks internal operations and job performance:
 * - job_duration: Background job execution time (Inngest workflows)
 * - documents_indexed: Document indexing progress (sync operations)
 * - errors: System and job failures
 *
 * Design:
 * - Time-series data for operations monitoring
 * - Aggregated by workspace/repository
 * - Lower volume than API metrics
 * - Longer retention (1+ years for trend analysis)
 *
 * NOTE: This table is for INTERNAL operations only.
 * For external API metrics (query_latency, queries_count, api_calls),
 * we will create a separate `lightfast_api_metrics` table to track
 * customer-facing API usage (/v1/search, /v1/contents, /v1/similar, /v1/answer).
 * See: docs/architecture/phase2.5/activity-tracking-architecture.md
 */
export const workspaceOperationsMetrics = pgTable(
  "lightfast_workspace_operations_metrics",
  {
    /**
     * Unique metric identifier (nanoid)
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    /**
     * Clerk organization ID (no FK - Clerk is source of truth)
     */
    clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),

    /**
     * Workspace ID this metric belongs to
     */
    workspaceId: varchar("workspace_id", { length: 191 }).notNull(),

    /**
     * Optional repository ID if metric is repository-specific
     */
    repositoryId: varchar("repository_id", { length: 191 }),

    /**
     * Metric type (operations only)
     * - job_duration: Job execution time (milliseconds)
     * - documents_indexed: Documents indexed count
     * - errors: Error count
     */
    type: varchar("type", { length: 50 })
      .notNull()
      .$type<OperationMetricType>(),

    /**
     * Metric value (numeric)
     * - For job_duration: milliseconds
     * - For documents_indexed: integer count
     * - For errors: count (usually 1 per error)
     */
    value: integer("value").notNull(),

    /**
     * Metric unit
     * - ms: milliseconds (for job_duration)
     * - count: integer count (for documents_indexed, errors)
     */
    unit: varchar("unit", { length: 20 }).$type<OperationMetricUnit>(),

    /**
     * Metric context/tags for filtering
     * Structure:
     * {
     *   jobType?: string,           // Inngest function ID (e.g., "apps-console/github-sync")
     *   trigger?: string,           // "manual" | "webhook" | "scheduled"
     *   errorType?: string,         // Error classification (e.g., "job_failure")
     *   sourceType?: string,        // "github" | "linear" | "notion"
     *   syncMode?: string,          // "full" | "incremental"
     *   filesProcessed?: number,
     * }
     */
    tags: jsonb("tags").$type<OperationMetricTags>(),

    /**
     * Timestamp when metric was recorded
     * Used for time-series queries and aggregation
     */
    timestamp: timestamp("timestamp", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    /**
     * Timestamp when metric record was created (usually same as timestamp)
     */
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Index for finding metrics by organization
    clerkOrgIdIdx: index("ops_metric_clerk_org_id_idx").on(table.clerkOrgId),

    // Index for finding metrics by workspace
    workspaceIdIdx: index("ops_metric_workspace_id_idx").on(table.workspaceId),

    // Index for finding metrics by repository
    repositoryIdIdx: index("ops_metric_repository_id_idx").on(table.repositoryId),

    // Index for finding metrics by type
    typeIdx: index("ops_metric_type_idx").on(table.type),

    // Composite index for time-series queries by workspace
    workspaceTypeTimestampIdx: index("ops_metric_workspace_type_timestamp_idx").on(
      table.workspaceId,
      table.type,
      table.timestamp,
    ),

    // Index for recent metrics (for dashboard)
    timestampIdx: index("ops_metric_timestamp_idx").on(table.timestamp),
  }),
);

// Type exports
export type WorkspaceOperationMetric = typeof workspaceOperationsMetrics.$inferSelect;
export type InsertWorkspaceOperationMetric = typeof workspaceOperationsMetrics.$inferInsert;

// Type re-exports from validation schemas
export type { JobDurationTags, DocumentsIndexedTags, ErrorTags } from "@repo/console-validation";

/**
 * Discriminated union based on metric type (type column)
 *
 * Note: Cannot discriminate at schema level since type is separate column.
 * This is a union of possible tag structures.
 *
 * - job_duration: requires jobType and trigger
 * - documents_indexed: requires jobType and sourceType
 * - errors: requires jobType and errorType
 */
export type OperationMetricTags = JobDurationTags | DocumentsIndexedTags | ErrorTags;
