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
import { orgWorkspaces } from "./org-workspaces";
import { workspaceEntities } from "./workspace-entities";
import { workspaceEvents } from "./workspace-events";

/**
 * Entity↔entity directed edges.
 *
 * Replaces observation↔observation edges. Relationships exist between
 * entities (e.g., commit deploys deployment), not between events.
 * The sourceEventId provides provenance — which event caused this edge.
 */
export const workspaceEntityEdges = pgTable(
  "lightfast_workspace_entity_edges",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    externalId: varchar("external_id", { length: 21 })
      .notNull()
      .$defaultFn(() => nanoid()),

    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    sourceEntityId: bigint("source_entity_id", { mode: "number" })
      .notNull()
      .references(() => workspaceEntities.id, { onDelete: "cascade" }),

    targetEntityId: bigint("target_entity_id", { mode: "number" })
      .notNull()
      .references(() => workspaceEntities.id, { onDelete: "cascade" }),

    relationshipType: varchar("relationship_type", { length: 50 }).notNull(),

    sourceEventId: bigint("source_event_id", { mode: "number" }).references(
      () => workspaceEvents.id,
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
    externalIdIdx: uniqueIndex("edge_external_id_idx").on(table.externalId),
    sourceIdx: index("edge_source_idx").on(
      table.workspaceId,
      table.sourceEntityId
    ),
    targetIdx: index("edge_target_idx").on(
      table.workspaceId,
      table.targetEntityId
    ),
    uniqueEdgeIdx: uniqueIndex("edge_unique_idx").on(
      table.workspaceId,
      table.sourceEntityId,
      table.targetEntityId,
      table.relationshipType
    ),
    sourceEventIdx: index("edge_source_event_idx").on(table.sourceEventId),
  })
);

export type WorkspaceEntityEdge = typeof workspaceEntityEdges.$inferSelect;
export type InsertWorkspaceEntityEdge =
  typeof workspaceEntityEdges.$inferInsert;
