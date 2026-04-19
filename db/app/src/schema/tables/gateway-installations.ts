import type { ProviderAccountInfo, SourceType } from "@repo/app-providers";
import type { GwInstallationBackfillConfig } from "@repo/app-providers/contracts";
import type { ClerkUserId } from "@repo/app-validation";
import { nanoid } from "@vendor/lib";
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const gatewayInstallations = pgTable(
  "lightfast_gateway_installations",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    provider: varchar("provider", { length: 50 }).notNull().$type<SourceType>(),
    externalId: varchar("external_id", { length: 191 }).notNull(),
    connectedBy: varchar("connected_by", { length: 191 })
      .notNull()
      .$type<ClerkUserId>(),
    orgId: varchar("org_id", { length: 191 }).notNull(),

    status: varchar("status", { length: 50 }).notNull(), // active|pending|error|revoked

    /**
     * Provider-specific installation metadata (JSONB) — discriminated union by sourceType.
     *
     * Schema: providerAccountInfoSchema from @repo/app-providers
     *
     * DESIGN INVARIANT:
     * - `raw` = non-secret fields from the token exchange / OAuth response only
     * - NEVER store display names (account login, org name, avatar, slug) here
     * - Display data is resolved live via provider APIs in connections.*.list/get
     * - This column stores identity + operational data, not presentation data
     *
     * NEVER add resource-specific data (repos[], projects[], teams[]) — those
     * belong in providerConfig on gateway_installations, one row per resource.
     */
    providerAccountInfo: jsonb(
      "provider_account_info"
    ).$type<ProviderAccountInfo>(),

    /** Optional backfill configuration for this installation. */
    backfillConfig:
      jsonb("backfill_config").$type<GwInstallationBackfillConfig>(),

    // Health monitoring columns
    healthStatus: varchar("health_status", { length: 50 })
      .notNull()
      .default("unknown"),
    lastHealthCheckAt: timestamp("last_health_check_at", {
      mode: "string",
      withTimezone: true,
    }),
    healthCheckFailures: integer("health_check_failures").notNull().default(0),

    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    providerExternalIdx: uniqueIndex("gateway_inst_provider_external_idx").on(
      table.provider,
      table.externalId
    ),
    orgIdIdx: index("gateway_inst_org_id_idx").on(table.orgId),
    orgProviderIdx: index("gateway_inst_org_provider_idx").on(
      table.orgId,
      table.provider
    ),
    connectedByIdx: index("gateway_inst_connected_by_idx").on(
      table.connectedBy
    ),
  })
);

export type GatewayInstallation = typeof gatewayInstallations.$inferSelect;
export type InsertGatewayInstallation =
  typeof gatewayInstallations.$inferInsert;
