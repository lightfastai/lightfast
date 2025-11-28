import { sql } from "drizzle-orm";
import {
	boolean,
	index,
	pgTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";

/**
 * User API Keys table for user authentication tokens
 *
 * User-scoped: Each key belongs to a specific Clerk user.
 *
 * Allows users to create API keys for programmatic access to Lightfast services.
 * Keys are hashed for security and can be scoped to specific permissions.
 *
 * Design:
 * - Each user can have multiple API keys
 * - Keys are stored as hashed values (NEVER store plaintext)
 * - Display only last 4 characters of key to user
 * - Support key expiration and revocation
 * - Track last used timestamp for security auditing
 */
export const userApiKeys = pgTable(
	"lightfast_user_api_keys",
	{
		/**
		 * Unique API key identifier (nanoid)
		 */
		id: varchar("id", { length: 191 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => nanoid()),

		/**
		 * User ID from Clerk (no FK - Clerk is source of truth)
		 */
		userId: varchar("user_id", { length: 191 }).notNull(),

		/**
		 * User-provided name/description for the key
		 * e.g., "Production API", "CI/CD Pipeline", "Development"
		 */
		name: varchar("name", { length: 100 }).notNull(),

		/**
		 * Hashed API key value (NEVER store plaintext)
		 * Uses SHA-256 or similar secure hashing
		 */
		keyHash: text("key_hash").notNull(),

		/**
		 * Last 4 characters of the original key (for display purposes)
		 * Helps users identify keys without exposing the full value
		 */
		keyPreview: varchar("key_preview", { length: 8 }).notNull(),

		/**
		 * Whether this key is currently active
		 * Allows soft deletion/revocation
		 */
		isActive: boolean("is_active").notNull().default(true),

		/**
		 * Optional expiration timestamp
		 * If set, key becomes invalid after this time
		 */
		expiresAt: timestamp("expires_at", {
			mode: "string",
			withTimezone: true,
		}),

		/**
		 * Last time this key was used
		 * Updated on each authenticated request
		 */
		lastUsedAt: timestamp("last_used_at", {
			mode: "string",
			withTimezone: true,
		}),

		/**
		 * Timestamp when key was created
		 */
		createdAt: timestamp("created_at", {
			mode: "string",
			withTimezone: true,
		})
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),

		/**
		 * Timestamp when key was last updated
		 */
		updatedAt: timestamp("updated_at", {
			mode: "string",
			withTimezone: true,
		})
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(table) => ({
		// Index for finding all keys for a user
		userIdIdx: index("api_key_user_id_idx").on(table.userId),

		// Index for active keys lookup
		isActiveIdx: index("api_key_is_active_idx").on(table.isActive),

		// Index for efficient key validation (hash lookup)
		keyHashIdx: index("api_key_hash_idx").on(table.keyHash),
	}),
);

// Type exports
export type UserApiKey = typeof userApiKeys.$inferSelect;
export type InsertUserApiKey = typeof userApiKeys.$inferInsert;
