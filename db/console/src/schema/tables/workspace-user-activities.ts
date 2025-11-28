/**
 * User Activities Table Schema
 *
 * Tracks all user-initiated actions within workspaces for:
 * - Audit trails and compliance (GDPR, SOC2)
 * - Security monitoring and incident response
 * - Product analytics and feature adoption
 * - User activity history and debugging
 *
 * Design Principles:
 * - Denormalized for fast timeline queries
 * - Flexible metadata for activity-specific context
 * - Supports relationships between activities
 * - Privacy-aware (anonymizable for GDPR)
 */

import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import type {
  ActivityCategory,
  ActorType,
  ActivityMetadata,
} from "@repo/console-validation";

export const workspaceUserActivities = pgTable(
  "lightfast_workspace_user_activities",
  {
    /**
     * Unique activity identifier (nanoid)
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    /**
     * Workspace ID this activity belongs to
     * All activities are scoped to a workspace
     */
    workspaceId: varchar("workspace_id", { length: 191 }).notNull(),

    /**
     * Actor Type
     * - user: Human user action (via UI or API)
     * - system: Automated system action (cron, job)
     * - webhook: External webhook trigger
     * - api: API client or integration
     */
    actorType: varchar("actor_type", { length: 20 })
      .notNull()
      .$type<ActorType>(),

    /**
     * Actor User ID (Clerk user ID)
     * Null for system/webhook actions
     */
    actorUserId: varchar("actor_user_id", { length: 191 }),

    /**
     * Actor Email
     * Stored for display and GDPR export
     * Anonymized on user deletion
     */
    actorEmail: varchar("actor_email", { length: 255 }),

    /**
     * Actor IP Address
     * For security auditing
     * IPv4 or IPv6 format
     */
    actorIp: varchar("actor_ip", { length: 45 }),

    /**
     * Activity Category
     * High-level grouping for filtering:
     * - auth, workspace, integration, store, job, search, document, permission, api_key, settings
     */
    category: varchar("category", { length: 50 })
      .notNull()
      .$type<ActivityCategory>(),

    /**
     * Activity Action
     * Verb describing what happened:
     * - created, updated, deleted
     * - connected, disconnected
     * - triggered, started, completed, failed
     * - viewed, accessed, exported
     * - granted, revoked, invited, removed
     */
    action: varchar("action", { length: 100 }).notNull(),

    /**
     * Target Entity Type
     * What kind of resource was affected:
     * - workspace, integration, store, job, document, api_key, user
     */
    entityType: varchar("entity_type", { length: 50 }).notNull(),

    /**
     * Target Entity ID
     * ID of the affected resource
     */
    entityId: varchar("entity_id", { length: 191 }).notNull(),

    /**
     * Target Entity Name
     * Human-readable name for display
     * Denormalized for fast timeline rendering
     */
    entityName: varchar("entity_name", { length: 500 }),

    /**
     * Activity Metadata
     * Strongly-typed JSON for activity-specific context
     * Structure is validated and varies by action type
     *
     * Examples:
     * - workspace.created: { workspaceName, workspaceSlug, clerkOrgId }
     * - integration.connected: { provider, repoFullName, repoId, isPrivate, syncConfig }
     * - job.cancelled: { jobName, previousStatus, inngestFunctionId }
     * - store.created: { storeSlug, embeddingDim, indexName }
     *
     * REQUIRED: Every activity MUST have corresponding metadata
     */
    metadata: jsonb("metadata").$type<ActivityMetadata>().notNull(),

    /**
     * Request ID
     * For correlating with logs and tracing
     */
    requestId: varchar("request_id", { length: 191 }),

    /**
     * User Agent
     * Browser/client information
     * Stored as TEXT for long user agent strings
     */
    userAgent: text("user_agent"),

    /**
     * Related Activity ID
     * Links activities together
     * e.g., "job.completed" relates to "job.triggered"
     */
    relatedActivityId: varchar("related_activity_id", { length: 191 }),

    /**
     * Timestamp when activity occurred
     * Used for timeline and time-series queries
     */
    timestamp: timestamp("timestamp", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    /**
     * Timestamp when activity record was created
     * Usually same as timestamp, but separate for edge cases
     */
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Primary query: workspace timeline (most common)
    workspaceTimestampIdx: index("activity_workspace_timestamp_idx").on(
      table.workspaceId,
      table.timestamp,
    ),

    // Filter by actor (user activity history)
    actorIdx: index("activity_actor_idx").on(table.actorUserId),

    // Filter by category
    categoryIdx: index("activity_category_idx").on(table.category),

    // Filter by entity (resource audit trail)
    entityIdx: index("activity_entity_idx").on(
      table.entityType,
      table.entityId,
    ),

    // Composite: category + timestamp (analytics queries)
    categoryTimestampIdx: index("activity_category_timestamp_idx").on(
      table.category,
      table.timestamp,
    ),

    // Relationship traversal
    relatedActivityIdx: index("activity_related_idx").on(
      table.relatedActivityId,
    ),

    // Compliance: query by timestamp for retention cleanup
    timestampIdx: index("activity_timestamp_idx").on(table.timestamp),

    // Composite: workspace + category + timestamp (filtered timelines)
    workspaceCategoryTimestampIdx: index(
      "activity_workspace_category_timestamp_idx",
    ).on(table.workspaceId, table.category, table.timestamp),
  }),
);

// TypeScript types
export type WorkspaceUserActivity = typeof workspaceUserActivities.$inferSelect;
export type InsertWorkspaceUserActivity = typeof workspaceUserActivities.$inferInsert;
