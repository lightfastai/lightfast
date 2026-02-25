import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nanoid } from "@repo/lib";
import { installations } from "./installations";

export const resources = sqliteTable(
  "gw_resources",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    installationId: text("installation_id")
      .notNull()
      .references(() => installations.id, { onDelete: "cascade" }),
    providerResourceId: text("provider_resource_id").notNull(),
    resourceName: text("resource_name"),
    status: text("status", {
      enum: ["active", "removed"],
    }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    installationIdIdx: index("gw_res_installation_id_idx").on(
      table.installationId,
    ),
    providerResourceIdx: index("gw_res_provider_resource_idx").on(
      table.installationId,
      table.providerResourceId,
    ),
  }),
);

export type Resource = typeof resources.$inferSelect;
export type InsertResource = typeof resources.$inferInsert;
