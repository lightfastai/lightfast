import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { orgWorkspaces } from "./org-workspaces";
import { workspaceEntities } from "./workspace-entities";
import { workspaceEvents } from "./workspace-events";

/**
 * Entity↔Event junction table.
 *
 * Records every occurrence of an entity in an event,
 * replacing the single source_event_id FK on the entity table.
 * Enables "all events for entity X" and "all entities for event Y".
 */
export const workspaceEventEntities = pgTable(
  "lightfast_workspace_event_entities",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    entityId: bigint("entity_id", { mode: "number" })
      .notNull()
      .references(() => workspaceEntities.id, { onDelete: "cascade" }),

    eventId: bigint("event_id", { mode: "number" })
      .notNull()
      .references(() => workspaceEvents.id, {
        onDelete: "cascade",
      }),

    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    /** Contextual label from reference (e.g., "resolved_by", "fixes", null) */
    refLabel: varchar("ref_label", { length: 50 }),

    /** Entity category denormalized from workspaceEntities for join-free edge resolution */
    category: varchar("category", { length: 50 }),

    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Unique constraint: one junction row per entity+event pair
    uniqueEntityEvent: uniqueIndex("event_entity_idx").on(
      table.entityId,
      table.eventId
    ),

    // "All events for entity X"
    entityIdx: index("event_entity_entity_idx").on(table.entityId),

    // "All entities for event Y"
    eventIdx: index("event_entity_event_idx").on(table.eventId),
  })
);

export type WorkspaceEventEntity = typeof workspaceEventEntities.$inferSelect;
export type InsertWorkspaceEventEntity =
  typeof workspaceEventEntities.$inferInsert;
