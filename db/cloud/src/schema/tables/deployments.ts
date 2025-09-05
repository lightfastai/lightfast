import { sql } from "drizzle-orm";
import {
  datetime,
  index,
  json,
  mysqlTable,
  varchar,
} from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { uuidv4 } from "@repo/lib";

/**
 * CloudDeployment table represents agent deployments to the cloud platform.
 *
 * Minimal schema for MVP - just tracks who deployed what and when.
 */
export const CloudDeployment = mysqlTable(
  "lightfast_cloud_deployment",
  {
    /**
     * Unique identifier for the deployment
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => uuidv4()),

    /**
     * Reference to the organization that owns this deployment
     * Links to the Clerk organization ID for multi-tenant isolation
     */
    clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),

    /**
     * Reference to the user who created this deployment
     * Links to the Clerk user ID for audit trail
     */
    createdByUserId: varchar("created_by_user_id", { length: 191 }).notNull(),

    /**
     * Reference to the user who deployed this (DEPRECATED)
     * Links to the Clerk user ID
     * Will be removed after migration to organization-based model
     */
    clerkUserId: varchar("clerk_user_id", { length: 191 }),

    /**
     * Name of the deployment
     */
    name: varchar("name", { length: 255 }).notNull(),

    /**
     * URL to the deployed bundle in Vercel Blob storage
     */
    bundleUrl: varchar("bundle_url", { length: 500 }).notNull(),

    /**
     * Simple metadata about the deployment
     */
    metadata: json("metadata").$type<{
      agents?: string[];
    }>(),

    /**
     * Timestamp when the deployment was created
     */
    createdAt: datetime("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Index for looking up deployments by organization (primary)
    orgIdIdx: index("org_id_idx").on(table.clerkOrgId),
    // Composite index for organization + creation time queries
    orgCreatedAtIdx: index("org_created_at_idx").on(table.clerkOrgId, table.createdAt),
    // Index for organization + name queries
    orgNameIdx: index("org_name_idx").on(table.clerkOrgId, table.name),
    // DEPRECATED: Index for looking up deployments by user (migration compatibility)
    userIdIdx: index("user_id_idx").on(table.clerkUserId),
    // DEPRECATED: Index for time-based queries (migration compatibility)
    createdAtIdx: index("created_at_idx").on(table.createdAt),
  }),
);

// Type exports
export type CloudDeployment = typeof CloudDeployment.$inferSelect;
export type InsertCloudDeployment = typeof CloudDeployment.$inferInsert;

// Zod Schema exports
export const insertCloudDeploymentSchema = createInsertSchema(CloudDeployment);
export const selectCloudDeploymentSchema = createSelectSchema(CloudDeployment);
