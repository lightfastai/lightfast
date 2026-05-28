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
 * keeps historical rows. MySQL has no partial unique indexes, so an internal
 * nullable `active_clerk_org_id` mirror enforces one active binding per org:
 * active rows set it to `clerk_org_id`, inactive rows set it to `NULL`.
 */

import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  json,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

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

/** Clerk identifiers (org / user ids) — short, ASCII, prefix + 27-char base. */
const CLERK_ID_LENGTH = 64;
/** External provider-side identifiers — vary across GitHub / GitLab / Bitbucket. */
const PROVIDER_REF_LENGTH = 128;
/** Short controlled-vocabulary codes (provider name, lifecycle status). */
const CODE_LENGTH = 32;

export const orgSourceControlBindings = mysqlTable(
  "lightfast_org_source_control_bindings",
  {
    /**
     * Internal BIGINT primary key.
     */
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),

    /**
     * Clerk org ID (no FK — Clerk is the source of truth for orgs).
     */
    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    /**
     * Internal MySQL-compatible uniqueness mirror for active rows only.
     *
     * Active rows store `clerk_org_id`; revoked/error rows store NULL. MySQL
     * permits multiple NULLs in a unique index, matching the previous
     * active-row-only uniqueness behavior.
     */
    activeClerkOrgId: varchar("active_clerk_org_id", {
      length: CLERK_ID_LENGTH,
    }),

    /**
     * Source-control provider. v1 value: `github`.
     */
    provider: varchar("provider", { length: CODE_LENGTH })
      .$type<OrgSourceControlBindingProvider>()
      .notNull(),

    /**
     * Provider-side org/account id, once the real install flow lands.
     */
    providerAccountId: varchar("provider_account_id", {
      length: PROVIDER_REF_LENGTH,
    }),

    /**
     * Human-readable provider org login (e.g. the GitHub org slug).
     */
    providerAccountLogin: varchar("provider_account_login", {
      length: PROVIDER_REF_LENGTH,
    }),

    /**
     * GitHub App installation id (or the provider equivalent).
     */
    providerInstallationId: varchar("provider_installation_id", {
      length: PROVIDER_REF_LENGTH,
    }),

    /**
     * Lifecycle status — see {@link OrgSourceControlBindingStatus}.
     */
    status: varchar("status", { length: CODE_LENGTH })
      .$type<OrgSourceControlBindingStatus>()
      .notNull(),

    /**
     * Clerk user id that completed the bind.
     */
    connectedByUserId: varchar("connected_by_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),

    /**
     * When the binding was established.
     */
    connectedAt: timestamp("connected_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    /**
     * When the provider binding was removed; null while active.
     */
    revokedAt: timestamp("revoked_at", { mode: "date", fsp: 3 }),

    /**
     * Provider-specific details.
     */
    metadata: json("metadata").$type<Record<string, unknown>>().notNull(),

    /**
     * Row creation timestamp.
     */
    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    /**
     * Row last-update timestamp. Maintained by the repository helpers.
     */
    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    /**
     * v1 invariant: at most one `active` binding per org.
     */
    activePerOrgUq: uniqueIndex(
      "org_source_control_bindings_active_per_org_uq"
    ).on(table.activeClerkOrgId),

    /**
     * One binding per provider installation. Partial so rows without an
     * installation id (placeholders, pre-install state) do not collide.
     */
    installationUq: uniqueIndex(
      "org_source_control_bindings_installation_uq"
    ).on(table.providerInstallationId),

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
type OrgSourceControlBindingRow = typeof orgSourceControlBindings.$inferSelect;
export type OrgSourceControlBinding = Omit<
  OrgSourceControlBindingRow,
  "activeClerkOrgId"
>;
export type InsertOrgSourceControlBinding =
  typeof orgSourceControlBindings.$inferInsert;
