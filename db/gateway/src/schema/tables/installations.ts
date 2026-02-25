import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { nanoid } from "@repo/lib";

export const installations = sqliteTable(
  "gw_installations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    provider: text("provider", {
      enum: ["github", "vercel", "linear", "sentry"],
    }).notNull(),
    externalId: text("external_id").notNull(),
    accountLogin: text("account_login"),
    connectedBy: text("connected_by").notNull(),
    orgId: text("org_id").notNull(),
    status: text("status", {
      enum: ["pending", "active", "error", "revoked"],
    }).notNull(),
    webhookSecret: text("webhook_secret"),
    metadata: text("metadata", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    providerExternalIdx: uniqueIndex("gw_inst_provider_external_idx").on(
      table.provider,
      table.externalId,
    ),
    orgIdIdx: index("gw_inst_org_id_idx").on(table.orgId),
  }),
);

export type Installation = typeof installations.$inferSelect;
export type InsertInstallation = typeof installations.$inferInsert;
