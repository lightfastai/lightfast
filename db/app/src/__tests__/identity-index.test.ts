import type { SQL } from "drizzle-orm";
import { getTableConfig, MySqlDialect } from "drizzle-orm/mysql-core";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../client";
import type { IdentityIndexFile, IdentityIndexState } from "../schema";
import {
  orgIdentityIndexFiles as identityIndexFiles,
  orgIdentityIndexStates as identityIndexStates,
  orgSignals as signals,
} from "../schema";
import {
  acquireIdentityIndexRefreshLock,
  createOrLoadIdentityIndexState,
  getIdentityIndexRefreshCandidateById,
  getIdentityIndexStateBySourceControlRepositoryId,
  IdentityIndexRefreshLockLostError,
  listIdentityIndexFiles,
  listIdentityIndexRefreshCandidates,
  markIdentityIndexKnownStale,
  markIdentityIndexRefreshFailed,
  releaseIdentityIndexRefreshLock,
  replaceIdentityIndexFiles,
  updateIdentityIndexRefCheck,
} from "../utils/identity-index";

describe("identity index schema", () => {
  it("defines state and file tables plus signal classification metadata", () => {
    const stateConfig = getTableConfig(identityIndexStates);
    const fileConfig = getTableConfig(identityIndexFiles);
    const signalConfig = getTableConfig(signals);

    expect(stateConfig.name).toBe("lightfast_org_identity_index_states");
    expect(stateConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "source_control_repository_id",
        "indexed_commit_sha",
        "indexed_tree_sha",
        "indexed_at",
        "last_checked_commit_sha",
        "github_ref_etag",
        "last_refresh_status",
        "last_refresh_succeeded_at",
        "last_refresh_failed_at",
        "index_diagnostics",
        "present_file_count",
        "missing_file_count",
        "too_large_file_count",
        "read_error_file_count",
        "refresh_lock_token",
        "refresh_locked_until",
      ])
    );
    expect(stateConfig.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "org_identity_index_states_source_control_repository_uq",
        "org_identity_index_states_last_checked_idx",
        "org_identity_index_states_refresh_locked_until_idx",
      ])
    );

    expect(fileConfig.name).toBe("lightfast_org_identity_index_files");
    expect(fileConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "identity_index_state_id",
        "kind",
        "path",
        "status",
        "source_markdown",
        "content_hash",
        "content_sha",
        "content_size",
        "indexed_commit_sha",
        "diagnostics",
      ])
    );
    expect(
      fileConfig.columns
        .filter((column) => column.name === "source_markdown")
        .map((column) => column.getSQLType())
    ).toEqual(["mediumtext"]);
    expect(fileConfig.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "org_identity_index_files_state_kind_uq",
        "org_identity_index_files_state_status_idx",
      ])
    );
    expect(signalConfig.columns.map((column) => column.name)).toContain(
      "classification_metadata"
    );
  });
});

describe("identity index helpers", () => {
  it("creates or loads a state row by source-control repository id", async () => {
    const state = createState({ id: 12, sourceControlRepositoryId: 99 });
    const db = createSelectInsertDb({
      selectResults: [[], [state]],
    });

    await expect(
      createOrLoadIdentityIndexState(db, { sourceControlRepositoryId: 99 })
    ).resolves.toBe(state);

    expect(db.insert).toHaveBeenCalledWith(identityIndexStates);
  });

  it("loads a state row by source-control repository id", async () => {
    const state = createState({ id: 13, sourceControlRepositoryId: 100 });
    const db = createSelectDb([[state]]);

    await expect(
      getIdentityIndexStateBySourceControlRepositoryId(db, {
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
      acquireIdentityIndexRefreshLock(db, {
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
      releaseIdentityIndexRefreshLock(db, { lockToken: "token-1", stateId: 12 })
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

  it("replaces both semantic files and updates indexed state metadata in a transaction", async () => {
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

    await replaceIdentityIndexFiles(db, {
      files: [
        createFileInput({
          kind: "identity",
          path: "IDENTITY.md",
          status: "present",
        }),
        createFileInput({
          kind: "soul",
          path: "SOUL.md",
          status: "missing",
        }),
      ],
      indexDiagnostics: ["SOUL.md is missing"],
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
    expect(tx.delete).toHaveBeenCalledWith(identityIndexFiles);
    expect(insertValues).toHaveBeenCalledWith([
      expect.objectContaining({ identityIndexStateId: 12, kind: "identity" }),
      expect.objectContaining({ identityIndexStateId: 12, kind: "soul" }),
    ]);
    expect(updateSet).toHaveBeenCalledWith({
      indexDiagnostics: ["SOUL.md is missing"],
      indexedAt,
      indexedCommitSha: "commit-1",
      indexedTreeSha: "tree-1",
      lastRefreshErrorCode: null,
      lastRefreshErrorMessage: null,
      lastRefreshFailedAt: null,
      lastRefreshStatus: "fresh",
      lastRefreshSucceededAt: indexedAt,
      missingFileCount: 1,
      presentFileCount: 1,
      readErrorFileCount: 0,
      tooLargeFileCount: 0,
    });
  });

  it("does not delete or insert files after losing the refresh lock", async () => {
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
      replaceIdentityIndexFiles(db, {
        files: [createFileInput()],
        indexDiagnostics: [],
        indexedAt: new Date("2026-06-01T00:01:00.000Z"),
        indexedCommitSha: "commit-1",
        indexedTreeSha: "tree-1",
        lockToken: "stale-token",
        stateId: 12,
      })
    ).rejects.toBeInstanceOf(IdentityIndexRefreshLockLostError);

    expect(tx.delete).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("marks refresh failure metadata without deleting files", async () => {
    const where = vi.fn((_: SQL) => ({ affectedRows: 1 }));
    const set = vi.fn(() => ({ where }));
    const db = {
      delete: vi.fn(),
      update: vi.fn(() => ({ set })),
    } as unknown as Database;
    const failedAt = new Date("2026-06-01T00:02:00.000Z");

    await markIdentityIndexRefreshFailed(db, {
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

  it("updates ref check metadata by source-control repository id", async () => {
    const where = vi.fn(() => ({ affectedRows: 1 }));
    const set = vi.fn(() => ({ where }));
    const db = {
      update: vi.fn(() => ({ set })),
    } as unknown as Database;
    const checkedAt = new Date("2026-06-01T00:03:00.000Z");

    await updateIdentityIndexRefCheck(db, {
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

  it("marks a repository identity index as stale", async () => {
    const where = vi.fn(() => ({ affectedRows: 1 }));
    const set = vi.fn(() => ({ where }));
    const db = {
      update: vi.fn(() => ({ set })),
    } as unknown as Database;

    await markIdentityIndexKnownStale(db, { sourceControlRepositoryId: 99 });

    expect(set).toHaveBeenCalledWith({ lastRefreshStatus: "stale" });
  });

  it("lists files in semantic order", async () => {
    const identity = createFile({ kind: "identity", path: "IDENTITY.md" });
    const soul = createFile({ kind: "soul", path: "SOUL.md" });
    const db = createSelectDb([[identity, soul]]);

    await expect(listIdentityIndexFiles(db, { stateId: 12 })).resolves.toEqual([
      identity,
      soul,
    ]);
  });

  it("builds the refresh candidate query from active bindings and oldest checks first", async () => {
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

    await listIdentityIndexRefreshCandidates(db, {
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

  it("loads a refresh candidate by exact repository id", async () => {
    const limit = vi.fn(() => Promise.resolve([]));
    const where = vi.fn((_condition: SQL) => ({ limit }));
    const leftJoin = vi.fn(() => ({ where }));
    const innerJoin = vi.fn(() => ({ leftJoin }));
    const from = vi.fn(() => ({ innerJoin }));
    const select = vi.fn((_selection: Record<string, unknown>) => ({ from }));
    const db = { select } as unknown as Database;

    await getIdentityIndexRefreshCandidateById(db, {
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
  overrides: Partial<IdentityIndexState> = {}
): IdentityIndexState {
  const now = new Date("2026-06-01T00:00:00.000Z");
  return {
    createdAt: now,
    githubRefEtag: null,
    id: 1,
    indexedAt: null,
    indexedCommitSha: null,
    indexedTreeSha: null,
    indexDiagnostics: [],
    lastCheckedAt: null,
    lastCheckedCommitSha: null,
    lastRefreshErrorCode: null,
    lastRefreshErrorMessage: null,
    lastRefreshFailedAt: null,
    lastRefreshStatus: "never",
    lastRefreshSucceededAt: null,
    missingFileCount: 0,
    presentFileCount: 0,
    readErrorFileCount: 0,
    refreshLockedUntil: null,
    refreshLockToken: null,
    sourceControlRepositoryId: 1,
    tooLargeFileCount: 0,
    updatedAt: now,
    ...overrides,
  };
}

function createFile(
  overrides: Partial<IdentityIndexFile> = {}
): IdentityIndexFile {
  const now = new Date("2026-06-01T00:00:00.000Z");
  return {
    contentHash: "sha256:content-1",
    contentSha: "content-sha-1",
    contentSize: 100,
    createdAt: now,
    diagnostics: [],
    id: 1,
    identityIndexStateId: 1,
    indexedCommitSha: "commit-1",
    kind: "identity",
    path: "IDENTITY.md",
    sourceMarkdown: "# Acme",
    status: "present",
    updatedAt: now,
    ...overrides,
  };
}

function createFileInput(
  overrides: Partial<
    Parameters<typeof replaceIdentityIndexFiles>[1]["files"][number]
  > = {}
): Parameters<typeof replaceIdentityIndexFiles>[1]["files"][number] {
  return {
    contentHash: "sha256:content-1",
    contentSha: "content-sha-1",
    contentSize: 100,
    diagnostics: [],
    indexedCommitSha: "commit-1",
    kind: "identity",
    path: "IDENTITY.md",
    sourceMarkdown: "# Acme",
    status: "present",
    ...overrides,
  };
}

function renderSql(condition: unknown) {
  if (!condition) {
    throw new Error("expected SQL condition");
  }
  return new MySqlDialect().sqlToQuery(condition as SQL);
}
