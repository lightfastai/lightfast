import { sql } from "drizzle-orm";
import {
  boolean,
  datetime,
  index,
  mysqlTable,
  varchar,
} from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { uuidv4 } from "@repo/lib";

/**
 * CloudApiKey table represents API keys for CLI authentication.
 *
 * API keys are used to authenticate CLI commands against the Lightfast Cloud platform.
 * Each key is associated with a Clerk user and can be revoked or expired.
 */
export const CloudApiKey = mysqlTable(
  "lightfast_cloud_api_key",
  {
    /**
     * Unique identifier for the API key record
     * Generated using uuidv4 for global uniqueness
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => uuidv4()),

    /**
     * Reference to the user who owns this API key
     * Links to the Clerk user ID for authentication
     */
    clerkUserId: varchar("clerk_user_id", { length: 191 }).notNull(),

    /**
     * Hashed version of the API key
     * The actual key is only shown once during creation
     * We store the hash for validation
     */
    keyHash: varchar("key_hash", { length: 255 }).notNull(),

    /**
     * SHA-256 hash of the API key for fast lookups
     * Used to quickly identify potential keys without exposing timing info
     * This enables O(1) key lookup instead of O(n) hash verification
     */
    keyLookup: varchar("key_lookup", { length: 64 }).notNull(),

    /**
     * Last 4 characters of the API key for identification
     * Used to help users identify which key is which
     */
    keyPreview: varchar("key_preview", { length: 20 }).notNull(),

    /**
     * Human-readable name for the API key
     * Helps users manage multiple keys
     */
    name: varchar("name", { length: 100 }).notNull(),

    /**
     * Whether this API key is currently active
     * Can be used to temporarily disable keys without deleting them
     */
    active: boolean("active").default(true).notNull(),

    /**
     * Timestamp when the API key was last used
     * Helps track key usage and identify unused keys
     */
    lastUsedAt: datetime("last_used_at", { mode: "date" }),

    /**
     * Timestamp when the API key expires
     * Null means the key never expires
     */
    expiresAt: datetime("expires_at", { mode: "date" }),

    /**
     * Timestamp when the API key was created
     */
    createdAt: datetime("created_at", { mode: "date" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    /**
     * Timestamp when the API key was last updated
     * Automatically updates on any modification
     */
    updatedAt: datetime("updated_at", { mode: "date" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (table) => ({
    // Index for looking up keys by user
    userIdIdx: index("user_id_idx").on(table.clerkUserId),
    // Index for looking up keys by hash (for validation)
    keyHashIdx: index("key_hash_idx").on(table.keyHash),
    // Fast lookup index for key validation (O(1) performance)
    keyLookupIdx: index("key_lookup_idx").on(table.keyLookup),
  }),
);

// Type exports for API Key
export type CloudApiKey = typeof CloudApiKey.$inferSelect;
export type InsertCloudApiKey = typeof CloudApiKey.$inferInsert;


// Zod Schema exports for validation
export const insertCloudApiKeySchema = createInsertSchema(CloudApiKey);
export const selectCloudApiKeySchema = createSelectSchema(CloudApiKey);
