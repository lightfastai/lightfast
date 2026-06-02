import type {
  IdentityFileKind,
  IdentityFileStatus,
  IdentityIndexRefreshStatus,
} from "@repo/identity-contract";
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  int,
  json,
  mediumtext,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const SHA_LENGTH = 64;
const HASH_LENGTH = 128;
const CODE_LENGTH = 64;

export const identityIndexStates = mysqlTable(
  "lightfast_identity_index_states",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    sourceControlRepositoryId: bigint("source_control_repository_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    indexedCommitSha: varchar("indexed_commit_sha", { length: SHA_LENGTH }),

    indexedTreeSha: varchar("indexed_tree_sha", { length: SHA_LENGTH }),

    indexedAt: timestamp("indexed_at", { mode: "date", fsp: 3 }),

    presentFileCount: int("present_file_count", { unsigned: true })
      .default(0)
      .notNull(),

    missingFileCount: int("missing_file_count", { unsigned: true })
      .default(0)
      .notNull(),

    tooLargeFileCount: int("too_large_file_count", { unsigned: true })
      .default(0)
      .notNull(),

    readErrorFileCount: int("read_error_file_count", { unsigned: true })
      .default(0)
      .notNull(),

    lastCheckedCommitSha: varchar("last_checked_commit_sha", {
      length: SHA_LENGTH,
    }),

    lastCheckedAt: timestamp("last_checked_at", { mode: "date", fsp: 3 }),

    githubRefEtag: varchar("github_ref_etag", { length: 256 }),

    lastRefreshStatus: varchar("last_refresh_status", { length: CODE_LENGTH })
      .$type<IdentityIndexRefreshStatus>()
      .default("never")
      .notNull(),

    lastRefreshErrorCode: varchar("last_refresh_error_code", {
      length: CODE_LENGTH,
    }),

    lastRefreshErrorMessage: varchar("last_refresh_error_message", {
      length: 512,
    }),

    lastRefreshSucceededAt: timestamp("last_refresh_succeeded_at", {
      mode: "date",
      fsp: 3,
    }),

    lastRefreshFailedAt: timestamp("last_refresh_failed_at", {
      mode: "date",
      fsp: 3,
    }),

    indexDiagnostics: json("index_diagnostics")
      .$type<string[]>()
      .default(sql`(JSON_ARRAY())`)
      .notNull(),

    refreshLockToken: varchar("refresh_lock_token", { length: 128 }),

    refreshLockedUntil: timestamp("refresh_locked_until", {
      mode: "date",
      fsp: 3,
    }),

    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    // NOTE: runtime `$onUpdate` hook, NOT the DDL `.onUpdateNow()`. drizzle-kit
    // emits `ON UPDATE CURRENT_TIMESTAMP` without the required `(3)` precision
    // for timestamp(3), which Vitess rejects on CREATE TABLE.
    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    sourceControlRepositoryUq: uniqueIndex(
      "identity_index_states_source_control_repository_uq"
    ).on(table.sourceControlRepositoryId),
    lastCheckedIdx: index("identity_index_states_last_checked_idx").on(
      table.lastCheckedAt
    ),
    refreshLockedUntilIdx: index(
      "identity_index_states_refresh_locked_until_idx"
    ).on(table.refreshLockedUntil),
  })
);

export const identityIndexFiles = mysqlTable(
  "lightfast_identity_index_files",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    identityIndexStateId: bigint("identity_index_state_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    indexedCommitSha: varchar("indexed_commit_sha", {
      length: SHA_LENGTH,
    }),

    kind: varchar("kind", { length: CODE_LENGTH })
      .$type<IdentityFileKind>()
      .notNull(),

    path: varchar("path", { length: 512 }).notNull(),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<IdentityFileStatus>()
      .notNull(),

    sourceMarkdown: mediumtext("source_markdown"),

    contentHash: varchar("content_hash", { length: HASH_LENGTH }),

    contentSha: varchar("content_sha", { length: SHA_LENGTH }),

    contentSize: int("content_size", { unsigned: true }),

    diagnostics: json("diagnostics")
      .$type<string[]>()
      .default(sql`(JSON_ARRAY())`)
      .notNull(),

    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    // NOTE: runtime `$onUpdate` hook, NOT the DDL `.onUpdateNow()`. drizzle-kit
    // emits `ON UPDATE CURRENT_TIMESTAMP` without the required `(3)` precision
    // for timestamp(3), which Vitess rejects on CREATE TABLE.
    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    stateKindUq: uniqueIndex("identity_index_files_state_kind_uq").on(
      table.identityIndexStateId,
      table.kind
    ),
    stateStatusIdx: index("identity_index_files_state_status_idx").on(
      table.identityIndexStateId,
      table.status
    ),
  })
);

export type IdentityIndexState = typeof identityIndexStates.$inferSelect;
export type InsertIdentityIndexState = typeof identityIndexStates.$inferInsert;

export type IdentityIndexFile = typeof identityIndexFiles.$inferSelect;
export type InsertIdentityIndexFile = typeof identityIndexFiles.$inferInsert;
