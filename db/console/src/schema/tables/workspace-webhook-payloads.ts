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
 * Workspace Webhook Payloads table stores raw, unmodified webhook payloads
 * from all sources (GitHub, Vercel) for permanent retention.
 *
 * Purpose:
 * - Enable future reprocessing if transformer logic changes
 * - Debug webhook issues with complete original data
 * - Maintain complete audit trail of all received webhooks
 *
 * Only verified webhooks that resolve to a workspace are stored.
 * Failed signature verification or unresolvable webhooks are NOT stored.
 */
export const workspaceWebhookPayloads = pgTable(
  "lightfast_workspace_webhook_payloads",
  {
    /**
     * Internal BIGINT primary key - maximum performance for raw storage
     */
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    /**
     * Workspace this payload belongs to (cascade delete when workspace deleted)
     */
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    /**
     * Unique delivery identifier from source
     * GitHub: x-github-delivery header
     * Vercel: payload.id field
     */
    deliveryId: varchar("delivery_id", { length: 191 }).notNull(),

    /**
     * Source system: "github" | "vercel"
     */
    source: varchar("source", { length: 50 }).notNull(),

    /**
     * Event type from source (e.g., "push", "pull_request", "deployment.created")
     */
    eventType: varchar("event_type", { length: 100 }).notNull(),

    /**
     * Complete raw webhook payload (unmodified JSON body)
     */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),

    /**
     * Relevant HTTP headers captured at receipt time
     * Contains debugging context: signatures, user agents, delivery IDs
     */
    headers: jsonb("headers").$type<Record<string, string>>().notNull(),

    /**
     * When the webhook was received by our server
     */
    receivedAt: timestamp("received_at", { mode: "string", withTimezone: true }).notNull(),

    /**
     * When this record was created
     */
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /**
     * Primary query pattern: find payloads by workspace + time range
     * Used for browsing recent webhooks and time-bounded searches
     */
    workspaceReceivedIdx: index("webhook_payload_workspace_received_idx").on(
      table.workspaceId,
      table.receivedAt,
    ),

    /**
     * Find specific delivery for debugging/linking to observations
     * Used to connect raw payloads to processed observations via deliveryId
     */
    deliveryIdx: index("webhook_payload_delivery_idx").on(
      table.deliveryId,
    ),

    /**
     * Filter by source/type within workspace
     * Used for browsing webhooks by source (GitHub vs Vercel) and event type
     */
    workspaceSourceIdx: index("webhook_payload_workspace_source_idx").on(
      table.workspaceId,
      table.source,
      table.eventType,
    ),
  }),
);

// Type exports
export type WorkspaceWebhookPayload = typeof workspaceWebhookPayloads.$inferSelect;
export type InsertWorkspaceWebhookPayload = typeof workspaceWebhookPayloads.$inferInsert;
