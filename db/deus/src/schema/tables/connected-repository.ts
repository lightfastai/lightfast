import { sql } from "drizzle-orm";
import {
  boolean,
  datetime,
  index,
  json,
  mysqlTable,
  text,
  varchar,
} from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { uuidv4 } from "@repo/lib";

/**
 * GitHub repository permissions type
 */
export type RepositoryPermissions = {
  admin: boolean;
  push: boolean;
  pull: boolean;
};

/**
 * Repository metadata type for flexible storage
 * IMPORTANT: This is a CACHE - can be stale. Always fetch fresh from GitHub API when accuracy matters.
 */
export type RepositoryMetadata = {
  fullName?: string; // Cache of "owner/repo" for display only
  description?: string;
  language?: string;
  stars?: number;
  visibility?: "public" | "private";
  [key: string]: unknown;
};

/**
 * DeusConnectedRepository table represents GitHub repositories connected to Deus.
 *
 * DESIGN PRINCIPLE: Keep it simple - store only what's immutable or essential.
 *
 * AUTHENTICATION APPROACH (MVP): GitHub OAuth flow
 * - User authorizes via OAuth → we get an access_token
 * - Token stored encrypted, scoped to user's approved repos
 * - installationId field reserved for future GitHub App support (team/org installs)
 *
 * What we STORE:
 * - githubRepoId: GitHub's internal ID (NEVER changes, even on rename/transfer) ✅
 * - accessToken: OAuth token for API access ✅
 * - permissions: What we're allowed to do ✅
 * - metadata: Optional cache (can be stale, for UI display only) ✅
 *
 * What we DON'T store (fetch from GitHub API instead):
 * - repoOwner, repoName, repoFullName (mutable - repos can be renamed/transferred) ❌
 * - defaultBranch (mutable - can be changed in settings) ❌
 * - stars, forks, watchers (change frequently) ❌
 *
 * WHY: Single source of truth = GitHub API. No sync logic, no webhooks, no staleness. Ship faster. 🚀
 */
export const DeusConnectedRepository = mysqlTable(
  "lightfast_deus_connected_repository",
  {
    /**
     * Unique identifier for the connected repository
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => uuidv4()),

    /**
     * Reference to the user who connected this repository (Clerk user ID)
     */
    userId: varchar("user_id", { length: 191 }).notNull(),

    /**
     * GitHub's unique repository ID (immutable, never changes)
     * This is our single source of truth - everything else is fetched from GitHub API
     */
    githubRepoId: varchar("github_repo_id", { length: 191 })
      .notNull()
      .unique(),

    /**
     * GitHub App installation ID (reserved for future GitHub App support)
     * Currently using OAuth flow for MVP - this will be used when we add
     * GitHub App installation support for team/org repositories
     */
    installationId: varchar("installation_id", { length: 191 }),

    /**
     * Encrypted access token for repository access
     * Note: This should be encrypted at rest in production
     */
    accessToken: text("access_token"),

    /**
     * Repository permissions granted to Deus
     */
    permissions: json("permissions").$type<RepositoryPermissions>(),

    /**
     * Whether this connection is currently active
     */
    isActive: boolean("is_active").notNull().default(true),

    /**
     * When the repository was first connected
     */
    connectedAt: datetime("connected_at", { mode: "string" })
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),

    /**
     * Last time we successfully interacted with GitHub API for this repo
     */
    lastSyncedAt: datetime("last_synced_at", { mode: "string" }),

    /**
     * Optional metadata cache (can be stale - don't rely on this for operations)
     * Use for UI display, but always fetch fresh from GitHub when accuracy matters
     */
    metadata: json("metadata").$type<RepositoryMetadata>(),

    /**
     * Timestamp when record was created
     */
    createdAt: datetime("created_at", { mode: "string" })
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
  },
  (table) => ({
    // Index for fast user repository lookups
    userIdIdx: index("user_id_idx").on(table.userId),

    // Composite index for active repositories by user (most common query)
    userActiveIdx: index("user_active_idx").on(table.userId, table.isActive),
  }),
);

// Type exports
export type DeusConnectedRepository =
  typeof DeusConnectedRepository.$inferSelect;
export type InsertDeusConnectedRepository =
  typeof DeusConnectedRepository.$inferInsert;

// Zod Schema exports for validation
export const insertDeusConnectedRepositorySchema = createInsertSchema(
  DeusConnectedRepository,
);
export const selectDeusConnectedRepositorySchema = createSelectSchema(
  DeusConnectedRepository,
);
