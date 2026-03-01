import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, text, index, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
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

    // Strongly-typed provider account info (discriminated union by sourceType)
    //
    // Every field is required unless there is a genuine reason it may not exist
    // (e.g. Vercel personal accounts have no team). No "unknown" defaults —
    // if data isn't available, the provider must fetch it or use "".
    providerAccountInfo: jsonb("provider_account_info").$type<
      | {
          version: 1;
          sourceType: "github";
          installations: {
            id: string;
            accountId: string;
            accountLogin: string;
            accountType: "User" | "Organization";
            avatarUrl: string;
            permissions: Record<string, string>;  // { contents: "read", issues: "write" }
            events: string[];                     // subscribed webhook event names
            installedAt: string;                  // ISO 8601
            lastValidatedAt: string;              // ISO 8601
          }[];
        }
      | {
          version: 1;
          sourceType: "vercel";
          userId: string;
          configurationId: string;
          scope: string;                          // OAuth scope from token exchange
          teamId?: string;                        // absent for personal Vercel accounts
          teamSlug?: string;                      // absent for personal Vercel accounts
        }
      | {
          version: 1;
          sourceType: "sentry";
          installationId: string;                 // from code param (installationId:authCode)
          organizationSlug: string;               // Sentry org slug — "" if not resolvable
        }
      | {
          version: 1;
          sourceType: "linear";
          scope: string;                          // OAuth scope from token exchange
        }
    >(),

    createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
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
