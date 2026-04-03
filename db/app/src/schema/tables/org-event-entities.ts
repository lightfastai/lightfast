import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { orgEntities } from "./org-entities";
import { orgEvents } from "./org-events";

/**
 * Entity↔Event junction table.
 *
 * Records every occurrence of an entity in an event,
 * replacing the single source_event_id FK on the entity table.
 * Enables "all events for entity X" and "all entities for event Y".
 */
export const orgEventEntities = pgTable(
  "lightfast_org_event_entities",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    entityId: bigint("entity_id", { mode: "number" })
      .notNull()
      .references(() => orgEntities.id, { onDelete: "cascade" }),

    eventId: bigint("event_id", { mode: "number" })
      .notNull()
      .references(() => orgEvents.id, {
        onDelete: "cascade",
      }),

    // Clerk org ID (no FK — Clerk is source of truth)
    clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),

    /** Contextual label from reference (e.g., "resolved_by", "fixes", null) */
    refLabel: varchar("ref_label", { length: 50 }),

    /** Entity category denormalized from orgEntities for join-free edge resolution */
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
    uniqueEntityEvent: uniqueIndex("org_event_entity_idx").on(
      table.entityId,
      table.eventId
    ),

    // "All events for entity X"
    entityIdx: index("org_event_entity_entity_idx").on(table.entityId),

    // "All entities for event Y"
    eventIdx: index("org_event_entity_event_idx").on(table.eventId),
  })
);

export type OrgEventEntity = typeof orgEventEntities.$inferSelect;
export type InsertOrgEventEntity = typeof orgEventEntities.$inferInsert;
