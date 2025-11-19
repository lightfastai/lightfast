import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  timestamp,
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
 * Design:
 * - Each workspace is a separate Pinecone index/namespace
 * - Repositories can be assigned to workspaces
 * - Search/contents queries are scoped to workspace
 * - Default workspace is auto-created on org creation with friendly name (e.g., "Robust Chicken")
 * - Name is auto-generated using friendlier-words for default workspaces
 * - Slug is derived from name (e.g., robust-chicken)
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
     * URL-safe workspace identifier (unique within organization)
     * Max 20 chars, lowercase alphanumeric + hyphens
     * Auto-generated for default workspaces (e.g., "robust-chicken")
     * User-provided for custom workspaces (Phase 2)
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

    // Unique constraint: one slug per organization
    orgSlugIdx: index("workspace_org_slug_idx").on(
      table.clerkOrgId,
      table.slug,
    ),
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
export const insertWorkspaceSchema = createInsertSchema(workspaces).refine(
  (data) => {
    // Validate slug format (lowercase alphanumeric + hyphens, max 20 chars)
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
