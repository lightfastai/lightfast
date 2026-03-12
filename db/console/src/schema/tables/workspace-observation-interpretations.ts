import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { orgWorkspaces } from "./org-workspaces";
import { workspaceNeuralObservations } from "./workspace-neural-observations";

/**
 * Versioned AI interpretations of observations.
 *
 * Separates mutable AI outputs (topics, significance, embeddings) from
 * immutable observation facts. Supports reprocessing by creating new versions.
 */
export const workspaceObservationInterpretations = pgTable(
  "lightfast_workspace_observation_interpretations",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    observationId: bigint("observation_id", { mode: "number" })
      .notNull()
      .references(() => workspaceNeuralObservations.id, {
        onDelete: "cascade",
      }),

    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    version: integer("version").default(1).notNull(),

    // Classification
    primaryCategory: varchar("primary_category", { length: 50 }),
    topics: jsonb("topics").$type<string[]>(),

    // Scoring
    significanceScore: real("significance_score"),

    // Embedding references
    embeddingTitleId: varchar("embedding_title_id", { length: 191 }),
    embeddingContentId: varchar("embedding_content_id", { length: 191 }),
    embeddingSummaryId: varchar("embedding_summary_id", { length: 191 }),

    // Provenance
    modelVersion: varchar("model_version", { length: 100 }),
    processedAt: timestamp("processed_at", {
      mode: "string",
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Latest interpretation for an observation
    obsVersionIdx: uniqueIndex("interp_obs_version_idx").on(
      table.observationId,
      table.version
    ),

    // Lookup by observation
    obsIdx: index("interp_obs_idx").on(table.observationId),

    // Reprocessing queries
    workspaceProcessedIdx: index("interp_workspace_processed_idx").on(
      table.workspaceId,
      table.processedAt
    ),

    // Vector ID lookups (replaces observation row indexes)
    embeddingTitleIdx: index("interp_embedding_title_idx").on(
      table.workspaceId,
      table.embeddingTitleId
    ),
    embeddingContentIdx: index("interp_embedding_content_idx").on(
      table.workspaceId,
      table.embeddingContentId
    ),
    embeddingSummaryIdx: index("interp_embedding_summary_idx").on(
      table.workspaceId,
      table.embeddingSummaryId
    ),
  })
);

export type WorkspaceObservationInterpretation =
  typeof workspaceObservationInterpretations.$inferSelect;
export type InsertWorkspaceObservationInterpretation =
  typeof workspaceObservationInterpretations.$inferInsert;
