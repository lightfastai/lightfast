import { nanoid } from "@vendor/lib";
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { gatewayInstallations } from "./gateway-installations";

export const gatewayTokens = pgTable(
  "lightfast_gateway_tokens",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    installationId: varchar("installation_id", { length: 191 })
      .notNull()
      .references(() => gatewayInstallations.id, { onDelete: "cascade" }),

    accessToken: text("access_token").notNull(), // AES-256-GCM encrypted
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true }),
    tokenType: varchar("token_type", { length: 50 }),
    scope: text("scope"),

    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    installationIdIdx: uniqueIndex("gateway_tok_installation_id_idx").on(
      table.installationId
    ),
  })
);

export type GatewayToken = typeof gatewayTokens.$inferSelect;
export type InsertGatewayToken = typeof gatewayTokens.$inferInsert;
