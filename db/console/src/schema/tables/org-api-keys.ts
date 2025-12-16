import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  varchar,
  bigint,
} from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import { orgWorkspaces } from "./org-workspaces";

/**
 * Organization API Keys table for workspace-scoped API authentication
 *
 * Organization-scoped: Each key is bound to a specific workspace and can only
 * access that workspace's resources. This prevents the security gap where
 * user-scoped keys could access any workspace via X-Workspace-ID header.
 *
 * Design:
 * - Each workspace can have multiple API keys
 * - Keys are stored as hashed values (NEVER store plaintext)
 * - Display only last 4 characters of key to user
 * - Support key expiration and revocation
 * - Track last used timestamp for security auditing
 * - Track created by user for audit trail
 */
export const orgApiKeys = pgTable(
  "lightfast_workspace_api_keys", // Keep original table name for now
  {
    /**
     * Unique API key identifier
     * Using BIGINT for high-volume table (consistent with Phase 5 migration)
     */
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    /**
     * Public key ID for external reference (nanoid)
     * Used in API responses and URLs instead of exposing BIGINT
     */
    publicId: varchar("public_id", { length: 191 })
      .notNull()
      .unique()
      .$defaultFn(() => nanoid()),

    /**
     * Workspace this key belongs to (required, enforced FK)
     */
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    /**
     * Clerk Org ID for faster lookups (denormalized)
     */
    clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),

    /**
     * User who created this key (audit trail)
     */
    createdByUserId: varchar("created_by_user_id", { length: 191 }).notNull(),

    /**
     * User-provided name/description for the key
     * e.g., "Production API", "CI/CD Pipeline", "Development"
     */
    name: varchar("name", { length: 100 }).notNull(),

    /**
     * Hashed API key value (NEVER store plaintext)
     * Uses SHA-256 hashing
     */
    keyHash: text("key_hash").notNull(),

    /**
     * Key prefix for identification (e.g., "sk-lf-")
     * Helps users identify key type without exposing full key
     */
    keyPrefix: varchar("key_prefix", { length: 20 }).notNull(),

    /**
     * Last 4 characters of the original key (for display purposes)
     */
    keySuffix: varchar("key_suffix", { length: 4 }).notNull(),

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
     * IP address of last usage (for security auditing)
     */
    lastUsedFromIp: varchar("last_used_from_ip", { length: 45 }),

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
    // Index for finding all keys for a workspace
    workspaceIdIdx: index("ws_api_key_workspace_id_idx").on(table.workspaceId),

    // Index for org-level queries
    clerkOrgIdIdx: index("ws_api_key_clerk_org_id_idx").on(table.clerkOrgId),

    // Index for efficient key validation (hash lookup)
    keyHashIdx: index("ws_api_key_hash_idx").on(table.keyHash),

    // Index for active keys lookup
    isActiveIdx: index("ws_api_key_is_active_idx").on(table.isActive),

    // Composite for workspace + active keys
    workspaceActiveIdx: index("ws_api_key_workspace_active_idx").on(
      table.workspaceId,
      table.isActive
    ),
  })
);

// Type exports
export type OrgApiKey = typeof orgApiKeys.$inferSelect;
export type InsertOrgApiKey = typeof orgApiKeys.$inferInsert;

// Backward compatibility exports
/** @deprecated Use orgApiKeys instead */
export const workspaceApiKeys = orgApiKeys;
/** @deprecated Use OrgApiKey instead */
export type WorkspaceApiKey = OrgApiKey;
/** @deprecated Use InsertOrgApiKey instead */
export type InsertWorkspaceApiKey = InsertOrgApiKey;
