import type { PostTransformEvent } from "@repo/app-providers/contracts";
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Org Ingest Log stores transformed PostTransformEvent objects
 * produced by the ingress pipeline's per-provider transformers.
 *
 * Only successfully transformed events are stored (unsupported event types
 * are skipped). Raw payloads exist upstream in QStash and gatewayWebhookDeliveries.
 *
 * Primary consumers:
 * - SSE endpoint (/api/gateway/stream) — catch-up on reconnect via Last-Event-ID
 * - Future: dashboard real-time feed, agent VM notifications
 *
 * The BIGINT identity PK serves as a monotonic cursor for SSE Last-Event-ID.
 */
export const orgIngestLogs = pgTable(
  "lightfast_org_ingest_logs",
  {
    /**
     * Monotonic cursor — used as SSE Last-Event-ID for catch-up on reconnect.
     */
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    /**
     * Clerk org ID (no FK — Clerk is source of truth).
     */
    clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),

    /**
     * Delivery ID from the platform ingest pipeline — traces back to gatewayWebhookDeliveries for debugging.
     */
    deliveryId: varchar("delivery_id", { length: 191 }).notNull(),

    /**
     * Full transformed event — the canonical event representation.
     * Contains: deliveryId, sourceId, provider, eventType, occurredAt,
     * entity, relations, title, body, attributes.
     */
    sourceEvent: jsonb("source_event").$type<PostTransformEvent>().notNull(),

    /**
     * How this event was ingested: webhook, backfill, manual, or api.
     */
    ingestionSource: varchar("ingestion_source", { length: 20 })
      .default("webhook")
      .notNull(),

    /**
     * When the original webhook was received by the platform ingest service.
     */
    receivedAt: timestamp("received_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),

    /**
     * When this record was created.
     */
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /**
     * SSE catch-up: WHERE clerk_org_id = ? AND id > ? ORDER BY id LIMIT 1000
     * Composite index enables efficient B-tree range scan.
     */
    orgEventCursorIdx: index("org_event_cursor_idx").on(
      table.clerkOrgId,
      table.id
    ),

    /**
     * Trace back to the platform ingest delivery record for debugging.
     */
    eventDeliveryIdx: index("org_event_delivery_idx").on(table.deliveryId),

    /**
     * Filter events by provider (replaces dropped source/sourceType columns).
     * Expression index on JSONB provider field.
     */
    eventProviderIdx: index("org_ingest_log_provider_idx").on(
      sql`(${table.sourceEvent}->>'provider')`
    ),

    /**
     * Date-range filtering: WHERE clerk_org_id = ? AND received_at >= ?
     */
    orgEventDateIdx: index("org_event_date_idx").on(
      table.clerkOrgId,
      table.receivedAt
    ),
  })
);

// Type exports
export type OrgIngestLog = typeof orgIngestLogs.$inferSelect;
export type InsertOrgIngestLog = typeof orgIngestLogs.$inferInsert;
