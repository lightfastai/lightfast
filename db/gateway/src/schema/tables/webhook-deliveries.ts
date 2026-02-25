import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nanoid } from "@repo/lib";

export const webhookDeliveries = sqliteTable(
  "gw_webhook_deliveries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    provider: text("provider", {
      enum: ["github", "vercel", "linear", "sentry"],
    }).notNull(),
    deliveryId: text("delivery_id").notNull(),
    eventType: text("event_type").notNull(),
    installationId: text("installation_id"),
    status: text("status", {
      enum: ["delivered", "dlq", "duplicate"],
    }).notNull(),
    receivedAt: integer("received_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    providerDeliveryIdx: index("gw_wd_provider_delivery_idx").on(
      table.provider,
      table.deliveryId,
    ),
  }),
);

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type InsertWebhookDelivery = typeof webhookDeliveries.$inferInsert;
