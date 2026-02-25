import { pgTable, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import { gwInstallations } from "./gw-installations";

export const gwResources = pgTable(
  "lightfast_gw_resources",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    installationId: varchar("installation_id", { length: 191 })
      .notNull()
      .references(() => gwInstallations.id, { onDelete: "cascade" }),

    providerResourceId: varchar("provider_resource_id", { length: 191 }).notNull(),
    resourceName: varchar("resource_name", { length: 500 }),

    status: varchar("status", { length: 50 }).notNull(), // active|removed

    createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    installationIdIdx: index("gw_res_installation_id_idx").on(table.installationId),
    providerResourceIdx: index("gw_res_provider_resource_idx").on(
      table.installationId,
      table.providerResourceId,
    ),
  }),
);

export type GwResource = typeof gwResources.$inferSelect;
export type InsertGwResource = typeof gwResources.$inferInsert;
