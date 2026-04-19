import type { EntityRelation } from "@repo/app-providers/contracts";
import { nanoid } from "@vendor/lib";
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { orgIngestLogs } from "./org-ingest-logs";

/**
 * Org events - atomic engineering events from GitHub, Vercel, etc.
 */
export const orgEvents = pgTable(
  "lightfast_org_events",
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
      .$defaultFn(() => nanoid()),

    /**
     * Clerk org ID (no FK — Clerk is source of truth).
     */
    clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),

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
    sourceReferences: jsonb("source_references").$type<EntityRelation[]>(),

    /**
     * Source-specific attributes
     */
    metadata:
      jsonb("metadata").$type<
        Record<string, string | number | boolean | null>
      >(),

    // ========== INGESTION ==========

    /**
     * How this event was ingested: webhook, backfill, manual, or api
     */
    ingestionSource: varchar("ingestion_source", { length: 20 })
      .default("webhook")
      .notNull(),

    /**
     * FK back to the ingest log that produced this event.
     * Null for backfill-ingested events and test-data paths.
     */
    ingestLogId: bigint("ingest_log_id", { mode: "number" }).references(
      () => orgIngestLogs.id,
      { onDelete: "set null" }
    ),

    /**
     * Significance score (0-100) computed at ingestion time.
     * Used for search ranking and notification thresholds.
     * Null for events ingested before this column was added.
     */
    significanceScore: integer("significance_score"),

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
    externalIdIdx: uniqueIndex("org_event_external_id_idx").on(
      table.externalId
    ),

    // Org + time range queries
    orgOccurredIdx: index("org_event_org_occurred_idx").on(
      table.clerkOrgId,
      table.occurredAt
    ),

    // Source filtering
    sourceIdx: index("org_event_source_idx").on(
      table.clerkOrgId,
      table.source,
      table.sourceType
    ),

    // Deduplication by source ID
    sourceIdIdx: index("org_event_source_id_idx").on(
      table.clerkOrgId,
      table.sourceId
    ),

    // Type filtering
    typeIdx: index("org_event_type_idx").on(
      table.clerkOrgId,
      table.observationType
    ),
  })
);

// Type exports
export type OrgEvent = typeof orgEvents.$inferSelect;
export type InsertOrgEvent = typeof orgEvents.$inferInsert;
