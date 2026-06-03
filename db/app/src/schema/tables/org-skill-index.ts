import type {
  SkillDiagnostic,
  SkillIndexRefreshStatus,
  SkillResources,
  SkillValidationStatus,
} from "@repo/skills-contract";
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
const CODE_LENGTH = 64;

export type SkillIndexEntryMetadata = Record<
  string,
  string | number | boolean | null
>;
export type ResourcesTruncatedFlag = 0 | 1;

export const orgSkillIndexStates = mysqlTable(
  "lightfast_org_skill_index_states",
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

    skillCount: int("skill_count", { unsigned: true }).default(0).notNull(),

    invalidSkillCount: int("invalid_skill_count", { unsigned: true })
      .default(0)
      .notNull(),

    lastCheckedCommitSha: varchar("last_checked_commit_sha", {
      length: SHA_LENGTH,
    }),

    lastCheckedAt: datetime("last_checked_at", { mode: "date", fsp: 3 }),

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

    lastRefreshFailedAt: datetime("last_refresh_failed_at", {
      mode: "date",
      fsp: 3,
    }),

    indexDiagnostics: json("index_diagnostics")
      .$type<SkillDiagnostic[]>()
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
      "org_skill_index_states_source_control_repository_uq"
    ).on(table.sourceControlRepositoryId),
    lastCheckedIdx: index("org_skill_index_states_last_checked_idx").on(
      table.lastCheckedAt
    ),
    refreshLockedUntilIdx: index(
      "org_skill_index_states_refresh_locked_until_idx"
    ).on(table.refreshLockedUntil),
  })
);

export const orgSkillIndexEntries = mysqlTable(
  "lightfast_org_skill_index_entries",
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
    stateSlugUq: uniqueIndex("org_skill_index_entries_state_slug_uq").on(
      table.skillIndexStateId,
      table.slug
    ),
    stateValidationIdx: index("org_skill_index_entries_state_validation_idx").on(
      table.skillIndexStateId,
      table.validationStatus
    ),
  })
);

export type SkillIndexState = typeof orgSkillIndexStates.$inferSelect;
export type InsertSkillIndexState = typeof orgSkillIndexStates.$inferInsert;

export type SkillIndexEntry = typeof orgSkillIndexEntries.$inferSelect;
export type InsertSkillIndexEntry = typeof orgSkillIndexEntries.$inferInsert;
