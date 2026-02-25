import { pgTable, varchar, timestamp, text, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { nanoid } from "@repo/lib";
import { gwInstallations } from "./gw-installations";

export const gwTokens = pgTable(
  "lightfast_gw_tokens",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    installationId: varchar("installation_id", { length: 191 })
      .notNull()
      .references(() => gwInstallations.id, { onDelete: "cascade" }),

    accessToken: text("access_token").notNull(), // AES-256-GCM encrypted
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true }),
    tokenType: varchar("token_type", { length: 50 }),
    scope: text("scope"),

    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    installationIdIdx: index("gw_tok_installation_id_idx").on(table.installationId),
  }),
);

export type GwToken = typeof gwTokens.$inferSelect;
export type InsertGwToken = typeof gwTokens.$inferInsert;
