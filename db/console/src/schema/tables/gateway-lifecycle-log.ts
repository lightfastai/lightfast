import { nanoid } from "@repo/lib";
import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { gatewayInstallations } from "./gateway-installations";

export const gatewayLifecycleLogs = pgTable(
  "lightfast_gateway_lifecycle_logs",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    installationId: varchar("installation_id", { length: 191 })
      .notNull()
      .references(() => gatewayInstallations.id, { onDelete: "cascade" }),

    event: varchar("event", { length: 50 }).notNull(),
    // e.g., "health_check_passed", "health_check_failed", "config_updated", "status_changed"

    fromStatus: varchar("from_status", { length: 50 }),
    toStatus: varchar("to_status", { length: 50 }),

    resourceIds: jsonb("resource_ids").$type<Record<string, string>>(),
    metadata:
      jsonb("metadata").$type<
        Record<string, string | number | boolean | null>
      >(),

    reason: text("reason"),

    occurredAt: timestamp("occurred_at", { mode: "string", withTimezone: true })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    installationIdx: index("gateway_ll_installation_idx").on(
      table.installationId
    ),
    installationOccurredIdx: index("gateway_ll_installation_occurred_idx").on(
      table.installationId,
      table.occurredAt
    ),
    eventIdx: index("gateway_ll_event_idx").on(table.event),
  })
);

export type GatewayLifecycleLog = typeof gatewayLifecycleLogs.$inferSelect;
export type InsertGatewayLifecycleLog =
  typeof gatewayLifecycleLogs.$inferInsert;
