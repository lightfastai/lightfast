import { describe, expect, it, vi } from "vitest";

import { SKILL_FILE_MAX_BYTES } from "@repo/skills-contract";

import { buildSkillIndexEntriesFromTree } from "../services/skills/build";
import {
  ensureFreshSkillIndexForRead,
  refreshSkillIndexSource,
} from "../services/skills";
import type { SkillIndexServiceDeps } from "../services/skills/types";

const now = new Date("2026-06-01T00:00:00.000Z");

describe("buildSkillIndexEntriesFromTree", () => {
  it("builds valid and invalid entries from canonical skill files", () => {
    const result = buildSkillIndexEntriesFromTree({
      blobs: new Map([
        [
          "valid-sha",
          "---\nname: valid-skill\ndescription: A valid skill\n---\nRun it.",
        ],
        ["invalid-sha", "missing frontmatter"],
      ]),
      commitSha: "commit-main",
      stateId: 10,
      tree: [
        skillFile("skills/invalid-skill/SKILL.md", "invalid-sha", 19),
        skillFile("skills/valid-skill/SKILL.md", "valid-sha", 64),
      ],
    });

    expect(result.entries).toHaveLength(2);
    expect(result.entries.map((entry) => entry.slug)).toEqual([
      "invalid-skill",
      "valid-skill",
    ]);
    expect(result.entries[0]?.validationStatus).toBe("invalid");
    expect(result.entries[1]).toMatchObject({
      indexedCommitSha: "commit-main",
      name: "valid-skill",
      validationStatus: "valid",
    });
  });

  it("preserves resources and non-standard resource counts", () => {
    const result = buildSkillIndexEntriesFromTree({
      blobs: new Map([
        [
          "skill-sha",
          "---\nname: resource-skill\ndescription: Has resources\n---\nBody",
        ],
      ]),
      commitSha: "commit-main",
      stateId: 10,
      tree: [
        skillFile("skills/resource-skill/SKILL.md", "skill-sha", 60),
        skillFile("skills/resource-skill/assets/logo.png", "asset-sha", 10),
        skillFile("skills/resource-skill/references/guide.md", "ref-sha", 10),
        skillFile("skills/resource-skill/notes.txt", "extra-sha", 10),
      ],
    });

    expect(result.entries[0]).toMatchObject({
      nonStandardResourceCount: 1,
      resources: {
        assets: ["skills/resource-skill/assets/logo.png"],
        references: ["skills/resource-skill/references/guide.md"],
        scripts: [],
        truncated: false,
      },
      resourcesTruncated: 0,
    });
  });

  it("does not require blob text for oversized skill files", () => {
    const result = buildSkillIndexEntriesFromTree({
      blobs: new Map(),
      commitSha: "commit-main",
      stateId: 10,
      tree: [
        skillFile(
          "skills/oversized-skill/SKILL.md",
          "large-sha",
          SKILL_FILE_MAX_BYTES + 1
        ),
      ],
    });

    expect(result.entries[0]).toMatchObject({
      contentSha: "large-sha",
      sourceMarkdown: null,
      validationStatus: "invalid",
    });
  });
});

describe("skills index refresh/read service", () => {
  it("refreshes current main instead of the stale target commit", async () => {
    const deps = createDeps({
      refSha: "current-main",
      targetState: staleState({ indexedCommitSha: "old-index" }),
    });

    const result = await refreshSkillIndexSource({
      deps,
      reason: "webhook",
      sourceControlRepositoryId: 1,
      targetCommitSha: "stale-webhook-sha",
    });

    expect(result.status).toBe("fresh");
    expect(deps.readSkillRepositoryTree).toHaveBeenCalledWith(
      expect.objectContaining({ commitSha: "current-main" })
    );
    expect(deps.replaceSkillIndexEntries).toHaveBeenCalledWith(
      deps.db,
      expect.objectContaining({ indexedCommitSha: "current-main" })
    );
  });

  it("returns stale read data when refresh fails but previous entries exist", async () => {
    const deps = createDeps({
      readTreeError: new Error("tree failed"),
      targetEntries: [entry({ slug: "previous" })],
      targetState: staleState({
        indexedAt: new Date("2026-05-30T00:00:00.000Z"),
        indexedCommitSha: "old-index",
        lastCheckedCommitSha: "new-main",
      }),
    });

    const result = await ensureFreshSkillIndexForRead({
      clerkOrgId: "org_123",
      deps,
      sourceControlRepositoryId: 1,
    });

    expect(result.freshness.status).toBe("stale");
    expect(result.skills).toHaveLength(1);
    expect(deps.markSkillIndexRefreshFailed).toHaveBeenCalledWith(
      deps.db,
      expect.objectContaining({ errorCode: "refresh_failed" })
    );
  });

  it("falls back to refreshing state on read lock contention", async () => {
    const deps = createDeps({
      acquireLockResult: false,
      targetEntries: [entry({ slug: "previous" })],
      targetState: staleState({ lastRefreshStatus: "refreshing" }),
    });

    const result = await ensureFreshSkillIndexForRead({
      clerkOrgId: "org_123",
      deps,
      sourceControlRepositoryId: 1,
    });

    expect(result.freshness.status).toBe("refreshing");
    expect(deps.sleep).toHaveBeenCalledWith(500);
    expect(deps.readSkillRepositoryTree).not.toHaveBeenCalled();
  });

  it("records refresh_timeout when a read refresh exceeds the budget", async () => {
    vi.useFakeTimers();
    const deps = createDeps({
      targetEntries: [],
      targetState: staleState({ indexedAt: null, indexedCommitSha: null }),
    });
    deps.readSkillRepositoryTree.mockImplementation(async ({ signal }) => {
      await new Promise((_, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new DOMException("This operation was aborted", "AbortError"));
        });
      });
      throw new Error("unreachable");
    });

    const pending = ensureFreshSkillIndexForRead({
      clerkOrgId: "org_123",
      deps,
      sourceControlRepositoryId: 1,
    });
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await pending;

    expect(result.freshness.status).toBe("unavailable");
    expect(deps.markSkillIndexRefreshFailed).toHaveBeenCalledWith(
      deps.db,
      expect.objectContaining({ errorCode: "refresh_timeout" })
    );
    vi.useRealTimers();
  });
});

function skillFile(path: string, sha: string, size: number) {
  return {
    mode: "100644",
    path,
    sha,
    size,
    type: "blob" as const,
  };
}

function staleState(overrides: Partial<FakeState> = {}): FakeState {
  return {
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
    lastRefreshStatus: "stale",
    refreshLockedUntil: null,
    refreshLockToken: null,
    sourceControlRepositoryId: 1,
    createdAt: now,
    invalidSkillCount: 0,
    lastRefreshFailedAt: null,
    skillCount: 0,
    updatedAt: now,
    ...overrides,
  };
}

function entry(overrides: Record<string, unknown> = {}) {
  return {
    bodyMarkdown: "Body",
    compatibility: null,
    contentSha: "content-sha",
    contentSize: 10,
    createdAt: now,
    description: "Previous",
    diagnostics: [],
    id: 1,
    indexedCommitSha: "old-index",
    license: null,
    metadata: {},
    name: "previous",
    nonStandardResourceCount: 0,
    path: "skills/previous/SKILL.md",
    resources: { assets: [], references: [], scripts: [], truncated: false },
    resourcesTruncated: 0,
    skillIndexStateId: 100,
    slug: "previous",
    sourceMarkdown: "---\nname: previous\ndescription: Previous\n---\nBody",
    updatedAt: now,
    validationStatus: "valid",
    ...overrides,
  };
}

type FakeState = {
  githubRefEtag: string | null;
  id: number;
  indexDiagnostics: unknown[];
  indexedAt: Date | null;
  indexedCommitSha: string | null;
  indexedTreeSha: string | null;
  lastCheckedAt: Date | null;
  lastCheckedCommitSha: string | null;
  lastRefreshErrorCode: string | null;
  lastRefreshErrorMessage: string | null;
  lastRefreshFailedAt: Date | null;
  lastRefreshStatus: string;
  refreshLockedUntil: Date | null;
  refreshLockToken: string | null;
  sourceControlRepositoryId: number;
  createdAt: Date;
  invalidSkillCount: number;
  skillCount: number;
  updatedAt: Date;
};

function createDeps(input: {
  acquireLockResult?: boolean;
  readTreeError?: Error;
  refSha?: string;
  targetEntries?: unknown[];
  targetState?: FakeState;
} = {}) {
  const state = input.targetState ?? staleState();
  const repository = {
    fullName: "acme/lightfast-skills",
    id: 1,
    providerRepositoryId: "repo_1",
  };
  const binding = {
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
    providerAccountLogin: "acme",
    providerInstallationId: "installation_1",
    status: "active",
  };
  const deps = {
    acquireSkillIndexRefreshLock: vi.fn(async () => input.acquireLockResult ?? true),
    createOrLoadSkillIndexState: vi.fn(async () => state),
    db: { fake: true },
    getSkillIndexStateBySourceControlRepositoryId: vi.fn(async () => state),
    listSkillIndexEntries: vi.fn(async () => input.targetEntries ?? []),
    listSkillIndexableSourceControlRepositoryCandidates: vi.fn(async () => [
      { binding, repository, state },
    ]),
    markSkillIndexRefreshFailed: vi.fn(async () => undefined),
    now: vi.fn(() => now),
    randomToken: vi.fn(() => "lock-token"),
    readSkillRepositoryBlob: vi.fn(async () => ({
      sha: "skill-sha",
      size: 60,
      text: "---\nname: test-skill\ndescription: Test skill\n---\nBody",
    })),
    readSkillRepositoryMainRef: vi.fn(async () => ({
      etag: "etag-new",
      sha: input.refSha ?? "current-main",
      status: "found" as const,
    })),
    readSkillRepositoryTree: vi.fn(async (_input: { signal?: AbortSignal }) => {
      if (input.readTreeError) {
        throw input.readTreeError;
      }
      return {
        commit: { sha: input.refSha ?? "current-main", treeSha: "tree-sha" },
        tree: {
          sha: "tree-sha",
          tree: [skillFile("skills/test-skill/SKILL.md", "skill-sha", 60)],
        },
      };
    }),
    releaseSkillIndexRefreshLock: vi.fn(async () => 1),
    replaceSkillIndexEntries: vi.fn(async () => undefined),
    sleep: vi.fn(async () => undefined),
    updateSkillIndexRefCheck: vi.fn(async () => 1),
  };

  return deps as typeof deps & SkillIndexServiceDeps;
}
