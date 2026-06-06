import type {
  SourceControlPrWebhookEvent,
  SourceControlRepositorySyncStatus,
  SourceControlWebhookDeliveryStatus,
  WatchedPathGlobs,
} from "@repo/source-control-contract";
import { sql } from "drizzle-orm";
import {
  bigint,
  datetime,
  index,
  json,
  mysqlTable,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const PROVIDER_REF_LENGTH = 128;
const REPOSITORY_FULL_NAME_LENGTH = 256;
const CODE_LENGTH = 64;

export const orgSourceControlRepositories = mysqlTable(
  "lightfast_org_source_control_repositories",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    orgSourceControlBindingId: bigint("org_source_control_binding_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    providerRepositoryId: varchar("provider_repository_id", {
      length: PROVIDER_REF_LENGTH,
    }).notNull(),

    fullName: varchar("full_name", {
      length: REPOSITORY_FULL_NAME_LENGTH,
    }).notNull(),

    watchedPathGlobs: json(
      "watched_path_globs"
    ).$type<WatchedPathGlobs | null>(),

    watchedWebhookEvents: json("watched_webhook_events").$type<
      SourceControlPrWebhookEvent[] | null
    >(),

    syncStatus: varchar("sync_status", { length: CODE_LENGTH })
      .$type<SourceControlRepositorySyncStatus>()
      .default("enabled")
      .notNull(),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    bindingRepositoryUq: uniqueIndex(
      "org_source_control_repositories_binding_repository_uq"
    ).on(table.orgSourceControlBindingId, table.providerRepositoryId),
    providerRepositoryIdx: index(
      "org_source_control_repositories_provider_repository_idx"
    ).on(table.providerRepositoryId),
  })
);

export const orgSourceControlWebhookDeliveries = mysqlTable(
  "lightfast_org_source_control_webhook_deliveries",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    deliveryId: varchar("delivery_id", {
      length: PROVIDER_REF_LENGTH,
    }).notNull(),

    event: varchar("event", { length: CODE_LENGTH }).notNull(),

    providerInstallationId: varchar("provider_installation_id", {
      length: PROVIDER_REF_LENGTH,
    }).notNull(),

    providerRepositoryId: varchar("provider_repository_id", {
      length: PROVIDER_REF_LENGTH,
    }).notNull(),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<SourceControlWebhookDeliveryStatus>()
      .notNull(),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    deliveryIdUq: uniqueIndex(
      "org_source_control_webhook_deliveries_delivery_id_uq"
    ).on(table.deliveryId),
    installationRepositoryIdx: index(
      "org_source_control_webhook_deliveries_installation_repo_idx"
    ).on(table.providerInstallationId, table.providerRepositoryId),
    statusUpdatedIdx: index(
      "org_source_control_webhook_deliveries_status_updated_idx"
    ).on(table.status, table.updatedAt),
  })
);

export const orgSourceControlPrWebhookDeliveries = mysqlTable(
  "lightfast_org_source_control_pr_webhook_deliveries",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    deliveryId: varchar("delivery_id", {
      length: PROVIDER_REF_LENGTH,
    }).notNull(),

    clerkOrgId: varchar("clerk_org_id", { length: 64 }).notNull(),

    orgSourceControlBindingId: bigint("org_source_control_binding_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    sourceControlRepositoryId: bigint("source_control_repository_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    providerInstallationId: varchar("provider_installation_id", {
      length: PROVIDER_REF_LENGTH,
    }).notNull(),

    providerRepositoryId: varchar("provider_repository_id", {
      length: PROVIDER_REF_LENGTH,
    }).notNull(),

    event: varchar("event", { length: CODE_LENGTH })
      .$type<SourceControlPrWebhookEvent>()
      .notNull(),

    action: varchar("action", { length: CODE_LENGTH }).notNull(),

    providerPullRequestId: varchar("provider_pull_request_id", {
      length: PROVIDER_REF_LENGTH,
    }),

    pullRequestNumber: bigint("pull_request_number", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    rawPayload: json("raw_payload").$type<Record<string, unknown>>().notNull(),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    deliveryUq: uniqueIndex(
      "org_source_control_pr_webhook_deliveries_delivery_uq"
    ).on(table.deliveryId),
    orgCreatedIdx: index(
      "org_source_control_pr_webhook_deliveries_org_created_idx"
    ).on(table.clerkOrgId, table.createdAt, table.id),
    repoPrIdx: index("org_source_control_pr_webhook_deliveries_repo_pr_idx").on(
      table.sourceControlRepositoryId,
      table.pullRequestNumber,
      table.createdAt,
      table.id
    ),
    providerRepoIdx: index(
      "org_source_control_pr_webhook_deliveries_provider_repo_idx"
    ).on(
      table.providerInstallationId,
      table.providerRepositoryId,
      table.createdAt,
      table.id
    ),
  })
);

export type SourceControlRepository =
  typeof orgSourceControlRepositories.$inferSelect;
export type InsertSourceControlRepository =
  typeof orgSourceControlRepositories.$inferInsert;

export type SourceControlWebhookDelivery =
  typeof orgSourceControlWebhookDeliveries.$inferSelect;
export type InsertSourceControlWebhookDelivery =
  typeof orgSourceControlWebhookDeliveries.$inferInsert;

export type SourceControlPrWebhookDelivery =
  typeof orgSourceControlPrWebhookDeliveries.$inferSelect;
export type InsertSourceControlPrWebhookDelivery =
  typeof orgSourceControlPrWebhookDeliveries.$inferInsert;
