import type { EntityCategory } from "@repo/console-validation";
import { nanoid } from "@repo/lib";
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { orgWorkspaces } from "./org-workspaces";

/**
 * Workspace entities extracted from events
 *
 * Stores structured entities discovered in event content.
 * Entities are deduplicated by (workspaceId, category, key) and
 * occurrence counts track how many times each entity is seen.
 */
export const workspaceEntities = pgTable(
  "lightfast_workspace_entities",
  {
    /**
     * Internal BIGINT primary key - maximum join/query performance
     */
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    /**
     * External identifier for API responses
     */
    externalId: varchar("external_id", { length: 21 })
      .notNull()
      .$defaultFn(() => nanoid()),

    /**
     * Workspace this entity belongs to
     */
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    // ========== ENTITY IDENTITY ==========

    /**
     * Entity category (engineer, project, endpoint, etc.)
     */
    category: varchar("category", { length: 50 })
      .notNull()
      .$type<EntityCategory>(),

    /**
     * Canonical entity key (e.g., "@sarah", "POST /api/users", "#123")
     */
    key: varchar("key", { length: 500 }).notNull(),

    /**
     * Human-readable value/description
     */
    value: text("value"),

    /**
     * Alternative names for this entity (e.g., ["sarah@acme.com", "Sarah J"])
     */
    aliases: jsonb("aliases").$type<string[]>(),

    // ========== PROVENANCE ==========

    /**
     * Text snippet providing evidence for extraction
     */
    evidenceSnippet: text("evidence_snippet"),

    /**
     * Extraction confidence score (0.0 - 1.0)
     */
    confidence: real("confidence").default(0.8),

    // ========== METRICS ==========

    /**
     * When this entity was first extracted
     */
    extractedAt: timestamp("extracted_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    /**
     * When this entity was last seen in an event
     */
    lastSeenAt: timestamp("last_seen_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    /**
     * Number of times this entity has been extracted
     */
    occurrenceCount: integer("occurrence_count").default(1).notNull(),

    // ========== TIMESTAMPS ==========

    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // External ID lookup (API requests)
    externalIdIdx: uniqueIndex("entity_external_id_idx").on(table.externalId),

    // Unique constraint for deduplication
    uniqueEntityKey: uniqueIndex("entity_workspace_category_key_idx").on(
      table.workspaceId,
      table.category,
      table.key
    ),

    // Lookup by workspace and category
    workspaceCategoryIdx: index("entity_workspace_category_idx").on(
      table.workspaceId,
      table.category
    ),

    // Key search
    workspaceKeyIdx: index("entity_workspace_key_idx").on(
      table.workspaceId,
      table.key
    ),

    // Last seen for cleanup/ranking
    workspaceLastSeenIdx: index("entity_workspace_last_seen_idx").on(
      table.workspaceId,
      table.lastSeenAt
    ),
  })
);

// Type exports
export type WorkspaceEntity = typeof workspaceEntities.$inferSelect;
export type InsertWorkspaceEntity = typeof workspaceEntities.$inferInsert;
