import { pgTable, varchar, timestamp, text, boolean, index, jsonb, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { nanoid } from "@repo/lib";
import { workspaces } from "./workspaces";
import { userSources } from "./user-sources";

/**
 * Workspace Sources
 *
 * Specific resources actively syncing to a workspace.
 * This is what shows up on the "Sources" page in the UI.
 *
 * Flow:
 * 1. User creates workspace
 * 2. User picks a repo/team/project to connect
 * 3. We create a workspaceSource linking the userSource to workspace
 * 4. Background jobs sync data from this source
 *
 * Example: "acme/frontend repo syncing to Production workspace"
 */
export const workspaceSources = pgTable(
  "lightfast_workspace_sources",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    // Which workspace this is connected to
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    // Which user connection to use for syncing
    userSourceId: varchar("user_source_id", { length: 191 })
      .notNull()
      .references(() => userSources.id, { onDelete: "cascade" }),

    // Who connected this source to the workspace
    connectedBy: varchar("connected_by", { length: 191 }).notNull(),

    /**
     * Unified source configuration containing all provider-specific data and sync settings.
     * This replaces the previous separate resourceData + syncConfig fields.
     *
     * Examples:
     *
     * GitHub Repository:
     * {
     *   provider: "github",
     *   type: "repository",
     *   installationId: "12345678",
     *   repoId: "567890123",
     *   repoName: "frontend",
     *   repoFullName: "acme/frontend",
     *   defaultBranch: "main",
     *   isPrivate: true,
     *   isArchived: false,
     *   sync: {
     *     branches: ["main", "develop"],
     *     paths: ["**\/*"],
     *     events: ["push", "pull_request"],
     *     autoSync: true
     *   }
     * }
     *
     * Linear Team:
     * {
     *   provider: "linear",
     *   type: "team",
     *   teamId: "abc-def-ghi",
     *   teamKey: "ENG",
     *   teamName: "Engineering",
     *   sync: {
     *     events: ["issue.created", "issue.updated"],
     *     autoSync: true
     *   }
     * }
     *
     * Notion Database:
     * {
     *   provider: "notion",
     *   type: "database",
     *   databaseId: "xyz-123-456",
     *   databaseName: "Product Specs",
     *   sync: {
     *     autoSync: true
     *   }
     * }
     */
    sourceConfig: jsonb("source_config").$type<
      | {
          provider: "github";
          type: "repository";
          installationId: string;        // GitHub App installation ID
          repoId: string;                // GitHub repo ID
          repoName: string;              // "frontend"
          repoFullName: string;          // "acme/frontend"
          defaultBranch: string;         // "main"
          isPrivate: boolean;
          isArchived: boolean;
          sync: {
            branches?: string[];         // ["main", "develop"]
            paths?: string[];            // ["**/*"]
            events?: string[];           // ["push", "pull_request"]
            autoSync: boolean;           // Auto-sync on changes
          };
          status?: {                     // NEW: Optional status tracking
            configStatus?: "configured" | "unconfigured";
            configPath?: string;
            lastConfigCheck?: string;
          };
        }
      | {
          provider: "notion";
          type: "page" | "database";
          pageId?: string;               // For pages
          databaseId?: string;           // For databases
          pageName?: string;             // For pages
          databaseName?: string;         // For databases
          sync: {
            events?: string[];
            autoSync: boolean;
          };
        }
      | {
          provider: "linear";
          type: "team";
          teamId: string;
          teamKey: string;               // "ENG"
          teamName: string;              // "Engineering"
          sync: {
            events?: string[];
            autoSync: boolean;
          };
        }
      | {
          provider: "sentry";
          type: "project";
          orgSlug: string;
          projectSlug: string;
          projectId: string;
          sync: {
            events?: string[];
            autoSync: boolean;
          };
        }
    >().notNull(),

    /**
     * Fast lookup field for provider-specific resource IDs.
     * This is indexed for performance on queries like "find all sources for repoId X".
     *
     * Examples:
     * - GitHub: repoId (e.g., "567890123")
     * - Linear: teamId (e.g., "abc-def-ghi")
     * - Notion: databaseId or pageId (e.g., "xyz-123-456")
     * - Sentry: projectId (e.g., "proj-789")
     */
    providerResourceId: varchar("provider_resource_id", { length: 191 }).notNull(),

    // Status
    isActive: boolean("is_active").notNull().default(true),

    // Sync tracking
    lastSyncedAt: timestamp("last_synced_at", { mode: "string", withTimezone: true }),
    lastSyncStatus: varchar("last_sync_status", { length: 50 }), // "success" | "failed" | "pending"
    lastSyncError: text("last_sync_error"),

    // Document count (denormalized for performance)
    documentCount: integer("document_count").notNull().default(0),

    // Timestamps
    connectedAt: timestamp("connected_at", { mode: "string", withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    workspaceIdIdx: index("workspace_source_workspace_id_idx").on(table.workspaceId),
    userSourceIdIdx: index("workspace_source_user_source_id_idx").on(table.userSourceId),
    connectedByIdx: index("workspace_source_connected_by_idx").on(table.connectedBy),
    isActiveIdx: index("workspace_source_is_active_idx").on(table.isActive),
    // Index for fast provider resource lookups (e.g., "find all sources for this repo")
    providerResourceIdIdx: index("workspace_source_provider_resource_id_idx").on(table.providerResourceId),
  })
);

// Type exports
export type WorkspaceSource = typeof workspaceSources.$inferSelect;
export type NewWorkspaceSource = typeof workspaceSources.$inferInsert;
