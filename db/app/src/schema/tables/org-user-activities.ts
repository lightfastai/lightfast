/**
 * Org User Activities Table Schema
 *
 * Tracks all user-initiated actions within orgs for:
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

import type { ActivityCategory, ActivityMetadata } from "@repo/app-validation";
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const orgUserActivities = pgTable(
  "lightfast_org_user_activities",
  {
    /**
     * Internal BIGINT primary key - maximum performance for audit logs
     */
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    /**
     * Clerk org ID (no FK — Clerk is source of truth).
     * All activities are scoped to an org.
     */
    clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),

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
    // Primary query: org timeline (most common)
    orgTimestampIdx: index("org_activity_timestamp_idx").on(
      table.clerkOrgId,
      table.timestamp
    ),

    // Filter by category
    categoryIdx: index("org_activity_category_idx").on(table.category),

    // Filter by entity (resource audit trail)
    entityIdx: index("org_activity_entity_idx").on(
      table.entityType,
      table.entityId
    ),

    // Composite: category + timestamp (analytics queries)
    categoryTimestampIdx: index("org_activity_category_timestamp_idx").on(
      table.category,
      table.timestamp
    ),

    // Relationship traversal
    relatedActivityIdx: index("org_activity_related_idx").on(
      table.relatedActivityId
    ),

    // Compliance: query by timestamp for retention cleanup
    timestampIdx: index("org_activity_ts_idx").on(table.timestamp),

    // Composite: org + category + timestamp (filtered timelines)
    orgCategoryTimestampIdx: index(
      "org_activity_org_category_timestamp_idx"
    ).on(table.clerkOrgId, table.category, table.timestamp),
  })
);

// TypeScript types
export type OrgUserActivity = typeof orgUserActivities.$inferSelect;
export type InsertOrgUserActivity = typeof orgUserActivities.$inferInsert;
