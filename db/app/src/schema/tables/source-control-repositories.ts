import type {
  SourceControlWebhookDeliveryStatus,
  WatchedPathGlobs,
} from "@repo/source-control-contract";
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

const PROVIDER_REF_LENGTH = 128;
const REPOSITORY_FULL_NAME_LENGTH = 256;
const CODE_LENGTH = 64;
const SHA_LENGTH = 64;

export const sourceControlRepositories = mysqlTable(
  "lightfast_source_control_repositories",
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

    watchedPathGlobs: json("watched_path_globs")
      .$type<WatchedPathGlobs>()
      .notNull(),

    lastSeenSha: varchar("last_seen_sha", { length: SHA_LENGTH }),

    lastProcessedSha: varchar("last_processed_sha", { length: SHA_LENGTH }),

    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    bindingRepositoryUq: uniqueIndex(
      "source_control_repositories_binding_repository_uq"
    ).on(table.orgSourceControlBindingId, table.providerRepositoryId),
    providerRepositoryIdx: index(
      "source_control_repositories_provider_repository_idx"
    ).on(table.providerRepositoryId),
  })
);

export const sourceControlWebhookDeliveries = mysqlTable(
  "lightfast_source_control_webhook_deliveries",
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

    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    deliveryIdUq: uniqueIndex(
      "source_control_webhook_deliveries_delivery_id_uq"
    ).on(table.deliveryId),
    installationRepositoryIdx: index(
      "source_control_webhook_deliveries_installation_repository_idx"
    ).on(table.providerInstallationId, table.providerRepositoryId),
    statusUpdatedIdx: index(
      "source_control_webhook_deliveries_status_updated_idx"
    ).on(table.status, table.updatedAt),
  })
);

export type SourceControlRepository =
  typeof sourceControlRepositories.$inferSelect;
export type InsertSourceControlRepository =
  typeof sourceControlRepositories.$inferInsert;

export type SourceControlWebhookDelivery =
  typeof sourceControlWebhookDeliveries.$inferSelect;
export type InsertSourceControlWebhookDelivery =
  typeof sourceControlWebhookDeliveries.$inferInsert;
