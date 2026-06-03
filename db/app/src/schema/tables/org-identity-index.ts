import type {
  IdentityFileKind,
  IdentityFileStatus,
  IdentityIndexRefreshStatus,
} from "@repo/identity-contract";
import { sql } from "drizzle-orm";
import {
  bigint,
  datetime,
  index,
  int,
  json,
  mediumtext,
  mysqlTable,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const SHA_LENGTH = 64;
const HASH_LENGTH = 128;
const CODE_LENGTH = 64;

export const orgIdentityIndexStates = mysqlTable(
  "lightfast_org_identity_index_states",
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

    indexedAt: datetime("indexed_at", { mode: "date", fsp: 3 }),

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

    lastCheckedAt: datetime("last_checked_at", { mode: "date", fsp: 3 }),

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

    lastRefreshSucceededAt: datetime("last_refresh_succeeded_at", {
      mode: "date",
      fsp: 3,
    }),

    lastRefreshFailedAt: datetime("last_refresh_failed_at", {
      mode: "date",
      fsp: 3,
    }),

    indexDiagnostics: json("index_diagnostics")
      .$type<string[]>()
      .default(sql`(JSON_ARRAY())`)
      .notNull(),

    refreshLockToken: varchar("refresh_lock_token", { length: 128 }),

    refreshLockedUntil: datetime("refresh_locked_until", {
      mode: "date",
      fsp: 3,
    }),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    // Runtime hook keeps updated-at-on-write semantics without database-side
    // on-update DDL.
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    sourceControlRepositoryUq: uniqueIndex(
      "org_identity_index_states_source_control_repository_uq"
    ).on(table.sourceControlRepositoryId),
    lastCheckedIdx: index("org_identity_index_states_last_checked_idx").on(
      table.lastCheckedAt
    ),
    refreshLockedUntilIdx: index(
      "org_identity_index_states_refresh_locked_until_idx"
    ).on(table.refreshLockedUntil),
  })
);

export const orgIdentityIndexFiles = mysqlTable(
  "lightfast_org_identity_index_files",
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

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    // Runtime hook keeps updated-at-on-write semantics without database-side
    // on-update DDL.
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    stateKindUq: uniqueIndex("org_identity_index_files_state_kind_uq").on(
      table.identityIndexStateId,
      table.kind
    ),
    stateStatusIdx: index("org_identity_index_files_state_status_idx").on(
      table.identityIndexStateId,
      table.status
    ),
  })
);

export type IdentityIndexState = typeof orgIdentityIndexStates.$inferSelect;
export type InsertIdentityIndexState = typeof orgIdentityIndexStates.$inferInsert;

export type IdentityIndexFile = typeof orgIdentityIndexFiles.$inferSelect;
export type InsertIdentityIndexFile = typeof orgIdentityIndexFiles.$inferInsert;
