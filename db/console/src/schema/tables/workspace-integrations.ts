import type { ProviderConfig, SourceType } from "@repo/console-providers";
import type { SourceIdentifier, SyncStatus } from "@repo/console-validation";
import { nanoid } from "@repo/lib";
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { gatewayInstallations } from "./gateway-installations";
import { orgWorkspaces } from "./org-workspaces";

/**
 * Workspace Sources
 *
 * Specific resources actively syncing to a workspace.
 * This is what shows up on the "Sources" page in the UI.
 *
 * Flow:
 * 1. User creates workspace
 * 2. User picks a repo/team/project to connect
 * 3. We create a workspaceIntegration linking the installation to workspace
 * 4. Background jobs sync data from this source
 *
 * Example: "acme/frontend repo syncing to Production workspace"
 */
export const workspaceIntegrations = pgTable(
  "lightfast_workspace_integrations",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    // Which workspace this is connected to
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    // Gateway installation FK (org-scoped)
    installationId: varchar("installation_id", { length: 191 })
      .notNull()
      .references(() => gatewayInstallations.id, { onDelete: "cascade" }),

    // Denormalized provider for fast filtering (replaces providerConfig.sourceType join)
    provider: varchar("provider", { length: 50 }).notNull().$type<SourceType>(),

    /**
     * Provider-specific type and sync settings (JSONB).
     *
     * Schema: providerConfigSchema from @repo/console-providers
     * Fields: provider, type, sync (events + autoSync), status (GitHub only)
     *
     * Resource IDs live in providerResourceId (indexed column), not here.
     */
    providerConfig: jsonb("provider_config").$type<ProviderConfig>().notNull(),

    /**
     * Fast lookup field for provider-specific resource IDs.
     * This is indexed for performance on queries like "find all sources for repoId X".
     *
     * Examples:
     * - GitHub: repoId (e.g., "567890123")
     * - Vercel: projectId (e.g., "prj_123456")
     */
    providerResourceId: varchar("provider_resource_id", { length: 191 })
      .notNull()
      .$type<SourceIdentifier>(),

    // Status
    isActive: boolean("is_active").notNull().default(true),

    // Sync tracking
    lastSyncedAt: timestamp("last_synced_at", {
      mode: "string",
      withTimezone: true,
    }),
    lastSyncStatus: varchar("last_sync_status", {
      length: 50,
    }).$type<SyncStatus>(), // "success" | "failed" | "pending"
    lastSyncError: text("last_sync_error"),

    // Document count (denormalized for performance)
    documentCount: integer("document_count").notNull().default(0),

    // Timestamps
    connectedAt: timestamp("connected_at", {
      mode: "string",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    workspaceIdIdx: index("workspace_source_workspace_id_idx").on(
      table.workspaceId
    ),
    installationIdIdx: index("workspace_source_installation_id_idx").on(
      table.installationId
    ),
    isActiveIdx: index("workspace_source_is_active_idx").on(table.isActive),
    // Index for fast provider resource lookups (e.g., "find all sources for this repo")
    providerResourceIdIdx: index(
      "workspace_source_provider_resource_id_idx"
    ).on(table.providerResourceId),
  })
);

// Type exports
export type WorkspaceIntegration = typeof workspaceIntegrations.$inferSelect;
export type InsertWorkspaceIntegration =
  typeof workspaceIntegrations.$inferInsert;
