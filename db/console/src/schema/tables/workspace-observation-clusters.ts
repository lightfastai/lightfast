import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import { orgWorkspaces } from "./org-workspaces";

/**
 * Observation clusters - topic-grouped collections of related observations
 */
export const workspaceObservationClusters = pgTable(
  "lightfast_workspace_observation_clusters",
  {
    /**
     * Unique cluster identifier (nanoid)
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    /**
     * Workspace this cluster belongs to
     */
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    // ========== TOPIC ==========

    /**
     * Human-readable topic label
     */
    topicLabel: varchar("topic_label", { length: 255 }).notNull(),

    /**
     * Pinecone vector ID for cluster centroid embedding
     */
    topicEmbeddingId: varchar("topic_embedding_id", { length: 191 }),

    /**
     * Keywords for fast retrieval
     */
    keywords: jsonb("keywords").$type<string[]>(),

    // ========== SCOPE ==========

    /**
     * Primary entities involved (project IDs, repo names)
     */
    primaryEntities: jsonb("primary_entities").$type<string[]>(),

    /**
     * Primary actors involved (actor IDs)
     */
    primaryActors: jsonb("primary_actors").$type<string[]>(),

    // ========== STATUS ==========

    /**
     * Cluster status: open (receiving observations) or closed
     */
    status: varchar("status", { length: 50 }).notNull().default("open"),

    // ========== SUMMARY ==========

    /**
     * LLM-generated cluster summary
     */
    summary: text("summary"),

    /**
     * When summary was last generated
     */
    summaryGeneratedAt: timestamp("summary_generated_at", {
      mode: "string",
      withTimezone: true,
    }),

    // ========== METRICS ==========

    /**
     * Number of observations in cluster
     */
    observationCount: integer("observation_count").notNull().default(0),

    /**
     * Timestamp of first observation
     */
    firstObservationAt: timestamp("first_observation_at", {
      mode: "string",
      withTimezone: true,
    }),

    /**
     * Timestamp of most recent observation
     */
    lastObservationAt: timestamp("last_observation_at", {
      mode: "string",
      withTimezone: true,
    }),

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
    // Index for finding open clusters in workspace
    workspaceStatusIdx: index("cluster_workspace_status_idx").on(
      table.workspaceId,
      table.status,
    ),

    // Index for finding recently active clusters
    lastObservationIdx: index("cluster_last_observation_idx").on(
      table.workspaceId,
      table.lastObservationAt,
    ),
  }),
);

// Type exports
export type WorkspaceObservationCluster = typeof workspaceObservationClusters.$inferSelect;
export type InsertWorkspaceObservationCluster = typeof workspaceObservationClusters.$inferInsert;
