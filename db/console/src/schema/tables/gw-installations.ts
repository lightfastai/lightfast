import { pgTable, varchar, timestamp, text, index, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { nanoid } from "@repo/lib";
import type { ClerkUserId } from "@repo/console-validation";

export const gwInstallations = pgTable(
  "lightfast_gw_installations",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    provider: varchar("provider", { length: 50 }).notNull(),
    externalId: varchar("external_id", { length: 191 }).notNull(),
    accountLogin: varchar("account_login", { length: 191 }),
    connectedBy: varchar("connected_by", { length: 191 }).notNull().$type<ClerkUserId>(),
    orgId: varchar("org_id", { length: 191 }).notNull(),

    status: varchar("status", { length: 50 }).notNull(), // active|pending|error|revoked

    webhookSecret: text("webhook_secret"),
    metadata: jsonb("metadata"),

    // Strongly-typed provider account info (replaces userSources.providerMetadata)
    providerAccountInfo: jsonb("provider_account_info").$type<
      | {
          version: 1;
          sourceType: "github";
          installations?: {
            id: string;
            accountId: string;
            accountLogin: string;
            accountType: "User" | "Organization";
            avatarUrl: string;
            permissions: Record<string, string>;
            installedAt: string;
            lastValidatedAt: string;
          }[];
        }
      | {
          version: 1;
          sourceType: "vercel";
          teamId?: string;
          teamSlug?: string;
          userId: string;
          configurationId: string;
        }
      | {
          version: 1;
          sourceType: "linear" | "sentry";
        }
    >(),

    createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    providerExternalIdx: uniqueIndex("gw_inst_provider_external_idx").on(
      table.provider,
      table.externalId,
    ),
    orgIdIdx: index("gw_inst_org_id_idx").on(table.orgId),
    orgProviderIdx: index("gw_inst_org_provider_idx").on(table.orgId, table.provider),
    connectedByIdx: index("gw_inst_connected_by_idx").on(table.connectedBy),
  }),
);

export type GwInstallation = typeof gwInstallations.$inferSelect;
export type InsertGwInstallation = typeof gwInstallations.$inferInsert;
