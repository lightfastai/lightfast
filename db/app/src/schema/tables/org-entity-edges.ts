import { nanoid } from "@repo/lib";
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  jsonb,
  pgTable,
  real,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { orgEntities } from "./org-entities";
import { orgEvents } from "./org-events";

/**
 * Entity↔entity directed edges.
 *
 * Replaces observation↔observation edges. Relationships exist between
 * entities (e.g., commit deploys deployment), not between events.
 * The sourceEventId provides provenance — which event caused this edge.
 */
export const orgEntityEdges = pgTable(
  "lightfast_org_entity_edges",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    externalId: varchar("external_id", { length: 21 })
      .notNull()
      .$defaultFn(() => nanoid()),

    // Clerk org ID (no FK — Clerk is source of truth)
    clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),

    sourceEntityId: bigint("source_entity_id", { mode: "number" })
      .notNull()
      .references(() => orgEntities.id, { onDelete: "cascade" }),

    targetEntityId: bigint("target_entity_id", { mode: "number" })
      .notNull()
      .references(() => orgEntities.id, { onDelete: "cascade" }),

    relationshipType: varchar("relationship_type", { length: 50 }).notNull(),

    sourceEventId: bigint("source_event_id", { mode: "number" }).references(
      () => orgEvents.id,
      { onDelete: "set null" }
    ),

    confidence: real().default(1.0).notNull(),

    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),

    metadata: jsonb().$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    externalIdIdx: uniqueIndex("org_edge_external_id_idx").on(table.externalId),
    sourceIdx: index("org_edge_source_idx").on(
      table.clerkOrgId,
      table.sourceEntityId
    ),
    targetIdx: index("org_edge_target_idx").on(
      table.clerkOrgId,
      table.targetEntityId
    ),
    uniqueEdgeIdx: uniqueIndex("org_edge_unique_idx").on(
      table.clerkOrgId,
      table.sourceEntityId,
      table.targetEntityId,
      table.relationshipType
    ),
    sourceEventIdx: index("org_edge_source_event_idx").on(table.sourceEventId),
  })
);

export type OrgEntityEdge = typeof orgEntityEdges.$inferSelect;
export type InsertOrgEntityEdge = typeof orgEntityEdges.$inferInsert;
