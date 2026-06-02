import { IDENTITY_INDEX_MAX_CHARS_PER_FILE } from "@repo/identity-contract";
import { describe, expect, it, vi } from "vitest";

import {
  buildIdentityIndexFilesFromTree,
  refreshIdentityIndexSource,
} from "../services/identity";
import type { IdentityIndexServiceDeps } from "../services/identity/types";

const now = new Date("2026-06-01T00:00:00.000Z");

describe("buildIdentityIndexFilesFromTree", () => {
  it("builds exactly identity and soul file rows from root markdown files", () => {
    const result = buildIdentityIndexFilesFromTree({
      blobs: new Map([
        ["identity-sha", "# Acme\n\nWe build Lightfast."],
        ["soul-sha", "# Soul\n\nDirect and pragmatic."],
      ]),
      commitSha: "commit-main",
      tree: [
        identityFile("IDENTITY.md", "identity-sha", 28),
        identityFile("SOUL.md", "soul-sha", 29),
        identityFile("docs/IDENTITY.md", "nested-sha", 10),
      ],
    });

    expect(result.indexDiagnostics).toEqual([]);
    expect(result.files).toHaveLength(2);
    expect(result.files.map((file) => file.kind)).toEqual(["identity", "soul"]);
    expect(result.files[0]).toMatchObject({
      contentSha: "identity-sha",
      indexedCommitSha: "commit-main",
      path: "IDENTITY.md",
      sourceMarkdown: "# Acme\n\nWe build Lightfast.",
      status: "present",
    });
    expect(result.files[0]?.contentHash).toMatch(/^sha256:/);
    expect(result.files[1]).toMatchObject({
      path: "SOUL.md",
      status: "present",
    });
  });

  it("creates missing and too_large rows without markdown", () => {
    const result = buildIdentityIndexFilesFromTree({
      blobs: new Map(),
      commitSha: "commit-main",
      tree: [
        identityFile(
          "IDENTITY.md",
          "identity-sha",
          IDENTITY_INDEX_MAX_CHARS_PER_FILE + 1
        ),
      ],
    });

    expect(result.files).toEqual([
      expect.objectContaining({
        kind: "identity",
        path: "IDENTITY.md",
        sourceMarkdown: null,
        status: "too_large",
      }),
      expect.objectContaining({
        kind: "soul",
        path: "SOUL.md",
        sourceMarkdown: null,
        status: "missing",
      }),
    ]);
    expect(result.indexDiagnostics).toEqual([
      "IDENTITY.md exceeds the 20000 character indexing limit.",
      "SOUL.md is missing.",
    ]);
  });
});

describe("identity index refresh service", () => {
  it("refreshes root identity files and replaces one atomic two-row snapshot", async () => {
    const deps = createDeps({
      tree: [
        identityFile("IDENTITY.md", "identity-sha", 28),
        identityFile("skills/test/SKILL.md", "skill-sha", 10),
      ],
    });

    const result = await refreshIdentityIndexSource({
      deps,
      reason: "webhook",
      sourceControlRepositoryId: 1,
      targetCommitSha: "current-main",
    });

    expect(result.status).toBe("fresh");
    expect(deps.readIdentityRepositoryBlob).toHaveBeenCalledTimes(1);
    expect(deps.readIdentityRepositoryBlob).toHaveBeenCalledWith(
      expect.objectContaining({ sha: "identity-sha" })
    );
    expect(deps.replaceIdentityIndexFiles).toHaveBeenCalledWith(
      deps.db,
      expect.objectContaining({
        files: [
          expect.objectContaining({
            kind: "identity",
            path: "IDENTITY.md",
            status: "present",
          }),
          expect.objectContaining({
            kind: "soul",
            path: "SOUL.md",
            status: "missing",
          }),
        ],
        indexedCommitSha: "current-main",
        indexedTreeSha: "tree-sha",
        lockToken: "lock-token",
        stateId: 100,
      })
    );
    expect(deps.releaseIdentityIndexRefreshLock).toHaveBeenCalledWith(deps.db, {
      lockToken: "lock-token",
      stateId: 100,
    });
  });

  it("fails refreshes without replacing files when GitHub returns a truncated tree", async () => {
    const deps = createDeps({ treeTruncated: true });

    const result = await refreshIdentityIndexSource({
      deps,
      reason: "schedule",
      sourceControlRepositoryId: 1,
    });

    expect(result.status).toBe("failed");
    expect(deps.replaceIdentityIndexFiles).not.toHaveBeenCalled();
    expect(deps.markIdentityIndexRefreshFailed).toHaveBeenCalledWith(
      deps.db,
      expect.objectContaining({ errorCode: "github_tree_truncated" })
    );
  });

  it("skips a refresh job when its target commit is no longer current", async () => {
    const deps = createDeps({ refSha: "current-main" });

    const result = await refreshIdentityIndexSource({
      deps,
      reason: "webhook",
      sourceControlRepositoryId: 1,
      targetCommitSha: "stale-webhook-sha",
    });

    expect(result.status).toBe("stale");
    expect(deps.readIdentityRepositoryTree).not.toHaveBeenCalled();
    expect(deps.replaceIdentityIndexFiles).not.toHaveBeenCalled();
  });
});

function identityFile(path: string, sha: string, size: number) {
  return {
    mode: "100644",
    path,
    sha,
    size,
    type: "blob" as const,
  };
}

function createState(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: now,
    githubRefEtag: "etag-old",
    id: 100,
    indexDiagnostics: [],
    indexedAt: new Date("2026-05-31T00:00:00.000Z"),
    indexedCommitSha: "old-index",
    indexedTreeSha: "old-tree",
    lastCheckedAt: new Date("2026-05-31T00:00:00.000Z"),
    lastCheckedCommitSha: "new-main",
    lastRefreshErrorCode: null,
    lastRefreshErrorMessage: null,
    lastRefreshFailedAt: null,
    lastRefreshStatus: "stale",
    lastRefreshSucceededAt: new Date("2026-05-31T00:00:00.000Z"),
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

function createCandidate(state = createState()) {
  const repository = {
    createdAt: now,
    fullName: "acme/.lightfast",
    id: 1,
    orgSourceControlBindingId: 1,
    providerRepositoryId: "repo_1",
    updatedAt: now,
    watchedPathGlobs: ["skills/**", "IDENTITY.md", "SOUL.md"],
  };
  return {
    binding: {
      clerkOrgId: "org_123",
      connectedAt: now,
      connectedByUserId: "user_123",
      createdAt: now,
      id: 1,
      metadata: {
        lightfastRepository: {
          fullName: repository.fullName,
          id: repository.providerRepositoryId,
          installationId: "installation_1",
          name: ".lightfast",
          verifiedAt: "2026-05-31T00:00:00.000Z",
        },
      },
      provider: "github",
      providerAccountId: "account_1",
      providerAccountLogin: "acme",
      providerInstallationId: "installation_1",
      revokedAt: null,
      status: "active",
      updatedAt: now,
    },
    repository,
    state,
  };
}

function createDeps(
  input: {
    refSha?: string;
    tree?: ReturnType<typeof identityFile>[];
    treeTruncated?: boolean;
  } = {}
) {
  const state = createState();
  const deps = {
    acquireIdentityIndexRefreshLock: vi.fn(async () => true),
    createOrLoadIdentityIndexState: vi.fn(async () => state),
    db: { fake: true },
    getIdentityIndexRefreshCandidateById: vi.fn(async () =>
      createCandidate(state)
    ),
    getIdentityIndexStateBySourceControlRepositoryId: vi.fn(async () => state),
    listIdentityIndexFiles: vi.fn(async () => []),
    listIdentityIndexRefreshCandidates: vi.fn(async () => [
      createCandidate(state),
    ]),
    markIdentityIndexRefreshFailed: vi.fn(async () => undefined),
    now: vi.fn(() => now),
    randomToken: vi.fn(() => "lock-token"),
    readIdentityRepositoryBlob: vi.fn(async ({ sha }: { sha: string }) => ({
      sha,
      size: 28,
      text: sha === "soul-sha" ? "# Soul" : "# Acme\n\nWe build Lightfast.",
    })),
    readIdentityRepositoryMainRef: vi.fn(async () => ({
      etag: "etag-new",
      sha: input.refSha ?? "current-main",
      status: "found" as const,
    })),
    readIdentityRepositoryTree: vi.fn(async () => ({
      commit: { sha: input.refSha ?? "current-main", treeSha: "tree-sha" },
      tree: {
        sha: "tree-sha",
        tree: input.tree ?? [identityFile("IDENTITY.md", "identity-sha", 28)],
        truncated: input.treeTruncated,
      },
    })),
    releaseIdentityIndexRefreshLock: vi.fn(async () => 1),
    replaceIdentityIndexFiles: vi.fn(async () => undefined),
    updateIdentityIndexRefCheck: vi.fn(async () => 1),
  };

  return deps as typeof deps & IdentityIndexServiceDeps;
}
