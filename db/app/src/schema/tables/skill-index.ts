import type {
  SkillDiagnostic,
  SkillIndexRefreshStatus,
  SkillResources,
  SkillValidationStatus,
} from "@repo/skills-contract";
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
const CODE_LENGTH = 64;

export type SkillIndexEntryMetadata = Record<
  string,
  string | number | boolean | null
>;
export type ResourcesTruncatedFlag = 0 | 1;

export const skillIndexStates = mysqlTable(
  "lightfast_skill_index_states",
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

    skillCount: int("skill_count", { unsigned: true }).default(0).notNull(),

    invalidSkillCount: int("invalid_skill_count", { unsigned: true })
      .default(0)
      .notNull(),

    lastCheckedCommitSha: varchar("last_checked_commit_sha", {
      length: SHA_LENGTH,
    }),

    lastCheckedAt: timestamp("last_checked_at", { mode: "date", fsp: 3 }),

    githubRefEtag: varchar("github_ref_etag", { length: 256 }),

    lastRefreshStatus: varchar("last_refresh_status", { length: CODE_LENGTH })
      .$type<SkillIndexRefreshStatus>()
      .default("never")
      .notNull(),

    lastRefreshErrorCode: varchar("last_refresh_error_code", {
      length: CODE_LENGTH,
    }),

    lastRefreshErrorMessage: varchar("last_refresh_error_message", {
      length: 512,
    }),

    lastRefreshFailedAt: timestamp("last_refresh_failed_at", {
      mode: "date",
      fsp: 3,
    }),

    indexDiagnostics: json("index_diagnostics")
      .$type<SkillDiagnostic[]>()
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

    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    sourceControlRepositoryUq: uniqueIndex(
      "skill_index_states_source_control_repository_uq"
    ).on(table.sourceControlRepositoryId),
    lastCheckedIdx: index("skill_index_states_last_checked_idx").on(
      table.lastCheckedAt
    ),
    refreshLockedUntilIdx: index(
      "skill_index_states_refresh_locked_until_idx"
    ).on(table.refreshLockedUntil),
  })
);

export const skillIndexEntries = mysqlTable(
  "lightfast_skill_index_entries",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    skillIndexStateId: bigint("skill_index_state_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    indexedCommitSha: varchar("indexed_commit_sha", {
      length: SHA_LENGTH,
    }).notNull(),

    slug: varchar("slug", { length: 63 }).notNull(),

    path: varchar("path", { length: 512 }).notNull(),

    name: varchar("name", { length: 63 }),

    description: varchar("description", { length: 1024 }),

    license: varchar("license", { length: 256 }),

    compatibility: varchar("compatibility", { length: 512 }),

    allowedTools: varchar("allowed_tools", { length: 2048 }),

    metadata: json("metadata")
      .$type<SkillIndexEntryMetadata>()
      .default(sql`(JSON_OBJECT())`)
      .notNull(),

    sourceMarkdown: mediumtext("source_markdown"),

    bodyMarkdown: mediumtext("body_markdown"),

    contentSha: varchar("content_sha", { length: SHA_LENGTH }).notNull(),

    contentSize: int("content_size", { unsigned: true }),

    validationStatus: varchar("validation_status", { length: CODE_LENGTH })
      .$type<SkillValidationStatus>()
      .notNull(),

    diagnostics: json("diagnostics")
      .$type<SkillDiagnostic[]>()
      .default(sql`(JSON_ARRAY())`)
      .notNull(),

    resources: json("resources").$type<SkillResources>().notNull(),

    resourcesTruncated: int("resources_truncated", { unsigned: true })
      .$type<ResourcesTruncatedFlag>()
      .default(0)
      .notNull(),

    nonStandardResourceCount: int("non_standard_resource_count", {
      unsigned: true,
    })
      .default(0)
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
    stateSlugUq: uniqueIndex("skill_index_entries_state_slug_uq").on(
      table.skillIndexStateId,
      table.slug
    ),
    stateValidationIdx: index("skill_index_entries_state_validation_idx").on(
      table.skillIndexStateId,
      table.validationStatus
    ),
  })
);

export type SkillIndexState = typeof skillIndexStates.$inferSelect;
export type InsertSkillIndexState = typeof skillIndexStates.$inferInsert;

export type SkillIndexEntry = typeof skillIndexEntries.$inferSelect;
export type InsertSkillIndexEntry = typeof skillIndexEntries.$inferInsert;
