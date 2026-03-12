import { nanoid } from "@repo/lib";
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { orgWorkspaces } from "./org-workspaces";

/**
 * Reference to related entities extracted from observation
 */
export interface ObservationReference {
  id: string;
  label: string | null;
  type:
    | "commit"
    | "branch"
    | "pr"
    | "issue"
    | "deployment"
    | "project"
    | "cycle"
    | "assignee"
    | "reviewer"
    | "team"
    | "label";
  url: string | null;
}

/**
 * Actor who performed the action
 */
export interface ObservationActor {
  avatarUrl: string | null;
  email: string | null;
  id: string;
  name: string;
}

/**
 * Source-specific metadata
 * NOTE: Use metadata for structured fields (repo, branch, labels, etc.)
 * NOT the content body, to avoid token waste on non-semantic labels.
 * layer field: 'observations' | 'documents' | 'clusters' | 'profiles' (for Pinecone metadata filtering)
 */
export type ObservationMetadata = Record<string, unknown>;

/**
 * Workspace events - atomic engineering events from GitHub, Vercel, etc.
 */
export const workspaceEvents = pgTable(
  "lightfast_workspace_events",
  {
    /**
     * Internal BIGINT primary key - maximum join/query performance
     */
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    /**
     * External identifier for API responses and Pinecone metadata
     */
    externalId: varchar("external_id", { length: 21 })
      .notNull()
      .unique()
      .$defaultFn(() => nanoid()),

    /**
     * Workspace this event belongs to
     */
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    // ========== TEMPORAL ==========

    /**
     * When the event occurred in the source system
     */
    occurredAt: timestamp("occurred_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),

    /**
     * When the event was captured
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
     * Reference to resolved actor profile
     */
    actorId: bigint("actor_id", { mode: "number" }),

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
    sourceReferences:
      jsonb("source_references").$type<ObservationReference[]>(),

    /**
     * Source-specific metadata
     */
    metadata: jsonb("metadata").$type<ObservationMetadata>(),

    // ========== INGESTION ==========

    /**
     * How this event was ingested: webhook, backfill, manual, or api
     */
    ingestionSource: varchar("ingestion_source", { length: 20 })
      .default("webhook")
      .notNull(),

    // ========== TIMESTAMPS ==========

    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // External ID lookup (API requests)
    externalIdIdx: uniqueIndex("event_external_id_idx").on(table.externalId),

    // Workspace + time range queries
    workspaceOccurredIdx: index("event_workspace_occurred_idx").on(
      table.workspaceId,
      table.occurredAt
    ),

    // Source filtering
    sourceIdx: index("event_source_idx").on(
      table.workspaceId,
      table.source,
      table.sourceType
    ),

    // Deduplication by source ID
    sourceIdIdx: index("event_source_id_idx").on(
      table.workspaceId,
      table.sourceId
    ),

    // Type filtering
    typeIdx: index("event_type_idx").on(
      table.workspaceId,
      table.observationType
    ),
  })
);

// Type exports
export type WorkspaceEvent = typeof workspaceEvents.$inferSelect;
export type InsertWorkspaceEvent = typeof workspaceEvents.$inferInsert;
