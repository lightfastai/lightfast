import { nanoid } from "@repo/lib";
import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { gatewayInstallations } from "./gateway-installations";

export const gatewayResources = pgTable(
  "lightfast_gateway_resources",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    installationId: varchar("installation_id", { length: 191 })
      .notNull()
      .references(() => gatewayInstallations.id, { onDelete: "cascade" }),

    providerResourceId: varchar("provider_resource_id", {
      length: 191,
    }).notNull(),
    resourceName: varchar("resource_name", { length: 500 }),

    status: varchar("status", { length: 50 }).notNull(), // active|removed

    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    installationIdIdx: index("gateway_res_installation_id_idx").on(
      table.installationId
    ),
    providerResourceIdx: uniqueIndex("gateway_res_provider_resource_idx").on(
      table.installationId,
      table.providerResourceId
    ),
  })
);

export type GatewayResource = typeof gatewayResources.$inferSelect;
export type InsertGatewayResource = typeof gatewayResources.$inferInsert;
