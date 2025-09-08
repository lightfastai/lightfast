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
 * CloudAgent table represents registered agents.
 * 
 * Minimal schema - just tracks agent name, version, and bundle URL.
 */
export const CloudAgent = mysqlTable(
  "lightfast_cloud_agent",
  {
    /**
     * Unique identifier for the agent
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => uuidv4()),

    /**
     * Reference to the organization that owns this agent
     */
    clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),

    /**
     * Agent name - unique within organization
     */
    name: varchar("name", { length: 100 }).notNull(),

    /**
     * URL to the agent bundle in Vercel Blob storage
     */
    bundleUrl: varchar("bundle_url", { length: 500 }).notNull(),

    /**
     * User who created this agent
     */
    authorUserId: varchar("author_user_id", { length: 191 }).notNull(),

    /**
     * Timestamp when created
     */
    createdAt: datetime("created_at", { mode: "date" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Primary indexes
    orgIdIdx: index("org_id_idx").on(table.clerkOrgId),
    orgNameIdx: index("org_name_idx").on(table.clerkOrgId, table.name),
  }),
);

// Type exports
export type CloudAgent = typeof CloudAgent.$inferSelect;
export type InsertCloudAgent = typeof CloudAgent.$inferInsert;

// Zod Schema exports
export const insertCloudAgentSchema = createInsertSchema(CloudAgent);
export const selectCloudAgentSchema = createSelectSchema(CloudAgent);