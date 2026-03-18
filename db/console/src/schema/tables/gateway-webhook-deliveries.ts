import { nanoid } from "@repo/lib";
import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const gatewayWebhookDeliveries = pgTable(
  "lightfast_gateway_webhook_deliveries",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    provider: varchar("provider", { length: 50 }).notNull(),
    deliveryId: varchar("delivery_id", { length: 191 }).notNull(),
    eventType: varchar("event_type", { length: 191 }).notNull(),
    installationId: varchar("installation_id", { length: 191 }),

    status: varchar("status", { length: 50 }).notNull(), // received|enqueued|delivered|dlq

    failReason: varchar("fail_reason", { length: 100 }),

    // For DLQ replay — store raw payload on failed deliveries
    payload: text("payload"),

    receivedAt: timestamp("received_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
  },
  (table) => ({
    providerDeliveryIdx: uniqueIndex("gateway_wd_provider_delivery_idx").on(
      table.provider,
      table.deliveryId
    ),
    statusIdx: index("gateway_wd_status_idx").on(table.status),
    recoveryIdx: index("gateway_wd_recovery_idx")
      .on(table.status, table.receivedAt)
      .where(sql`${table.status} = 'received'`),
  })
);

export type GatewayWebhookDelivery =
  typeof gatewayWebhookDeliveries.$inferSelect;
export type InsertGatewayWebhookDelivery =
  typeof gatewayWebhookDeliveries.$inferInsert;
