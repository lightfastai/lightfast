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
import { randomUUID } from "node:crypto";

/**
 * Workspaces table represents isolated knowledge bases within an organization.
 *
 * PHASE 1: One default workspace per organization (ws_${orgSlug})
 * PHASE 2: Multiple workspaces per organization
 *
 * Design:
 * - Each workspace is a separate Pinecone index/namespace
 * - Repositories can be assigned to workspaces
 * - Search/contents queries are scoped to workspace
 * - Default workspace is auto-created on org creation
 */
export const workspaces = pgTable(
  "lightfast_workspaces",
  {
    /**
     * Workspace identifier (e.g., ws_acme_corp, ws_acme_backend)
     * Format: ws_${slug}
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => `ws_${randomUUID().slice(0, 8)}`),

    /**
     * Organization this workspace belongs to
     */
    organizationId: varchar("organization_id", { length: 191 }).notNull(),

    /**
     * Display name for workspace
     */
    name: varchar("name", { length: 255 }).notNull(),

    /**
     * URL-friendly slug (unique within organization)
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
     * Pinecone index name for this workspace
     * Format: lightfast-{env}-{workspaceId}
     */
    pineconeIndex: varchar("pinecone_index", { length: 255 }),

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
    // Index for finding all workspaces in an organization
    orgIdIdx: index("workspace_org_id_idx").on(table.organizationId),

    // Composite index for finding default workspace
    orgDefaultIdx: index("workspace_org_default_idx").on(
      table.organizationId,
      table.isDefault,
    ),

    // Unique constraint: one slug per organization
    orgSlugIdx: index("workspace_org_slug_idx").on(
      table.organizationId,
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
export const insertWorkspaceSchema = createInsertSchema(workspaces);
export const selectWorkspaceSchema = createSelectSchema(workspaces);
