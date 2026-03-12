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
import { workspaceEvents } from "./workspace-events";

/**
 * Versioned AI interpretations of events.
 *
 * Separates mutable AI outputs (topics, significance, embeddings) from
 * immutable event facts. Supports reprocessing by creating new versions.
 */
export const workspaceInterpretations = pgTable(
  "lightfast_workspace_interpretations",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    eventId: bigint("event_id", { mode: "number" })
      .notNull()
      .references(() => workspaceEvents.id, {
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
    // Latest interpretation for an event
    eventVersionIdx: uniqueIndex("interp_event_version_idx").on(
      table.eventId,
      table.version
    ),

    // Lookup by event
    eventIdx: index("interp_event_idx").on(table.eventId),

    // Reprocessing queries
    workspaceProcessedIdx: index("interp_workspace_processed_idx").on(
      table.workspaceId,
      table.processedAt
    ),

    // Vector ID lookups (replaces event row indexes)
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

export type WorkspaceInterpretation =
  typeof workspaceInterpretations.$inferSelect;
export type InsertWorkspaceInterpretation =
  typeof workspaceInterpretations.$inferInsert;
