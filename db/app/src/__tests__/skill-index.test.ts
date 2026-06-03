import type { SQL } from "drizzle-orm";
import { getTableConfig, MySqlDialect } from "drizzle-orm/mysql-core";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../client";
import type { SkillIndexEntry, SkillIndexState } from "../schema";
import { orgSkillIndexEntries as skillIndexEntries, orgSkillIndexStates as skillIndexStates } from "../schema";
import {
  acquireSkillIndexRefreshLock,
  createOrLoadSkillIndexState,
  getSkillIndexableSourceControlRepositoryCandidateById,
  getSkillIndexEntryBySlug,
  getSkillIndexStateBySourceControlRepositoryId,
  listSkillIndexableSourceControlRepositoryCandidates,
  listSkillIndexEntries,
  markSkillIndexKnownStale,
  markSkillIndexRefreshFailed,
  releaseSkillIndexRefreshLock,
  replaceSkillIndexEntries,
  SkillIndexRefreshLockLostError,
  updateSkillIndexRefCheck,
} from "../utils/skill-index";

describe("skill index schema", () => {
  it("defines state and entry tables with expected indexes", () => {
    const stateConfig = getTableConfig(skillIndexStates);
    const entryConfig = getTableConfig(skillIndexEntries);

    expect(stateConfig.name).toBe("lightfast_org_skill_index_states");
    expect(stateConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "source_control_repository_id",
        "indexed_commit_sha",
        "indexed_tree_sha",
        "last_refresh_status",
        "index_diagnostics",
        "refresh_lock_token",
        "refresh_locked_until",
      ])
    );
    expect(stateConfig.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "org_skill_index_states_source_control_repository_uq",
        "org_skill_index_states_last_checked_idx",
        "org_skill_index_states_refresh_locked_until_idx",
      ])
    );

    expect(entryConfig.name).toBe("lightfast_org_skill_index_entries");
    expect(entryConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "skill_index_state_id",
        "indexed_commit_sha",
        "slug",
        "metadata",
        "diagnostics",
        "resources",
        "resources_truncated",
        "validation_status",
      ])
    );
    expect(
      entryConfig.columns
        .filter((column) =>
          ["source_markdown", "body_markdown"].includes(column.name)
        )
        .map((column) => column.getSQLType())
    ).toEqual(["mediumtext", "mediumtext"]);
    expect(entryConfig.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "org_skill_index_entries_state_slug_uq",
        "org_skill_index_entries_state_validation_idx",
      ])
    );
  });
});

describe("skill index helpers", () => {
  it("creates or loads a state row by source-control repository id", async () => {
    const state = createState({ id: 12, sourceControlRepositoryId: 99 });
    const db = createSelectInsertDb({
      selectResults: [[], [state]],
    });

    await expect(
      createOrLoadSkillIndexState(db, { sourceControlRepositoryId: 99 })
    ).resolves.toBe(state);

    expect(db.insert).toHaveBeenCalledWith(skillIndexStates);
  });

  it("loads a state row by source-control repository id", async () => {
    const state = createState({ id: 13, sourceControlRepositoryId: 100 });
    const db = createSelectDb([[state]]);

    await expect(
      getSkillIndexStateBySourceControlRepositoryId(db, {
        sourceControlRepositoryId: 100,
      })
    ).resolves.toBe(state);
  });

  it("acquires refresh locks with a compare-and-set update", async () => {
    const where = vi.fn((_: SQL) => ({ affectedRows: 1 }));
    const set = vi.fn(() => ({ where }));
    const db = {
      update: vi.fn(() => ({ set })),
    } as unknown as Database;
    const now = new Date("2026-06-01T00:00:00.000Z");

    await expect(
      acquireSkillIndexRefreshLock(db, {
        lockToken: "token-1",
        now,
        stateId: 12,
        ttlSeconds: 30,
      })
    ).resolves.toBe(true);

    expect(set).toHaveBeenCalledWith({
      lastRefreshStatus: "refreshing",
      refreshLockedUntil: new Date("2026-06-01T00:00:30.000Z"),
      refreshLockToken: "token-1",
    });
    const query = renderSql(where.mock.calls[0]?.[0]);
    expect(query.sql).toContain("`id` = ?");
    expect(query.sql).toContain("`refresh_locked_until` is null");
    expect(query.sql).toContain("`refresh_locked_until` < ?");
    expect(query.params).toEqual(
      expect.arrayContaining([12, "2026-06-01 00:00:00.000"])
    );
  });

  it("releases refresh locks only by matching token", async () => {
    const where = vi.fn((_: SQL) => ({ affectedRows: 1 }));
    const set = vi.fn(() => ({ where }));
    const db = {
      update: vi.fn(() => ({ set })),
    } as unknown as Database;

    await expect(
      releaseSkillIndexRefreshLock(db, { lockToken: "token-1", stateId: 12 })
    ).resolves.toBe(1);

    expect(set).toHaveBeenCalledWith({
      refreshLockedUntil: null,
      refreshLockToken: null,
    });
    const query = renderSql(where.mock.calls[0]?.[0]);
    expect(query.sql).toContain("`id` = ?");
    expect(query.sql).toContain("`refresh_lock_token` = ?");
    expect(query.params).toEqual(expect.arrayContaining([12, "token-1"]));
  });

  it("replaces entries and updates indexed state metadata in a transaction", async () => {
    const deleteWhere = vi.fn(() => Promise.resolve({ affectedRows: 2 }));
    const insertValues = vi.fn(() => Promise.resolve());
    const updateWhere = vi.fn((_condition: SQL) =>
      Promise.resolve({ affectedRows: 1 })
    );
    const updateSet = vi.fn(() => ({ where: updateWhere }));
    const tx = {
      delete: vi.fn(() => ({ where: deleteWhere })),
      insert: vi.fn(() => ({ values: insertValues })),
      update: vi.fn(() => ({ set: updateSet })),
    };
    const db = {
      transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
        callback(tx)
      ),
    } as unknown as Database;
    const indexedAt = new Date("2026-06-01T00:01:00.000Z");

    await replaceSkillIndexEntries(db, {
      entries: [
        createEntryInput({ slug: "valid-skill", validationStatus: "valid" }),
        createEntryInput({
          slug: "invalid-skill",
          validationStatus: "invalid",
        }),
      ],
      indexDiagnostics: [
        { code: "warn", message: "Warn", severity: "warning" },
      ],
      indexedAt,
      indexedCommitSha: "commit-1",
      indexedTreeSha: "tree-1",
      lockToken: "token-1",
      stateId: 12,
    });

    expect(db.transaction).toHaveBeenCalledOnce();
    const query = renderSql(updateWhere.mock.calls[0]?.[0]);
    expect(query.sql).toContain("`id` = ?");
    expect(query.sql).toContain("`refresh_lock_token` = ?");
    expect(query.params).toEqual(expect.arrayContaining([12, "token-1"]));
    expect(tx.delete).toHaveBeenCalledWith(skillIndexEntries);
    expect(insertValues).toHaveBeenCalledWith([
      expect.objectContaining({ skillIndexStateId: 12, slug: "valid-skill" }),
      expect.objectContaining({ skillIndexStateId: 12, slug: "invalid-skill" }),
    ]);
    expect(updateSet).toHaveBeenCalledWith({
      indexDiagnostics: [
        { code: "warn", message: "Warn", severity: "warning" },
      ],
      indexedAt,
      indexedCommitSha: "commit-1",
      indexedTreeSha: "tree-1",
      invalidSkillCount: 1,
      lastRefreshErrorCode: null,
      lastRefreshErrorMessage: null,
      lastRefreshFailedAt: null,
      lastRefreshStatus: "fresh",
      skillCount: 2,
    });
  });

  it("does not delete or insert entries after losing the refresh lock", async () => {
    const deleteWhere = vi.fn(() => Promise.resolve({ affectedRows: 2 }));
    const insertValues = vi.fn(() => Promise.resolve());
    const updateWhere = vi.fn(() => Promise.resolve({ affectedRows: 0 }));
    const updateSet = vi.fn(() => ({ where: updateWhere }));
    const tx = {
      delete: vi.fn(() => ({ where: deleteWhere })),
      insert: vi.fn(() => ({ values: insertValues })),
      update: vi.fn(() => ({ set: updateSet })),
    };
    const db = {
      transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
        callback(tx)
      ),
    } as unknown as Database;

    await expect(
      replaceSkillIndexEntries(db, {
        entries: [createEntryInput()],
        indexDiagnostics: [],
        indexedAt: new Date("2026-06-01T00:01:00.000Z"),
        indexedCommitSha: "commit-1",
        indexedTreeSha: "tree-1",
        lockToken: "stale-token",
        stateId: 12,
      })
    ).rejects.toBeInstanceOf(SkillIndexRefreshLockLostError);

    expect(tx.delete).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("marks refresh failure metadata without deleting entries", async () => {
    const where = vi.fn((_: SQL) => ({ affectedRows: 1 }));
    const set = vi.fn(() => ({ where }));
    const db = {
      delete: vi.fn(),
      update: vi.fn(() => ({ set })),
    } as unknown as Database;
    const failedAt = new Date("2026-06-01T00:02:00.000Z");

    await markSkillIndexRefreshFailed(db, {
      errorCode: "github-error",
      errorMessage: "x".repeat(600),
      failedAt,
      lockToken: "token-1",
      stateId: 12,
    });

    expect(db.delete).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith({
      lastRefreshErrorCode: "github-error",
      lastRefreshErrorMessage: "x".repeat(512),
      lastRefreshFailedAt: failedAt,
      lastRefreshStatus: "failed",
    });
    const query = renderSql(where.mock.calls[0]?.[0]);
    expect(query.sql).toContain("`id` = ?");
    expect(query.sql).toContain("`refresh_lock_token` = ?");
    expect(query.params).toEqual(expect.arrayContaining([12, "token-1"]));
  });

  it("throws when marking refresh failure after losing the refresh lock", async () => {
    const where = vi.fn((_condition: SQL) => ({ affectedRows: 0 }));
    const set = vi.fn(() => ({ where }));
    const db = {
      update: vi.fn(() => ({ set })),
    } as unknown as Database;

    await expect(
      markSkillIndexRefreshFailed(db, {
        errorCode: "github-error",
        errorMessage: "lost",
        failedAt: new Date("2026-06-01T00:02:00.000Z"),
        lockToken: "stale-token",
        stateId: 12,
      })
    ).rejects.toBeInstanceOf(SkillIndexRefreshLockLostError);
  });

  it("updates ref check metadata by source-control repository id", async () => {
    const where = vi.fn(() => ({ affectedRows: 1 }));
    const set = vi.fn(() => ({ where }));
    const db = {
      update: vi.fn(() => ({ set })),
    } as unknown as Database;
    const checkedAt = new Date("2026-06-01T00:03:00.000Z");

    await updateSkillIndexRefCheck(db, {
      githubRefEtag: "etag-1",
      lastCheckedAt: checkedAt,
      lastCheckedCommitSha: "commit-2",
      sourceControlRepositoryId: 99,
    });

    expect(set).toHaveBeenCalledWith({
      githubRefEtag: "etag-1",
      lastCheckedAt: checkedAt,
      lastCheckedCommitSha: "commit-2",
    });
  });

  it("marks a repository skill index as stale", async () => {
    const where = vi.fn(() => ({ affectedRows: 1 }));
    const set = vi.fn(() => ({ where }));
    const db = {
      update: vi.fn(() => ({ set })),
    } as unknown as Database;

    await markSkillIndexKnownStale(db, { sourceControlRepositoryId: 99 });

    expect(set).toHaveBeenCalledWith({ lastRefreshStatus: "stale" });
  });

  it("lists invalid entries first and gets entries by slug", async () => {
    const invalid = createEntry({
      slug: "broken",
      validationStatus: "invalid",
    });
    const valid = createEntry({ slug: "working", validationStatus: "valid" });
    const listDb = createSelectDb([[invalid, valid]]);
    const getDb = createSelectDb([[valid]]);

    await expect(
      listSkillIndexEntries(listDb, { stateId: 12 })
    ).resolves.toEqual([invalid, valid]);
    await expect(
      getSkillIndexEntryBySlug(getDb, { slug: "working", stateId: 12 })
    ).resolves.toBe(valid);
  });

  it("builds the candidate query from active bindings and oldest checks first", async () => {
    const limit = vi.fn(() => Promise.resolve([]));
    const orderBy = vi.fn((..._expressions: SQL[]) => ({ limit }));
    const where = vi.fn((_condition: SQL) => ({ orderBy }));
    const leftJoin = vi.fn(() => ({ where }));
    const innerJoin = vi.fn(() => ({ leftJoin }));
    const from = vi.fn(() => ({ innerJoin }));
    const select = vi.fn((_selection: Record<string, unknown>) => ({ from }));
    const db = {
      select,
    } as unknown as Database;

    await listSkillIndexableSourceControlRepositoryCandidates(db, {
      clerkOrgId: "org_1",
      limit: 25,
    });

    const selection = select.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(selection).toBeDefined();
    expect(Object.keys(selection ?? {})).toEqual([
      "binding",
      "repository",
      "state",
    ]);
    const query = renderSql(where.mock.calls[0]?.[0]);
    expect(query.sql).toContain("`status` = ?");
    expect(query.sql).toContain("`clerk_org_id` = ?");
    expect(query.params).toEqual(expect.arrayContaining(["active", "org_1"]));
    expect(renderSql(orderBy.mock.calls[0]?.[0]).sql).toContain(
      "`last_checked_at` is null desc"
    );
    expect(limit).toHaveBeenCalledWith(25);
  });

  it("loads a skill-indexable candidate by exact repository id", async () => {
    const limit = vi.fn(() => Promise.resolve([]));
    const where = vi.fn((_condition: SQL) => ({ limit }));
    const leftJoin = vi.fn(() => ({ where }));
    const innerJoin = vi.fn(() => ({ leftJoin }));
    const from = vi.fn(() => ({ innerJoin }));
    const select = vi.fn((_selection: Record<string, unknown>) => ({ from }));
    const db = { select } as unknown as Database;

    await getSkillIndexableSourceControlRepositoryCandidateById(db, {
      clerkOrgId: "org_1",
      sourceControlRepositoryId: 99,
    });

    const query = renderSql(where.mock.calls[0]?.[0]);
    expect(query.sql).toContain("`id` = ?");
    expect(query.sql).toContain("`clerk_org_id` = ?");
    expect(query.sql).toContain("`status` = ?");
    expect(query.params).toEqual(
      expect.arrayContaining([99, "org_1", "active"])
    );
    expect(limit).toHaveBeenCalledWith(1);
  });
});

function createSelectDb(selectResults: unknown[][]): Database {
  const results = [...selectResults];
  return {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(results.shift() ?? []),
          orderBy: () => Promise.resolve(results.shift() ?? []),
        }),
        innerJoin: () => ({
          leftJoin: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve(results.shift() ?? []),
              }),
            }),
          }),
        }),
      }),
    })),
  } as unknown as Database;
}

function createSelectInsertDb(input: { selectResults: unknown[][] }): Database {
  const selectDb = createSelectDb(input.selectResults);
  return {
    ...selectDb,
    insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
  } as unknown as Database;
}

function createState(
  overrides: Partial<SkillIndexState> = {}
): SkillIndexState {
  const now = new Date("2026-06-01T00:00:00.000Z");
  return {
    createdAt: now,
    githubRefEtag: null,
    id: 1,
    indexedAt: null,
    indexedCommitSha: null,
    indexedTreeSha: null,
    indexDiagnostics: [],
    invalidSkillCount: 0,
    lastCheckedAt: null,
    lastCheckedCommitSha: null,
    lastRefreshErrorCode: null,
    lastRefreshErrorMessage: null,
    lastRefreshFailedAt: null,
    lastRefreshStatus: "never",
    refreshLockedUntil: null,
    refreshLockToken: null,
    skillCount: 0,
    sourceControlRepositoryId: 1,
    updatedAt: now,
    ...overrides,
  };
}

function createEntry(
  overrides: Partial<SkillIndexEntry> = {}
): SkillIndexEntry {
  const now = new Date("2026-06-01T00:00:00.000Z");
  return {
    allowedTools: null,
    bodyMarkdown: null,
    compatibility: null,
    contentSha: "content-1",
    contentSize: 100,
    createdAt: now,
    description: null,
    diagnostics: [],
    id: 1,
    indexedCommitSha: "commit-1",
    license: null,
    metadata: {},
    name: null,
    nonStandardResourceCount: 0,
    path: "skills/example/SKILL.md",
    resources: { assets: [], references: [], scripts: [], truncated: false },
    resourcesTruncated: 0,
    skillIndexStateId: 1,
    slug: "example",
    sourceMarkdown: null,
    updatedAt: now,
    validationStatus: "valid",
    ...overrides,
  };
}

function createEntryInput(
  overrides: Partial<
    Parameters<typeof replaceSkillIndexEntries>[1]["entries"][number]
  > = {}
): Parameters<typeof replaceSkillIndexEntries>[1]["entries"][number] {
  return {
    allowedTools: null,
    bodyMarkdown: null,
    compatibility: null,
    contentSha: "content-1",
    contentSize: 100,
    description: null,
    diagnostics: [],
    indexedCommitSha: "commit-1",
    license: null,
    metadata: {},
    name: null,
    nonStandardResourceCount: 0,
    path: "skills/example/SKILL.md",
    resources: { assets: [], references: [], scripts: [], truncated: false },
    resourcesTruncated: 0,
    slug: "example",
    sourceMarkdown: null,
    validationStatus: "valid",
    ...overrides,
  };
}

function renderSql(condition: unknown) {
  if (!condition) {
    throw new Error("expected SQL condition");
  }
  return new MySqlDialect().sqlToQuery(condition as SQL);
}
