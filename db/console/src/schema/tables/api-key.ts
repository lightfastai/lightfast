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
 * DeusApiKey table represents API keys for Deus CLI authentication.
 *
 * API keys are scoped to organizations and users, allowing programmatic access
 * to Deus resources. All API keys have admin permissions.
 *
 * SECURITY DESIGN:
 * - keyHash: SHA-256 hash of the actual key (never store plaintext)
 * - keyPreview: Last 4 characters for display in UI (e.g., "...ab12")
 * - scopes: Always set to ['admin'] - all keys have full permissions
 * - expiresAt: Optional expiration timestamp
 * - revokedAt: Soft delete timestamp (keys are never hard deleted)
 */
export const DeusApiKey = mysqlTable(
  "lightfast_deus_api_keys",
  {
    /**
     * Unique identifier for the API key
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => uuidv4()),

    /**
     * bcrypt hash of the API key
     * Used for validation - never store the actual key
     */
    keyHash: varchar("key_hash", { length: 255 }).notNull().unique(),

    /**
     * Last 4 characters of the key for display purposes
     * Example: "ab12" from key "lf_deus_1234...ab12"
     */
    keyPreview: varchar("key_preview", { length: 20 }).notNull(),

    /**
     * Clerk user ID who created this API key
     */
    userId: varchar("user_id", { length: 191 }).notNull(),

    /**
     * Organization this API key belongs to
     */
    organizationId: varchar("organization_id", { length: 191 }).notNull(),

    /**
     * User-provided name for the API key
     * Example: "Production CLI", "CI/CD Pipeline"
     */
    name: varchar("name", { length: 100 }).notNull(),

    /**
     * Permissions granted to this API key
     * Always set to ['admin'] - all keys have full permissions
     */
    scopes: json("scopes").$type<string[]>().notNull(),

    /**
     * Last time this key was used for authentication
     * Updated on every successful API request
     */
    lastUsedAt: datetime("last_used_at", { mode: "string" }),

    /**
     * Optional expiration timestamp
     * If null, the key never expires
     */
    expiresAt: datetime("expires_at", { mode: "string" }),

    /**
     * Timestamp when the key was revoked
     * If set, the key is no longer valid
     */
    revokedAt: datetime("revoked_at", { mode: "string" }),

    /**
     * Timestamp when the API key was created
     */
    createdAt: datetime("created_at", { mode: "string" })
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),

    /**
     * Timestamp when the API key was last updated
     */
    updatedAt: datetime("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Index for fast key hash lookups (authentication)
    keyHashIdx: index("key_hash_idx").on(table.keyHash),

    // Index for listing keys by organization
    orgIdIdx: index("org_id_idx").on(table.organizationId),

    // Index for listing keys by user
    userIdIdx: index("user_id_idx").on(table.userId),
  }),
);

// Type exports
export type DeusApiKey = typeof DeusApiKey.$inferSelect;
export type InsertDeusApiKey = typeof DeusApiKey.$inferInsert;

// Zod Schema exports for validation
export const insertDeusApiKeySchema = createInsertSchema(DeusApiKey);
export const selectDeusApiKeySchema = createSelectSchema(DeusApiKey);
