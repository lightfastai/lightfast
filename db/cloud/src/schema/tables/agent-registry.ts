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
 * CloudAgentRegistry table represents registered agents.
 * Renamed from deployment table to proper agent registry.
 */
export const CloudAgentRegistry = mysqlTable(
  "lightfast_cloud_agent_registry",
  {
    /**
     * Unique identifier for the agent
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => uuidv4()),

    /**
     * Reference to the user (nullable for compatibility)
     */
    clerkUserId: varchar("clerk_user_id", { length: 191 }),

    /**
     * Agent name
     */
    name: varchar("name", { length: 255 }).notNull(),

    /**
     * URL to the agent bundle in Vercel Blob storage
     */
    bundleUrl: varchar("bundle_url", { length: 500 }).notNull(),

    /**
     * Additional metadata (JSON field)
     */
    metadata: json("metadata"),

    /**
     * Timestamp when created
     */
    createdAt: datetime("created_at", { mode: "string" })
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),

    /**
     * Reference to the organization that owns this agent
     */
    clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),

    /**
     * User who created this agent
     */
    createdByUserId: varchar("created_by_user_id", { length: 191 }).notNull(),
  },
  (table) => ({
    // Primary indexes (matching existing table)
    orgIdIdx: index("org_id_idx").on(table.clerkOrgId),
    orgNameIdx: index("org_name_idx").on(table.clerkOrgId, table.name),
    createdAtIdx: index("created_at_idx").on(table.createdAt),
    orgCreatedAtIdx: index("org_created_at_idx").on(table.clerkOrgId, table.createdAt),
    userIdIdx: index("user_id_idx").on(table.clerkUserId),
  }),
);

// Type exports
export type CloudAgentRegistry = typeof CloudAgentRegistry.$inferSelect;
export type InsertCloudAgentRegistry = typeof CloudAgentRegistry.$inferInsert;

// Zod Schema exports
export const insertCloudAgentRegistrySchema = createInsertSchema(CloudAgentRegistry);
export const selectCloudAgentRegistrySchema = createSelectSchema(CloudAgentRegistry);

// Backward compatibility exports (to be removed in future version)
export const CloudAgent = CloudAgentRegistry;
export type CloudAgent = CloudAgentRegistry;
export type InsertCloudAgent = InsertCloudAgentRegistry;