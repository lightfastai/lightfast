import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import { orgWorkspaces } from "./org-workspaces";

/**
 * Reference to related entities extracted from observation
 */
export interface ObservationReference {
  type: 'commit' | 'branch' | 'pr' | 'issue' | 'deployment' | 'project' |
        'cycle' | 'assignee' | 'reviewer' | 'team' | 'label';
  id: string;
  url?: string;
  label?: string;
}

/**
 * Actor who performed the action
 */
export interface ObservationActor {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

/**
 * Source-specific metadata
 * NOTE: Use metadata for structured fields (repo, branch, labels, etc.)
 * NOT the content body, to avoid token waste on non-semantic labels.
 * layer field: 'observations' | 'documents' | 'clusters' | 'profiles' (for Pinecone metadata filtering)
 */
export type ObservationMetadata = Record<string, unknown>;

/**
 * Neural observations - atomic engineering events from GitHub, Vercel, etc.
 */
export const workspaceNeuralObservations = pgTable(
  "lightfast_workspace_neural_observations",
  {
    /**
     * Unique observation identifier (nanoid)
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    /**
     * Workspace this observation belongs to
     */
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    /**
     * Cluster this observation is assigned to (nullable until clustering runs)
     */
    clusterId: varchar("cluster_id", { length: 191 }),

    // ========== TEMPORAL ==========

    /**
     * When the event occurred in the source system
     */
    occurredAt: timestamp("occurred_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),

    /**
     * When the observation was captured
     */
    capturedAt: timestamp("captured_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    // ========== ACTOR ==========

    /**
     * Actor who performed the action
     */
    actor: jsonb("actor").$type<ObservationActor | null>(),

    /**
     * Resolved actor ID (source:id format or Clerk user ID)
     */
    actorId: varchar("actor_id", { length: 191 }),

    // ========== CONTENT ==========

    /**
     * Observation type (e.g., "pr_merged", "deployment_succeeded")
     */
    observationType: varchar("observation_type", { length: 100 }).notNull(),

    /**
     * Short title (<=120 chars, embeddable headline)
     */
    title: text("title").notNull(),

    /**
     * Full content for detailed embedding
     */
    content: text("content").notNull(),

    // ========== CLASSIFICATION ==========

    /**
     * Topics extracted from content
     */
    topics: jsonb("topics").$type<string[]>(),

    /**
     * Significance score (0-100)
     */
    significanceScore: real("significance_score"),

    // ========== SOURCE ==========

    /**
     * Source system (github, vercel, linear, sentry)
     */
    source: varchar("source", { length: 50 }).notNull(),

    /**
     * Source-specific event type (e.g., "pull_request_merged")
     */
    sourceType: varchar("source_type", { length: 100 }).notNull(),

    /**
     * Unique source identifier (e.g., "pr:lightfastai/lightfast#123")
     */
    sourceId: varchar("source_id", { length: 255 }).notNull(),

    /**
     * References to related entities
     */
    sourceReferences: jsonb("source_references").$type<ObservationReference[]>(),

    /**
     * Source-specific metadata
     */
    metadata: jsonb("metadata").$type<ObservationMetadata>(),

    // ========== EMBEDDINGS ==========

    /**
     * @deprecated Use view-specific embedding IDs instead
     * Legacy Pinecone vector ID for combined title+content embedding
     */
    embeddingVectorId: varchar("embedding_vector_id", { length: 191 }),

    /**
     * Pinecone vector ID for title-only embedding
     * Optimized for topic/headline searches
     */
    embeddingTitleId: varchar("embedding_title_id", { length: 191 }),

    /**
     * Pinecone vector ID for content-only embedding
     * Optimized for detailed content searches
     */
    embeddingContentId: varchar("embedding_content_id", { length: 191 }),

    /**
     * Pinecone vector ID for summary embedding
     * Combines title and truncated content for balanced retrieval
     */
    embeddingSummaryId: varchar("embedding_summary_id", { length: 191 }),

    // ========== TIMESTAMPS ==========

    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Index for finding observations by workspace and time
    workspaceOccurredIdx: index("obs_workspace_occurred_idx").on(
      table.workspaceId,
      table.occurredAt,
    ),

    // Index for finding observations by cluster
    clusterIdx: index("obs_cluster_idx").on(table.clusterId),

    // Index for finding observations by source
    sourceIdx: index("obs_source_idx").on(
      table.workspaceId,
      table.source,
      table.sourceType,
    ),

    // Index for deduplication by source ID
    sourceIdIdx: index("obs_source_id_idx").on(
      table.workspaceId,
      table.sourceId,
    ),

    // Index for finding observations by type
    typeIdx: index("obs_type_idx").on(
      table.workspaceId,
      table.observationType,
    ),
  }),
);

// Type exports
export type WorkspaceNeuralObservation = typeof workspaceNeuralObservations.$inferSelect;
export type InsertWorkspaceNeuralObservation = typeof workspaceNeuralObservations.$inferInsert;
