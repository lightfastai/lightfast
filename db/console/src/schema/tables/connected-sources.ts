import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import { workspaces } from "./workspaces";
import { sourceTypeEnum } from "./docs-documents";

/**
 * ConnectedSources table represents external sources connected to the platform.
 * Supports GitHub, Linear, Notion, Sentry, Vercel, and Zendesk.
 *
 * DESIGN PRINCIPLE: Multi-source via discriminated union
 *
 * What we STORE:
 * - clerkOrgId: Which org this source belongs to (Clerk org ID) ✅
 * - workspaceId: Which workspace this source belongs to ✅
 * - sourceType: Discriminator (github | linear | notion | sentry | vercel | zendesk) ✅
 * - sourceMetadata: Source-specific data (JSONB) ✅
 * - displayName: Human-readable name ✅
 * - isActive: Connection status ✅
 *
 * WHY: Flexible multi-source support without table explosion. Single table for all integrations.
 */
export const connectedSources = pgTable(
  "lightfast_connected_sources",
  {
    /**
     * Unique identifier for the connected source (nanoid)
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
     * Reference to the workspace this source belongs to (optional for org-level sources)
     */
    workspaceId: varchar("workspace_id", { length: 191 }).references(
      () => workspaces.id,
      {
        onDelete: "set null",
      },
    ),

    /**
     * Source type discriminator
     */
    sourceType: sourceTypeEnum("source_type").notNull(),

    /**
     * Human-readable display name for this source
     * Examples: "acme/frontend", "Engineering Team", "Main Workspace"
     */
    displayName: varchar("display_name", { length: 255 }).notNull(),

    /**
     * Source-specific metadata (discriminated by sourceType)
     *
     * GitHub: { repoId, installationId, repoFullName, defaultBranch }
     * Linear: { teamId, teamKey, organizationId }
     * Notion: { workspaceId, workspaceName, accessToken }
     * Sentry: { organizationSlug, projectSlug }
     * Vercel: { projectId, teamId }
     * Zendesk: { subdomain, brand }
     */
    sourceMetadata: jsonb("source_metadata").notNull(),

    /**
     * Whether this connection is currently active
     */
    isActive: boolean("is_active").notNull().default(true),

    /**
     * Total number of indexed documents from this source
     */
    documentCount: integer("document_count").notNull().default(0),

    /**
     * Last successful ingestion timestamp
     */
    lastIngestedAt: timestamp("last_ingested_at", {
      mode: "string",
      withTimezone: false,
    }),

    /**
     * Last time we successfully synced with the source API
     */
    lastSyncedAt: timestamp("last_synced_at", {
      mode: "string",
      withTimezone: false,
    }),

    /**
     * When the source was first connected
     */
    connectedAt: timestamp("connected_at", {
      mode: "string",
      withTimezone: false,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    /**
     * Timestamp when record was created
     */
    createdAt: timestamp("created_at", { mode: "string", withTimezone: false })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    /**
     * Timestamp when record was last updated
     */
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: false })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Index for organization lookups
    clerkOrgIdIdx: index("connected_sources_clerk_org_id_idx").on(table.clerkOrgId),

    // Composite index for active sources by organization
    orgActiveIdx: index("connected_sources_org_active_idx").on(
      table.clerkOrgId,
      table.isActive,
    ),

    // Composite index for active sources by workspace
    workspaceActiveIdx: index("connected_sources_workspace_active_idx").on(
      table.workspaceId,
      table.isActive,
    ),

    // Index for source type lookups
    sourceTypeIdx: index("connected_sources_source_type_idx").on(
      table.sourceType,
    ),

    // Composite index for org + source type
    orgSourceTypeIdx: index("connected_sources_org_source_type_idx").on(
      table.clerkOrgId,
      table.sourceType,
    ),
  }),
);

// Type exports
export type ConnectedSource = typeof connectedSources.$inferSelect;
export type InsertConnectedSource = typeof connectedSources.$inferInsert;
