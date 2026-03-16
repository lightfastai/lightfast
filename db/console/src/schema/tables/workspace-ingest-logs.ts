import type { PostTransformEvent } from "@repo/console-providers";
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { orgWorkspaces } from "./org-workspaces";

/**
 * Workspace Ingest Log stores transformed PostTransformEvent objects
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
export const workspaceIngestLogs = pgTable(
  "lightfast_workspace_ingest_logs",
  {
    /**
     * Monotonic cursor — used as SSE Last-Event-ID for catch-up on reconnect.
     */
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    /**
     * Workspace this event belongs to (cascade delete when workspace deleted).
     */
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    /**
     * Delivery ID from relay — traces back to gatewayWebhookDeliveries for debugging.
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
     * When the original webhook was received by the relay service.
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
     * SSE catch-up: WHERE workspace_id = ? AND id > ? ORDER BY id LIMIT 1000
     * Composite index enables efficient B-tree range scan.
     */
    workspaceEventCursorIdx: index("workspace_event_cursor_idx").on(
      table.workspaceId,
      table.id
    ),

    /**
     * Trace back to relay's delivery tracking for debugging.
     */
    eventDeliveryIdx: index("event_delivery_idx").on(table.deliveryId),

    /**
     * Filter events by provider (replaces dropped source/sourceType columns).
     * Expression index on JSONB provider field.
     */
    eventProviderIdx: index("workspace_ingest_log_provider_idx").on(
      sql`(${table.sourceEvent}->>'provider')`
    ),

    /**
     * Date-range filtering: WHERE workspace_id = ? AND received_at >= ?
     */
    workspaceEventDateIdx: index("workspace_event_date_idx").on(
      table.workspaceId,
      table.receivedAt
    ),
  })
);

// Type exports
export type WorkspaceIngestLog = typeof workspaceIngestLogs.$inferSelect;
export type InsertWorkspaceIngestLog = typeof workspaceIngestLogs.$inferInsert;
