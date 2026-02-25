import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nanoid } from "@repo/lib";
import { installations } from "./installations";

export const tokens = sqliteTable("gw_tokens", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  installationId: text("installation_id")
    .notNull()
    .references(() => installations.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  tokenType: text("token_type"),
  scope: text("scope"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Token = typeof tokens.$inferSelect;
export type InsertToken = typeof tokens.$inferInsert;
