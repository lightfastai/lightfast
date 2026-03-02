import { pgTable, varchar, integer, timestamp, text, uniqueIndex, index } from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import { gwInstallations } from "./gw-installations";

export const gwBackfillRuns = pgTable(
  "lightfast_gw_backfill_runs",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    installationId: varchar("installation_id", { length: 191 })
      .notNull()
      .references(() => gwInstallations.id, { onDelete: "cascade" }),

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
    completedAt: timestamp("completed_at", { mode: "string", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // One tracking row per installation + entity type (upsert target)
    installationEntityIdx: uniqueIndex("gw_br_installation_entity_idx").on(
      table.installationId,
      table.entityType,
    ),
    installationIdx: index("gw_br_installation_idx").on(table.installationId),
  }),
);

export type GwBackfillRun = typeof gwBackfillRuns.$inferSelect;
export type InsertGwBackfillRun = typeof gwBackfillRuns.$inferInsert;
