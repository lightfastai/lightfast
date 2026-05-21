/**
 * Org Source-Control Bindings Table Schema
 *
 * A **Binding** is the authoritative link between a Lightfast organization and
 * an external source-control organization (a GitHub org in v1; a GitLab group
 * or Bitbucket workspace later). The provider is an attribute of the row, not
 * part of the table name.
 *
 * This table is the source of truth for binding state. A compact, non-sensitive
 * mirror of the status is written into Clerk org `publicMetadata` so it can be
 * minted into session/JWT claims — but operationally important or sensitive
 * details (installation ids, provider payloads) live here and never in Clerk.
 *
 * The v1 gate means "the org has at least one `active` binding". The schema
 * keeps historical rows, but a partial unique index permits only one active
 * binding per org for v1.
 */

import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Source-control provider. v1 ships `github` only; the column is widened as
 * GitLab / Bitbucket land. No durable identifier in this plan contains the
 * provider name — the gate is provider-agnostic.
 */
export type OrgSourceControlBindingProvider = "github";

/**
 * Lifecycle of a single binding row.
 * - `active`  — the binding is live; the org counts as bound.
 * - `revoked` — the provider binding was removed; row kept for history.
 * - `error`   — the binding is broken (e.g. provider install deleted upstream).
 */
export type OrgSourceControlBindingStatus = "active" | "revoked" | "error";

export const orgSourceControlBindings = pgTable(
  "lightfast_org_source_control_bindings",
  {
    /**
     * Internal BIGINT primary key.
     */
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    /**
     * Clerk org ID (no FK — Clerk is the source of truth for orgs).
     */
    clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),

    /**
     * Source-control provider. v1 value: `github`.
     */
    provider: varchar("provider", { length: 50 })
      .$type<OrgSourceControlBindingProvider>()
      .notNull(),

    /**
     * Provider-side org/account id, once the real install flow lands.
     */
    providerAccountId: varchar("provider_account_id", { length: 191 }),

    /**
     * Human-readable provider org login (e.g. the GitHub org slug).
     */
    providerAccountLogin: varchar("provider_account_login", { length: 191 }),

    /**
     * GitHub App installation id (or the provider equivalent).
     */
    providerInstallationId: varchar("provider_installation_id", {
      length: 191,
    }),

    /**
     * Lifecycle status — see {@link OrgSourceControlBindingStatus}.
     */
    status: varchar("status", { length: 50 })
      .$type<OrgSourceControlBindingStatus>()
      .notNull(),

    /**
     * Clerk user id that completed the bind.
     */
    connectedByUserId: varchar("connected_by_user_id", {
      length: 191,
    }).notNull(),

    /**
     * When the binding was established.
     */
    connectedAt: timestamp("connected_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    /**
     * When the provider binding was removed; null while active.
     */
    revokedAt: timestamp("revoked_at", { mode: "string", withTimezone: true }),

    /**
     * Provider-specific details. Default `{}`.
     */
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),

    /**
     * Row creation timestamp.
     */
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    /**
     * Row last-update timestamp. Maintained by the repository helpers.
     */
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    /**
     * v1 invariant: at most one `active` binding per org. Partial unique index
     * so historical `revoked`/`error` rows do not collide.
     */
    activePerOrgUq: uniqueIndex("org_source_control_bindings_active_per_org_uq")
      .on(table.clerkOrgId)
      .where(sql`${table.status} = 'active'`),

    /**
     * One binding per provider installation. Partial so rows without an
     * installation id (placeholders, pre-install state) do not collide.
     */
    installationUq: uniqueIndex("org_source_control_bindings_installation_uq")
      .on(table.providerInstallationId)
      .where(sql`${table.providerInstallationId} is not null`),

    /**
     * Primary lookup: the gate query (`clerkOrgId` + `status`).
     */
    orgStatusIdx: index("org_source_control_bindings_org_status_idx").on(
      table.clerkOrgId,
      table.status
    ),

    /**
     * Reverse lookup from a provider account back to the binding.
     */
    providerAccountIdx: index(
      "org_source_control_bindings_provider_account_idx"
    ).on(table.provider, table.providerAccountId),
  })
);

// TypeScript types
export type OrgSourceControlBinding =
  typeof orgSourceControlBindings.$inferSelect;
export type InsertOrgSourceControlBinding =
  typeof orgSourceControlBindings.$inferInsert;
