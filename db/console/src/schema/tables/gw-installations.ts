import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, text, index, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import type { ClerkUserId } from "@repo/console-validation";
import type { ProviderAccountInfo, SourceType } from "@repo/console-providers";

export const gwInstallations = pgTable(
  "lightfast_gw_installations",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    provider: varchar("provider", { length: 50 }).notNull().$type<SourceType>(),
    externalId: varchar("external_id", { length: 191 }).notNull(),
    accountLogin: varchar("account_login", { length: 191 }),
    connectedBy: varchar("connected_by", { length: 191 }).notNull().$type<ClerkUserId>(),
    orgId: varchar("org_id", { length: 191 }).notNull(),

    status: varchar("status", { length: 50 }).notNull(), // active|pending|error|revoked

    webhookSecret: text("webhook_secret"),
    metadata: jsonb("metadata"),

    /**
     * OAuth installation-level metadata (JSONB) — discriminated union by sourceType.
     *
     * Schema: providerAccountInfoSchema from @repo/console-providers
     *
     * Contains ONLY data needed for:
     *   1. OAuth token retrieval / refresh (raw token data)
     *   2. Webhook scoping (which events the installation is subscribed to)
     *   3. Account identity for UI (name, avatar — stored in `raw` as cache)
     *
     * NEVER add resource-specific data (repos[], projects[], teams[]) — those
     * belong in providerConfig on workspace_integrations, one row per resource.
     */
    providerAccountInfo: jsonb("provider_account_info").$type<ProviderAccountInfo>(),

    /** Optional backfill configuration for this installation. */
    backfillConfig: jsonb("backfill_config").$type<{
      depth: 7 | 30 | 90;
      entityTypes: string[];
    }>(),

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
