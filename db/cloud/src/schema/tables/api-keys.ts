import { relations, sql } from "drizzle-orm";
import { boolean, datetime, index, mysqlTable, varchar, int } from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { uuidv4 } from "@repo/lib";

/**
 * CloudApiKey table represents API keys for CLI authentication.
 * 
 * API keys are used to authenticate CLI commands against the Lightfast Cloud platform.
 * Each key is associated with a Clerk user and can be revoked or expired.
 */
export const CloudApiKey = mysqlTable("lightfast_cloud_api_key", {
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
  lastUsedAt: datetime("last_used_at", { mode: 'string' }),
  
  /**
   * Timestamp when the API key expires
   * Null means the key never expires
   */
  expiresAt: datetime("expires_at", { mode: 'string' }),
  
  /**
   * Timestamp when the API key was created
   */
  createdAt: datetime("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  
  /**
   * Timestamp when the API key was last updated
   * Automatically updates on any modification
   */
  updatedAt: datetime("updated_at", { mode: 'string' })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
    .$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  // Index for looking up keys by user
  userIdIdx: index("user_id_idx").on(table.clerkUserId),
  // Index for looking up keys by hash (for validation)
  keyHashIdx: index("key_hash_idx").on(table.keyHash),
}));

/**
 * CloudApiKeyUsage table tracks usage statistics for API keys.
 * 
 * This helps monitor API key usage patterns and can be used for
 * rate limiting, analytics, and abuse detection.
 */
export const CloudApiKeyUsage = mysqlTable("lightfast_cloud_api_key_usage", {
  /**
   * Unique identifier for the usage record
   */
  id: varchar("id", { length: 191 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  
  /**
   * Reference to the API key this usage belongs to
   */
  apiKeyId: varchar("api_key_id", { length: 191 }).notNull(),
  
  /**
   * The endpoint that was accessed
   */
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  
  /**
   * HTTP method used
   */
  method: varchar("method", { length: 10 }).notNull(),
  
  /**
   * HTTP status code returned
   */
  statusCode: int("status_code").notNull(),
  
  /**
   * IP address of the request
   */
  ipAddress: varchar("ip_address", { length: 45 }),
  
  /**
   * User agent string
   */
  userAgent: varchar("user_agent", { length: 500 }),
  
  /**
   * Timestamp when the request was made
   */
  createdAt: datetime("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  // Index for looking up usage by API key
  apiKeyIdIdx: index("api_key_id_idx").on(table.apiKeyId),
  // Index for time-based queries
  createdAtIdx: index("created_at_idx").on(table.createdAt),
}));

/**
 * Drizzle Relations
 */

// API Key relations - one key can have many usage records
export const cloudApiKeyRelations = relations(CloudApiKey, ({ many }) => ({
  usage: many(CloudApiKeyUsage),
}));

// Usage relations - each usage record belongs to one API key
export const cloudApiKeyUsageRelations = relations(CloudApiKeyUsage, ({ one }) => ({
  apiKey: one(CloudApiKey, {
    fields: [CloudApiKeyUsage.apiKeyId],
    references: [CloudApiKey.id],
  }),
}));

// Type exports for API Key
export type CloudApiKey = typeof CloudApiKey.$inferSelect;
export type InsertCloudApiKey = typeof CloudApiKey.$inferInsert;

// Type exports for Usage
export type CloudApiKeyUsage = typeof CloudApiKeyUsage.$inferSelect;
export type InsertCloudApiKeyUsage = typeof CloudApiKeyUsage.$inferInsert;

// Zod Schema exports for validation
export const insertCloudApiKeySchema = createInsertSchema(CloudApiKey);
export const selectCloudApiKeySchema = createSelectSchema(CloudApiKey);

export const insertCloudApiKeyUsageSchema = createInsertSchema(CloudApiKeyUsage);
export const selectCloudApiKeyUsageSchema = createSelectSchema(CloudApiKeyUsage);