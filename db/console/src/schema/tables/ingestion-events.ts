/**
 * Ingestion events table schema
 * Idempotency and audit trail for all source integrations
 */

import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { stores } from "./stores";
import { sourceTypeEnum } from "./docs-documents";

export const ingestionEvents = pgTable(
  "lightfast_ingestion_events",
  {
    /** Unique identifier for the event record */
    id: varchar("id", { length: 191 }).primaryKey(),
    /** Store ID this event belongs to */
    storeId: varchar("store_id", { length: 191 })
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    /** Source type that triggered this event */
    sourceType: sourceTypeEnum("source_type").notNull(),
    /**
     * Unique event key for idempotency (source-specific format)
     *
     * GitHub: deliveryId
     * Linear: webhookId-action-resourceId
     * Notion: eventId-pageId
     * Sentry: requestId
     * Vercel: deploymentId
     * Zendesk: eventId-ticketId
     */
    eventKey: varchar("event_key", { length: 255 }).notNull(),
    /**
     * Source-specific event metadata
     *
     * GitHub: { beforeSha, afterSha, ref, pusher, addedFiles, modifiedFiles, removedFiles }
     * Linear: { action, resourceType, resourceId, userId }
     * Notion: { eventType, pageId, parentId }
     * Sentry: { level, issueId, groupId, eventId }
     * Vercel: { deploymentId, projectId, state, url }
     * Zendesk: { ticketId, updateType, updaterId }
     */
    eventMetadata: jsonb("event_metadata").notNull(),
    /** Ingestion source: webhook | backfill | manual | api */
    source: varchar("source", { length: 32 }).notNull().default("webhook"),
    /** Processing status: processed | skipped | failed */
    status: varchar("status", { length: 16 }).notNull().default("processed"),
    /** When the event was processed */
    processedAt: timestamp("processed_at", { withTimezone: false })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    byStore: index("idx_ingestion_events_store").on(t.storeId),
    bySourceType: index("idx_ingestion_events_source_type").on(t.sourceType),
    bySource: index("idx_ingestion_events_source").on(t.source),
    byStatus: index("idx_ingestion_events_status").on(t.status),
    uniqEvent: uniqueIndex("uq_ingestion_event").on(
      t.storeId,
      t.sourceType,
      t.eventKey
    ),
  }),
);

// Type exports
export type IngestionEvent = typeof ingestionEvents.$inferSelect;
export type InsertIngestionEvent = typeof ingestionEvents.$inferInsert;

// Zod schema exports
