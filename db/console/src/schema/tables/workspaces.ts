import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { nanoid } from "@repo/lib";

/**
 * Workspaces table represents isolated knowledge bases within an organization.
 *
 * PHASE 1: One default workspace per organization with auto-generated friendly name
 * PHASE 2: Multiple workspaces per organization (user can create custom workspaces)
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
 * - Default workspace is auto-created with friendly name (e.g., "Robust-Chicken")
 * - Custom workspaces use user-provided name (e.g., "my-awesome-project")
 */
export const workspaces = pgTable(
  "lightfast_workspaces",
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
      .notNull(),

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
     * Whether this is the default workspace for the organization
     * Only one default workspace per organization
     */
    isDefault: boolean("is_default").notNull().default(false),

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
    createdAt: timestamp("created_at", { mode: "string", withTimezone: false })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    /**
     * Timestamp when workspace was last updated
     */
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: false })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Index for finding all workspaces in a Clerk organization
    clerkOrgIdIdx: index("workspace_clerk_org_id_idx").on(table.clerkOrgId),

    // Composite index for finding default workspace
    orgDefaultIdx: index("workspace_org_default_idx").on(
      table.clerkOrgId,
      table.isDefault,
    ),

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
export type Workspace = typeof workspaces.$inferSelect;
export type InsertWorkspace = typeof workspaces.$inferInsert;

// Zod schemas
export const insertWorkspaceSchema = createInsertSchema(workspaces)
  .refine(
    (data) => {
      // Validate name format (GitHub repo naming rules)
      const name = data.name;
      if (!name) return true; // Allow empty during optional create

      return (
        /^[A-Za-z0-9_.-]+$/.test(name) && // Alphanumeric + hyphens/periods/underscores
        name.length >= 1 &&                // Min 1 char
        name.length <= 100                 // Max 100 chars
      );
    },
    {
      message:
        "Workspace name must contain only letters, numbers, hyphens, periods, and underscores (1-100 chars)",
      path: ["name"],
    }
  )
  .refine(
    (data) => {
      // Validate slug format (internal identifier for Pinecone)
      const slug = data.slug;
      if (!slug) return true; // Allow empty during optional create

      return (
        /^[a-z0-9-]+$/.test(slug) && // Only lowercase alphanumeric + hyphens
        !/^-|-$|--/.test(slug) &&    // No leading/trailing/consecutive hyphens
        slug.length <= 20            // Max 20 chars
      );
    },
    {
      message:
        "Workspace slug must be lowercase alphanumeric with hyphens only, no leading/trailing/consecutive hyphens, max 20 chars",
      path: ["slug"],
    }
  );
export const selectWorkspaceSchema = createSelectSchema(workspaces);
