import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import type { ClerkOrgId } from "@repo/console-validation";

/**
 * Organization Workspaces table represents isolated knowledge bases within an organization.
 *
 * Org-scoped: Each workspace belongs to a Clerk organization.
 *
 * Architecture:
 * - **name**: User-facing identifier used in URLs (e.g., "my-project", "api.v2")
 *   - Follows GitHub repo naming rules: alphanumeric + hyphens/periods/underscores
 *   - Unique per organization
 *   - Max 100 chars
 * - **slug**: Internal identifier, auto-generated, never shown to users
 *   - Used for Pinecone index naming: ws-{slug}-{store}
 *   - Lowercase alphanumeric + hyphens only
 *   - Max 20 chars (Pinecone constraint)
 *
 * Design:
 * - Each workspace is a separate Pinecone index/namespace
 * - Repositories can be assigned to workspaces
 * - Search/contents queries are scoped to workspace
 * - All workspaces are explicitly created by users at /new
 */
export const orgWorkspaces = pgTable(
  "lightfast_org_workspaces",
  {
    /**
     * Unique workspace identifier (nanoid)
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    /**
     * Clerk organization ID (no FK - Clerk is source of truth)
     */
    clerkOrgId: varchar("clerk_org_id", { length: 191 })
      .notNull()
      .$type<ClerkOrgId>(),

    /**
     * User-facing workspace name (used in URLs)
     * Follows GitHub repo naming: alphanumeric + hyphens/periods/underscores
     * Unique per organization, max 100 chars
     * Examples: "my-project", "api.v2", "awesome_workspace"
     */
    name: varchar("name", { length: 191 }).notNull(),

    /**
     * Internal workspace identifier (never shown to users)
     * Auto-generated, used for Pinecone index naming: ws-{slug}-{store}
     * Lowercase alphanumeric + hyphens, max 20 chars
     * Examples: "robust-chicken", "my-project", "api-v2"
     */
    slug: varchar("slug", { length: 191 }).notNull(),

    /**
     * Workspace-level settings and configuration
     * Structure (Phase 2):
     * {
     *   repositories: { [repoId]: { enabled: boolean } },
     *   defaults: { patterns: string[], ignore: string[] },
     *   features: { codeIndexing: boolean, multiLanguage: boolean }
     * }
     */
    settings: jsonb("settings").$type<WorkspaceSettings>(),

    /**
     * Timestamp when workspace was created
     */
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    /**
     * Timestamp when workspace was last updated
     */
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Index for finding all workspaces in a Clerk organization
    clerkOrgIdIdx: index("workspace_clerk_org_id_idx").on(table.clerkOrgId),

    // Unique constraint: one name per organization (names are user-facing)
    orgNameIdx: uniqueIndex("workspace_org_name_idx").on(
      table.clerkOrgId,
      table.name,
    ),

    // Index on slug for internal lookups (not unique globally)
    slugIdx: index("workspace_slug_idx").on(table.slug),
  }),
);

// TypeScript type for settings
export interface WorkspaceSettings {
  repositories?: {
    [repoId: string]: {
      enabled: boolean;
    };
  };
  defaults?: {
    patterns?: string[];
    ignore?: string[];
  };
  features?: {
    codeIndexing?: boolean;
    multiLanguage?: boolean;
  };
}

// Type exports
export type OrgWorkspace = typeof orgWorkspaces.$inferSelect;
export type InsertOrgWorkspace = typeof orgWorkspaces.$inferInsert;
