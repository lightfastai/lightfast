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
import { workspaceNeuralEntities } from "./workspace-neural-entities";
import { workspaceNeuralObservations } from "./workspace-neural-observations";

/**
 * Entity↔Observation junction table.
 *
 * Records every occurrence of an entity in an observation,
 * replacing the single source_observation_id FK on the entity table.
 * Enables "all observations for entity X" and "all entities for observation Y".
 */
export const workspaceEntityObservations = pgTable(
  "lightfast_workspace_entity_observations",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    entityId: bigint("entity_id", { mode: "number" })
      .notNull()
      .references(() => workspaceNeuralEntities.id, { onDelete: "cascade" }),

    observationId: bigint("observation_id", { mode: "number" })
      .notNull()
      .references(() => workspaceNeuralObservations.id, {
        onDelete: "cascade",
      }),

    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    /** Contextual label from reference (e.g., "resolved_by", "fixes", null) */
    refLabel: varchar("ref_label", { length: 50 }),

    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Unique constraint: one junction row per entity+observation pair
    uniqueEntityObs: uniqueIndex("eo_entity_obs_idx").on(
      table.entityId,
      table.observationId
    ),

    // "All observations for entity X"
    entityIdx: index("eo_entity_idx").on(table.entityId),

    // "All entities for observation Y"
    observationIdx: index("eo_observation_idx").on(table.observationId),
  })
);

export type WorkspaceEntityObservation =
  typeof workspaceEntityObservations.$inferSelect;
export type InsertWorkspaceEntityObservation =
  typeof workspaceEntityObservations.$inferInsert;
