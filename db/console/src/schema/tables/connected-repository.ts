import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import type { RepositoryMetadata, RepositoryPermissions } from "@repo/console-types";
import { randomUUID } from "node:crypto";

/**
 * Configuration status enum for lightfast.yml
 */
export const configStatusEnum = pgEnum("config_status", [
  "configured",
  "unconfigured",
  "ingesting",
  "error",
  "pending",
]);

/**
 * DeusConnectedRepository table represents GitHub repositories connected to Deus.
 *
 * DESIGN PRINCIPLE: Organization-scoped via GitHub App
 *
 * AUTHENTICATION APPROACH: GitHub App installation
 * - Organization installs GitHub App
 * - We use installation ID to get installation access tokens
 * - Repositories are scoped to the organization
 *
 * What we STORE:
 * - organizationId: Which Deus org this repo belongs to ✅
 * - githubRepoId: GitHub's internal ID (NEVER changes, even on rename/transfer) ✅
 * - githubInstallationId: GitHub App installation ID for API access ✅
 * - permissions: What we're allowed to do ✅
 * - metadata: Optional cache (can be stale, for UI display only) ✅
 *
 * What we DON'T store (fetch from GitHub API instead):
 * - repoOwner, repoName (mutable - repos can be renamed/transferred) ❌
 * - defaultBranch (mutable - can be changed in settings) ❌
 * - stars, forks, watchers (change frequently) ❌
 *
 * WHY: Single source of truth = GitHub API. No sync logic, no webhooks, no staleness. Ship faster. 🚀
 */
export const DeusConnectedRepository = pgTable(
  "lightfast_deus_connected_repository",
  {
    /**
     * Unique identifier for the connected repository
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => randomUUID()),

    /**
     * Reference to the organization this repository belongs to
     */
    organizationId: varchar("organization_id", { length: 191 }).notNull(),

    /**
     * GitHub's unique repository ID (immutable, never changes)
     * This is our single source of truth - everything else is fetched from GitHub API
     */
    githubRepoId: varchar("github_repo_id", { length: 191 }).notNull().unique(),

    /**
     * GitHub App installation ID for this repository
     * Used to get installation access tokens for API calls
     */
    githubInstallationId: varchar("github_installation_id", {
      length: 191,
    }).notNull(),

    /**
     * Repository permissions granted to Deus
     */
    permissions: jsonb("permissions").$type<RepositoryPermissions>(),

    /**
     * Whether this connection is currently active
     */
    isActive: boolean("is_active").notNull().default(true),

    /**
     * Whether this repository is enabled in its workspace (Phase 2)
     * Phase 1: Always true
     * Phase 2: Can be disabled at workspace level
     */
    isEnabled: boolean("is_enabled").notNull().default(true),

    /**
     * When the repository was first connected
     */
    connectedAt: timestamp("connected_at", { mode: "string", withTimezone: false })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    /**
     * Last time we successfully interacted with GitHub API for this repo
     */
    lastSyncedAt: timestamp("last_synced_at", { mode: "string", withTimezone: false }),

    /**
     * Configuration status for lightfast.yml
     */
    configStatus: configStatusEnum("config_status")
      .notNull()
      .default("pending"),

    /**
     * Path to lightfast.yml config file (e.g., 'lightfast.yml' or '.lightfast.yml')
     */
    configPath: varchar("config_path", { length: 255 }),

    /**
     * When configuration was last detected/checked
     */
    configDetectedAt: timestamp("config_detected_at", { mode: "string", withTimezone: false }),

    /**
     * Workspace ID computed from organization (ws_${githubOrgSlug})
     */
    workspaceId: varchar("workspace_id", { length: 191 }),

    /**
     * Total number of indexed documents
     */
    documentCount: integer("document_count").notNull().default(0),

    /**
     * Last successful ingestion timestamp
     */
    lastIngestedAt: timestamp("last_ingested_at", { mode: "string", withTimezone: false }),

    /**
     * Optional metadata cache (can be stale - don't rely on this for operations)
     * Use for UI display, but always fetch fresh from GitHub when accuracy matters
     */
    metadata: jsonb("metadata").$type<RepositoryMetadata>(),

    /**
     * Timestamp when record was created
     */
    createdAt: timestamp("created_at", { mode: "string", withTimezone: false })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Index for fast organization repository lookups
    orgIdIdx: index("org_id_idx").on(table.organizationId),

    // Composite index for active repositories by organization (most common query)
    orgActiveIdx: index("org_active_idx").on(
      table.organizationId,
      table.isActive,
    ),

    // Composite index for active, enabled repositories by workspace (Phase 2)
    workspaceActiveIdx: index("workspace_active_idx").on(
      table.workspaceId,
      table.isActive,
      table.isEnabled,
    ),

    // Index for GitHub installation lookups
    installationIdx: index("installation_idx").on(table.githubInstallationId),
  }),
);

// Type exports
export type DeusConnectedRepository = typeof DeusConnectedRepository.$inferSelect;
export type InsertDeusConnectedRepository =
  typeof DeusConnectedRepository.$inferInsert;

// Zod Schema exports for validation
export const insertDeusConnectedRepositorySchema = createInsertSchema(
  DeusConnectedRepository,
);
export const selectDeusConnectedRepositorySchema = createSelectSchema(
  DeusConnectedRepository,
);

export type { RepositoryMetadata, RepositoryPermissions };
