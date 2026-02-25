import { pgTable, varchar, timestamp, index, uniqueIndex, text } from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";

export const gwWebhookDeliveries = pgTable(
  "lightfast_gw_webhook_deliveries",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    provider: varchar("provider", { length: 50 }).notNull(),
    deliveryId: varchar("delivery_id", { length: 191 }).notNull(),
    eventType: varchar("event_type", { length: 191 }).notNull(),
    installationId: varchar("installation_id", { length: 191 }),

    status: varchar("status", { length: 50 }).notNull(), // received|delivered|dlq

    // For DLQ replay — store raw payload on failed deliveries
    payload: text("payload"),

    receivedAt: timestamp("received_at", { mode: "string", withTimezone: true }).notNull(),
  },
  (table) => ({
    providerDeliveryIdx: uniqueIndex("gw_wd_provider_delivery_idx").on(
      table.provider,
      table.deliveryId,
    ),
    statusIdx: index("gw_wd_status_idx").on(table.status),
  }),
);

export type GwWebhookDelivery = typeof gwWebhookDeliveries.$inferSelect;
export type InsertGwWebhookDelivery = typeof gwWebhookDeliveries.$inferInsert;
