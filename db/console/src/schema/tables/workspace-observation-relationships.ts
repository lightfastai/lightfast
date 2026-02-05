/**
 * Workspace Observation Relationships
 *
 * Stores typed edges between observations for relationship graph traversal.
 * Edges are created during observation capture based on shared linking keys
 * (commit SHAs, issue IDs, branch names).
 */

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
import { nanoid } from "@repo/lib";
import { orgWorkspaces } from "./org-workspaces";
import { workspaceNeuralObservations } from "./workspace-neural-observations";

/**
 * Relationship types between observations
 */
export type RelationshipType =
  | "fixes" // PR/commit fixes an issue
  | "resolves" // Commit resolves a Sentry issue
  | "triggers" // Sentry error triggers Linear issue
  | "deploys" // Vercel deployment deploys a commit
  | "references" // Generic reference link
  | "same_commit" // Two observations about the same commit
  | "same_branch" // Two observations about the same branch
  | "tracked_in"; // GitHub PR tracked in Linear via attachment

/**
 * Relationship metadata
 */
export interface RelationshipMetadata {
  /** How the relationship was detected */
  detectionMethod?:
    | "explicit"
    | "commit_match"
    | "branch_match"
    | "entity_cooccurrence";
  /** Additional context about the relationship */
  context?: string;
}

/**
 * Workspace observation relationships - edges in the relationship graph
 */
export const workspaceObservationRelationships = pgTable(
  "lightfast_workspace_observation_relationships",
  {
    /**
     * Internal BIGINT primary key
     */
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    /**
     * External identifier for API responses
     */
    externalId: varchar("external_id", { length: 21 })
      .notNull()
      .unique()
      .$defaultFn(() => nanoid()),

    /**
     * Workspace this relationship belongs to
     */
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    /**
     * Source observation (edge start)
     */
    sourceObservationId: bigint("source_observation_id", { mode: "number" })
      .notNull()
      .references(() => workspaceNeuralObservations.id, { onDelete: "cascade" }),

    /**
     * Target observation (edge end)
     */
    targetObservationId: bigint("target_observation_id", { mode: "number" })
      .notNull()
      .references(() => workspaceNeuralObservations.id, { onDelete: "cascade" }),

    /**
     * Type of relationship
     */
    relationshipType: varchar("relationship_type", { length: 50 })
      .notNull()
      .$type<RelationshipType>(),

    /**
     * The shared reference key that created this relationship
     * e.g., commit SHA, issue ID, branch name
     */
    linkingKey: varchar("linking_key", { length: 500 }),

    /**
     * Type of the linking key
     */
    linkingKeyType: varchar("linking_key_type", { length: 50 }),

    /**
     * Confidence score (1.0 = explicit, 0.7-0.9 = inferred)
     */
    confidence: real("confidence").default(1.0).notNull(),

    /**
     * Additional metadata
     */
    metadata: jsonb("metadata").$type<RelationshipMetadata>(),

    /**
     * When the relationship was created
     */
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // External ID lookup
    externalIdIdx: uniqueIndex("ws_obs_rel_external_id_idx").on(
      table.externalId
    ),

    // Forward traversal: source → targets
    sourceIdx: index("ws_obs_rel_source_idx").on(
      table.workspaceId,
      table.sourceObservationId
    ),

    // Reverse traversal: target → sources
    targetIdx: index("ws_obs_rel_target_idx").on(
      table.workspaceId,
      table.targetObservationId
    ),

    // Find relationships by linking key
    linkingKeyIdx: index("ws_obs_rel_linking_key_idx").on(
      table.workspaceId,
      table.linkingKey
    ),

    // Unique constraint on edges
    uniqueEdgeIdx: uniqueIndex("ws_obs_rel_unique_edge_idx").on(
      table.workspaceId,
      table.sourceObservationId,
      table.targetObservationId,
      table.relationshipType
    ),
  })
);

// Type exports
export type WorkspaceObservationRelationship =
  typeof workspaceObservationRelationships.$inferSelect;
export type InsertWorkspaceObservationRelationship =
  typeof workspaceObservationRelationships.$inferInsert;
