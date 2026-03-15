import { nanoid } from "@repo/lib";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { gatewayInstallations } from "./gateway-installations";

export const gatewayBackfillRuns = pgTable(
  "lightfast_gateway_backfill_runs",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    installationId: varchar("installation_id", { length: 191 })
      .notNull()
      .references(() => gatewayInstallations.id, { onDelete: "cascade" }),

    entityType: varchar("entity_type", { length: 50 }).notNull(),

    // Oldest date we fetched from (ISO timestamp)
    since: timestamp("since", { mode: "string", withTimezone: true }).notNull(),

    // Depth in days used for this run
    depth: integer("depth").notNull(),

    // Run lifecycle status: idle|pending|running|completed|failed|cancelled
    status: varchar("status", { length: 50 }).notNull(),

    pagesProcessed: integer("pages_processed").notNull().default(0),
    eventsProduced: integer("events_produced").notNull().default(0),
    eventsDispatched: integer("events_dispatched").notNull().default(0),

    error: text("error"),

    startedAt: timestamp("started_at", { mode: "string", withTimezone: true }),
    completedAt: timestamp("completed_at", {
      mode: "string",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // One tracking row per installation + entity type (upsert target)
    installationEntityIdx: uniqueIndex("gateway_br_installation_entity_idx").on(
      table.installationId,
      table.entityType
    ),
    installationIdx: index("gateway_br_installation_idx").on(table.installationId),
  })
);

export type GatewayBackfillRun = typeof gatewayBackfillRuns.$inferSelect;
export type InsertGatewayBackfillRun = typeof gatewayBackfillRuns.$inferInsert;
