import { SKILL_FILE_MAX_BYTES } from "@repo/skills-contract";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkSkillIndexSourceRef,
  ensureFreshSkillIndexForRead,
  findChangedSkillIndexSources,
  getSkillIndexSnapshot,
  reconcileSkillIndexSources,
  refreshSkillIndexSource,
  requestSkillIndexRefresh,
} from "../services/skills";
import { buildSkillIndexEntriesFromTree } from "../services/skills/build";
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
  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats a 304 ref as changed when the observed commit is not indexed", async () => {
    const deps = createDeps({
      targetState: staleState({
        githubRefEtag: "etag-current",
        indexedCommitSha: "old-index",
        lastCheckedCommitSha: "current-main",
      }),
    });
    deps.readSkillRepositoryMainRef.mockResolvedValueOnce({
      status: "not_modified",
    });

    await expect(
      checkSkillIndexSourceRef({ deps, sourceControlRepositoryId: 1 })
    ).resolves.toEqual({
      currentCommitSha: "current-main",
      status: "changed",
    });

    expect(deps.readSkillRepositoryMainRef).toHaveBeenCalledWith(
      expect.objectContaining({ etag: "etag-current" })
    );
  });

  it("skips a refresh job when its target commit is no longer current", async () => {
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

    expect(result.status).toBe("stale");
    expect(deps.readSkillRepositoryTree).not.toHaveBeenCalled();
    expect(deps.replaceSkillIndexEntries).not.toHaveBeenCalled();
  });

  it("refreshes when the target commit still matches current main", async () => {
    const deps = createDeps({
      refSha: "current-main",
      targetState: staleState({ indexedCommitSha: "old-index" }),
    });

    const result = await refreshSkillIndexSource({
      deps,
      reason: "webhook",
      sourceControlRepositoryId: 1,
      targetCommitSha: "current-main",
    });

    expect(result.status).toBe("fresh");
    expect(deps.readSkillRepositoryTree).toHaveBeenCalledWith(
      expect.objectContaining({ commitSha: "current-main" })
    );
  });

  it("publishes a skill index change after a successful refresh", async () => {
    const deps = createDeps({
      refSha: "current-main",
      targetState: staleState({ indexedCommitSha: "old-index" }),
    });
    deps.getSkillIndexStateBySourceControlRepositoryId.mockResolvedValueOnce(
      staleState({
        indexedCommitSha: "current-main",
        lastRefreshStatus: "fresh",
      })
    );

    await expect(
      refreshSkillIndexSource({
        deps,
        reason: "webhook",
        sourceControlRepositoryId: 1,
      })
    ).resolves.toEqual({ status: "fresh" });

    expect(deps.publishSkillIndexChanged).toHaveBeenCalledWith({
      clerkOrgId: "org_123",
      indexedCommitSha: "current-main",
      lastRefreshStatus: "fresh",
      snapshotVersion: expect.any(String),
      sourceControlRepositoryId: 1,
    });
  });

  it("publishes a skill index change after an unchanged refresh", async () => {
    const unchangedState = staleState({
      githubRefEtag: "etag-current",
      indexedCommitSha: "current-main",
      lastCheckedCommitSha: "current-main",
      lastRefreshStatus: "fresh",
    });
    const deps = createDeps({ targetState: unchangedState });
    deps.readSkillRepositoryMainRef.mockResolvedValueOnce({
      status: "not_modified",
    });

    await expect(
      refreshSkillIndexSource({
        deps,
        reason: "read",
        sourceControlRepositoryId: 1,
      })
    ).resolves.toEqual({ status: "fresh" });

    expect(deps.publishSkillIndexChanged).toHaveBeenCalledWith({
      clerkOrgId: "org_123",
      indexedCommitSha: "current-main",
      lastRefreshStatus: "fresh",
      snapshotVersion: `${unchangedState.id}:${unchangedState.updatedAt.getTime()}:current-main:fresh`,
      sourceControlRepositoryId: 1,
    });
  });

  it("does not fail an unchanged refresh when publishing fails", async () => {
    const deps = createDeps({
      targetState: staleState({
        githubRefEtag: "etag-current",
        indexedCommitSha: "current-main",
        lastCheckedCommitSha: "current-main",
        lastRefreshStatus: "fresh",
      }),
    });
    deps.readSkillRepositoryMainRef.mockResolvedValueOnce({
      status: "not_modified",
    });
    deps.publishSkillIndexChanged.mockRejectedValueOnce(
      new Error("publish failed")
    );

    await expect(
      refreshSkillIndexSource({
        deps,
        reason: "read",
        sourceControlRepositoryId: 1,
      })
    ).resolves.toEqual({ status: "fresh" });

    expect(deps.publishSkillIndexChanged).toHaveBeenCalled();
  });

  it("does not fail refresh when publishing a skill index change fails", async () => {
    const deps = createDeps({
      refSha: "current-main",
      targetState: staleState({ indexedCommitSha: "old-index" }),
    });
    deps.getSkillIndexStateBySourceControlRepositoryId.mockResolvedValueOnce(
      staleState({
        indexedCommitSha: "current-main",
        lastRefreshStatus: "fresh",
      })
    );
    deps.publishSkillIndexChanged.mockRejectedValueOnce(
      new Error("publish failed")
    );

    await expect(
      refreshSkillIndexSource({
        deps,
        reason: "webhook",
        sourceControlRepositoryId: 1,
      })
    ).resolves.toEqual({ status: "fresh" });

    expect(deps.replaceSkillIndexEntries).toHaveBeenCalled();
  });

  it("publishes failed refresh state without failing when publishing fails", async () => {
    const deps = createDeps({
      readTreeError: new Error("tree failed"),
      targetState: staleState({ indexedCommitSha: "old-index" }),
    });
    deps.getSkillIndexStateBySourceControlRepositoryId.mockResolvedValueOnce(
      staleState({
        indexedCommitSha: "old-index",
        lastRefreshStatus: "failed",
      })
    );
    deps.publishSkillIndexChanged.mockRejectedValueOnce(
      new Error("publish failed")
    );

    await expect(
      refreshSkillIndexSource({
        deps,
        reason: "webhook",
        sourceControlRepositoryId: 1,
      })
    ).resolves.toEqual({ status: "failed" });

    expect(deps.publishSkillIndexChanged).toHaveBeenCalledWith({
      clerkOrgId: "org_123",
      indexedCommitSha: "old-index",
      lastRefreshStatus: "failed",
      snapshotVersion: expect.any(String),
      sourceControlRepositoryId: 1,
    });
    expect(deps.replaceSkillIndexEntries).not.toHaveBeenCalled();
  });

  it("returns a database snapshot without checking GitHub", async () => {
    const skill = entry({ indexedCommitSha: "current-main", slug: "snapshot" });
    const deps = createDeps({
      targetEntries: [skill],
      targetState: staleState({
        id: 100,
        indexedCommitSha: "current-main",
        lastCheckedCommitSha: "current-main",
        lastRefreshStatus: "fresh",
        updatedAt: now,
      }),
    });

    const result = await getSkillIndexSnapshot({
      clerkOrgId: "org_123",
      deps,
      sourceControlRepositoryId: 1,
    });

    expect(result).toMatchObject({
      repositoryUrl: "https://github.com/acme/lightfast-skills",
      skills: [skill],
      snapshotVersion: `100:${now.getTime()}:current-main:fresh`,
      freshness: {
        indexedCommitSha: "current-main",
        status: "fresh",
      },
    });
    expect(deps.readSkillRepositoryMainRef).not.toHaveBeenCalled();
    expect(deps.readSkillRepositoryTree).not.toHaveBeenCalled();
    expect(deps.acquireSkillIndexRefreshLock).not.toHaveBeenCalled();
    expect(deps.sleep).not.toHaveBeenCalled();
  });

  it("returns unavailable immediately when no verified candidate exists", async () => {
    const deps = createDeps({
      candidate: null,
      targetState: staleState({ indexedCommitSha: "private-index" }),
    });

    const result = await getSkillIndexSnapshot({
      clerkOrgId: "org_123",
      deps,
      sourceControlRepositoryId: 1,
    });

    expect(result).toMatchObject({
      repositoryUrl: "",
      skills: [],
      snapshotVersion: null,
      freshness: {
        indexedCommitSha: null,
        status: "unavailable",
      },
    });
    expect(
      deps.getSkillIndexStateBySourceControlRepositoryId
    ).not.toHaveBeenCalled();
    expect(deps.readSkillRepositoryMainRef).not.toHaveBeenCalled();
  });

  it("uses exact slug lookup for snapshot detail reads", async () => {
    const skill = entry({ indexedCommitSha: "current-main", slug: "selected" });
    const deps = createDeps({
      targetEntries: [skill],
      targetState: staleState({
        indexedCommitSha: "current-main",
        lastRefreshStatus: "fresh",
      }),
    });

    const result = await getSkillIndexSnapshot({
      clerkOrgId: "org_123",
      deps,
      slug: "selected",
      sourceControlRepositoryId: 1,
    });

    expect(result.skills).toEqual([skill]);
    expect(deps.getSkillIndexEntryBySlug).toHaveBeenCalledWith(deps.db, {
      slug: "selected",
      stateId: 100,
    });
    expect(deps.listSkillIndexEntries).not.toHaveBeenCalled();
    expect(deps.readSkillRepositoryMainRef).not.toHaveBeenCalled();
  });

  it("reports stale snapshot freshness when a slug is missing from an indexed snapshot", async () => {
    const deps = createDeps({
      targetEntries: [],
      targetState: staleState({
        indexedCommitSha: "old-index",
        lastCheckedCommitSha: "new-main",
        lastRefreshStatus: "stale",
      }),
    });

    const result = await getSkillIndexSnapshot({
      clerkOrgId: "org_123",
      deps,
      slug: "missing",
      sourceControlRepositoryId: 1,
    });

    expect(result.skills).toEqual([]);
    expect(result.freshness).toMatchObject({
      indexedCommitSha: "old-index",
      status: "stale",
    });
    expect(deps.getSkillIndexEntryBySlug).toHaveBeenCalledWith(deps.db, {
      slug: "missing",
      stateId: 100,
    });
  });

  it("retries snapshot reads when state changes between entries and version check", async () => {
    const initialState = staleState({
      indexedCommitSha: "old-index",
      lastCheckedCommitSha: "new-main",
      lastRefreshStatus: "stale",
      updatedAt: now,
    });
    const latestUpdatedAt = new Date("2026-06-01T00:00:01.000Z");
    const latestState = staleState({
      indexedCommitSha: "current-main",
      lastCheckedCommitSha: "current-main",
      lastRefreshStatus: "fresh",
      updatedAt: latestUpdatedAt,
    });
    const oldSkill = entry({ indexedCommitSha: "old-index", slug: "old" });
    const latestSkill = entry({
      indexedCommitSha: "current-main",
      slug: "latest",
    });
    const deps = createDeps({
      candidate: createCandidate({ state: initialState }),
      targetState: latestState,
    });
    deps.listSkillIndexEntries
      .mockResolvedValueOnce([oldSkill])
      .mockResolvedValueOnce([latestSkill]);
    deps.getSkillIndexStateBySourceControlRepositoryId.mockResolvedValue(
      latestState
    );

    const result = await getSkillIndexSnapshot({
      clerkOrgId: "org_123",
      deps,
      sourceControlRepositoryId: 1,
    });

    expect(result).toMatchObject({
      skills: [latestSkill],
      snapshotVersion: `100:${latestUpdatedAt.getTime()}:current-main:fresh`,
      freshness: {
        indexedCommitSha: "current-main",
        status: "fresh",
      },
    });
    expect(deps.listSkillIndexEntries).toHaveBeenCalledTimes(2);
    expect(
      deps.getSkillIndexStateBySourceControlRepositoryId
    ).toHaveBeenCalledTimes(2);
    expect(
      deps.listSkillIndexEntries.mock.invocationCallOrder[0]
    ).toBeLessThan(
      deps.getSkillIndexStateBySourceControlRepositoryId.mock
        .invocationCallOrder[0] ?? 0
    );
    expect(
      deps.getSkillIndexStateBySourceControlRepositoryId.mock
        .invocationCallOrder[0]
    ).toBeLessThan(
      deps.listSkillIndexEntries.mock.invocationCallOrder[1] ?? 0
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

  it("attempts a 10s read refresh when no index state exists", async () => {
    vi.useFakeTimers();
    const createdState = staleState({
      githubRefEtag: null,
      indexedAt: null,
      indexedCommitSha: null,
      indexedTreeSha: null,
      lastCheckedAt: null,
      lastCheckedCommitSha: null,
    });
    const freshState = staleState({
      indexedAt: now,
      indexedCommitSha: "current-main",
      indexedTreeSha: "tree-sha",
      lastCheckedAt: now,
      lastCheckedCommitSha: "current-main",
      lastRefreshStatus: "fresh",
    });
    const deps = createDeps({
      createdState,
      targetEntries: [
        entry({ indexedCommitSha: "current-main", slug: "test-skill" }),
      ],
      targetState: null,
    });
    deps.getSkillIndexStateBySourceControlRepositoryId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(freshState)
      .mockResolvedValue(freshState);
    deps.readSkillRepositoryTree.mockImplementation(
      async (_input: { signal?: AbortSignal }) => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return {
          commit: { sha: "current-main", treeSha: "tree-sha" },
          tree: {
            sha: "tree-sha",
            tree: [skillFile("skills/test-skill/SKILL.md", "skill-sha", 60)],
            truncated: false,
          },
        };
      }
    );

    const pending = ensureFreshSkillIndexForRead({
      clerkOrgId: "org_123",
      deps,
      sourceControlRepositoryId: 1,
    });
    await vi.advanceTimersByTimeAsync(5000);
    const result = await pending;

    expect(deps.createOrLoadSkillIndexState).toHaveBeenCalled();
    expect(deps.replaceSkillIndexEntries).toHaveBeenCalled();
    expect(result.freshness.status).toBe("fresh");
    expect(result.skills).toHaveLength(1);
  });

  it("records refresh_timeout and releases the lock before returning", async () => {
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
    expect(deps.releaseSkillIndexRefreshLock).toHaveBeenCalledWith(
      deps.db,
      expect.objectContaining({ lockToken: "lock-token", stateId: 100 })
    );
    expect(
      deps.markSkillIndexRefreshFailed.mock.invocationCallOrder[0]
    ).toBeLessThan(
      deps.releaseSkillIndexRefreshLock.mock.invocationCallOrder[0] ?? 0
    );
  });

  it("does not continue in the background or replace entries after read timeout", async () => {
    vi.useFakeTimers();
    const deps = createDeps({
      targetEntries: [],
      targetState: staleState({ indexedAt: null, indexedCommitSha: null }),
    });
    deps.readSkillRepositoryBlob.mockImplementation(
      async ({ signal }: { signal?: AbortSignal }) => {
        await new Promise((_, reject) => {
          signal?.addEventListener("abort", () => {
            reject(
              new DOMException("This operation was aborted", "AbortError")
            );
          });
        });
        throw new Error("unreachable");
      }
    );

    const pending = ensureFreshSkillIndexForRead({
      clerkOrgId: "org_123",
      deps,
      sourceControlRepositoryId: 1,
    });
    await vi.advanceTimersByTimeAsync(10_000);
    await pending;
    await vi.runAllTimersAsync();

    expect(deps.replaceSkillIndexEntries).not.toHaveBeenCalled();
    expect(deps.releaseSkillIndexRefreshLock).toHaveBeenCalledTimes(1);
  });

  it("records refresh_timeout for wrapped abort errors", async () => {
    const deps = createDeps({
      readTreeError: Object.assign(new Error("GitHub request aborted"), {
        cause: new DOMException("This operation was aborted", "AbortError"),
      }),
      targetEntries: [],
      targetState: staleState({ indexedAt: null, indexedCommitSha: null }),
    });

    const result = await ensureFreshSkillIndexForRead({
      clerkOrgId: "org_123",
      deps,
      sourceControlRepositoryId: 1,
    });

    expect(result.freshness.status).toBe("unavailable");
    expect(deps.markSkillIndexRefreshFailed).toHaveBeenCalledWith(
      deps.db,
      expect.objectContaining({ errorCode: "refresh_timeout" })
    );
  });

  it("fails refreshes without replacing entries when GitHub returns a truncated tree", async () => {
    const deps = createDeps({
      targetEntries: [entry({ slug: "previous" })],
      targetState: staleState({ indexedCommitSha: "old-index" }),
      treeTruncated: true,
    });

    const result = await refreshSkillIndexSource({
      deps,
      reason: "webhook",
      sourceControlRepositoryId: 1,
    });

    expect(result.status).toBe("failed");
    expect(deps.replaceSkillIndexEntries).not.toHaveBeenCalled();
    expect(deps.markSkillIndexRefreshFailed).toHaveBeenCalledWith(
      deps.db,
      expect.objectContaining({ errorCode: "github_tree_truncated" })
    );
  });

  it("checks GitHub on every read before returning a previously fresh index", async () => {
    const deps = createDeps({
      targetEntries: [entry({ indexedCommitSha: "current-main" })],
      targetState: staleState({
        githubRefEtag: "etag-current",
        indexedCommitSha: "current-main",
        lastCheckedCommitSha: "current-main",
        lastRefreshStatus: "fresh",
      }),
    });
    deps.readSkillRepositoryMainRef.mockResolvedValueOnce({
      status: "not_modified",
    });

    const result = await ensureFreshSkillIndexForRead({
      clerkOrgId: "org_123",
      deps,
      sourceControlRepositoryId: 1,
    });

    expect(result.freshness.status).toBe("fresh");
    expect(deps.readSkillRepositoryMainRef).toHaveBeenCalledWith(
      expect.objectContaining({ etag: "etag-current" })
    );
    expect(deps.readSkillRepositoryTree).not.toHaveBeenCalled();
  });

  it("refreshes during read when GitHub moved past a previously fresh index", async () => {
    const checkedState = staleState({
      githubRefEtag: "etag-new",
      indexedCommitSha: "current-main",
      lastCheckedCommitSha: "new-main",
      lastRefreshStatus: "fresh",
    });
    const refreshedState = staleState({
      githubRefEtag: "etag-new",
      indexedAt: now,
      indexedCommitSha: "new-main",
      indexedTreeSha: "tree-sha",
      lastCheckedAt: now,
      lastCheckedCommitSha: "new-main",
      lastRefreshStatus: "fresh",
    });
    const deps = createDeps({
      refSha: "new-main",
      targetEntries: [entry({ indexedCommitSha: "new-main" })],
      targetState: staleState({
        githubRefEtag: "etag-current",
        indexedCommitSha: "current-main",
        lastCheckedCommitSha: "current-main",
        lastRefreshStatus: "fresh",
      }),
    });
    deps.getSkillIndexStateBySourceControlRepositoryId
      .mockResolvedValueOnce(checkedState)
      .mockResolvedValueOnce(refreshedState);

    const result = await ensureFreshSkillIndexForRead({
      clerkOrgId: "org_123",
      deps,
      sourceControlRepositoryId: 1,
    });

    expect(result.freshness.status).toBe("fresh");
    expect(deps.readSkillRepositoryMainRef).toHaveBeenCalledTimes(2);
    expect(deps.readSkillRepositoryTree).toHaveBeenCalledWith(
      expect.objectContaining({ commitSha: "new-main" })
    );
    expect(deps.replaceSkillIndexEntries).toHaveBeenCalledWith(
      deps.db,
      expect.objectContaining({ indexedCommitSha: "new-main" })
    );
  });

  it("reconcile scans candidates once and does not duplicate candidate lookups", async () => {
    const eligible = createCandidate({ id: 1 });
    const ineligible = createCandidate({
      id: 2,
      providerInstallationId: null,
    });
    const deps = createDeps({
      targetState: staleState({ indexedCommitSha: "old" }),
    });
    deps.listSkillIndexableSourceControlRepositoryCandidates.mockResolvedValueOnce(
      [eligible, ineligible]
    );
    deps.getSkillIndexableSourceControlRepositoryCandidateById.mockResolvedValue(
      eligible
    );
    deps.enqueueRefresh = vi.fn(async () => undefined);

    await expect(
      reconcileSkillIndexSources({ deps, limit: 1, totalLimit: 5 })
    ).resolves.toEqual({ checked: 1, queued: 1 });

    expect(
      deps.listSkillIndexableSourceControlRepositoryCandidates
    ).toHaveBeenCalledOnce();
    expect(
      deps.listSkillIndexableSourceControlRepositoryCandidates
    ).toHaveBeenCalledWith(deps.db, { limit: 5 });
    expect(deps.readSkillRepositoryMainRef).toHaveBeenCalledOnce();
    expect(deps.enqueueRefresh).toHaveBeenCalledOnce();
    expect(
      deps.getSkillIndexableSourceControlRepositoryCandidateById
    ).not.toHaveBeenCalled();
  });

  it("requests a refresh for a verified repository without running GitHub refresh inline", async () => {
    const deps = createDeps({
      targetState: staleState({ indexedCommitSha: "old-index" }),
    });
    deps.enqueueRefresh = vi.fn(async () => undefined);

    await expect(
      requestSkillIndexRefresh({
        clerkOrgId: "org_123",
        deps,
        reason: "read",
        sourceControlRepositoryId: 1,
      })
    ).resolves.toEqual({
      enqueued: true,
      sourceControlRepositoryId: 1,
    });

    expect(deps.enqueueRefresh).toHaveBeenCalledWith({
      reason: "read",
      sourceControlRepositoryId: 1,
      targetCommitSha: undefined,
    });
    expect(deps.readSkillRepositoryMainRef).not.toHaveBeenCalled();
    expect(deps.readSkillRepositoryTree).not.toHaveBeenCalled();
  });

  it("does not enqueue a refresh when repository access is not verified", async () => {
    const deps = createDeps({ candidate: null });
    deps.enqueueRefresh = vi.fn(async () => undefined);

    await expect(
      requestSkillIndexRefresh({
        clerkOrgId: "org_123",
        deps,
        reason: "read",
        sourceControlRepositoryId: 1,
      })
    ).resolves.toEqual({
      enqueued: false,
      sourceControlRepositoryId: 1,
    });

    expect(deps.enqueueRefresh).not.toHaveBeenCalled();
  });

  it("finds changed sources without enqueueing refresh events", async () => {
    const eligible = createCandidate({ id: 1 });
    const ineligible = createCandidate({
      id: 2,
      providerInstallationId: null,
    });
    const deps = createDeps({
      targetState: staleState({ indexedCommitSha: "old" }),
    });
    deps.listSkillIndexableSourceControlRepositoryCandidates.mockResolvedValueOnce(
      [eligible, ineligible]
    );
    deps.getSkillIndexableSourceControlRepositoryCandidateById.mockResolvedValue(
      eligible
    );
    deps.enqueueRefresh = vi.fn(async () => undefined);

    await expect(
      findChangedSkillIndexSources({ deps, limit: 1, totalLimit: 5 })
    ).resolves.toEqual({
      changed: [
        {
          sourceControlRepositoryId: 1,
          targetCommitSha: "current-main",
        },
      ],
      checked: 1,
    });

    expect(deps.enqueueRefresh).not.toHaveBeenCalled();
  });

  it("caps changed sources and queued refreshes to the reconcile limit", async () => {
    const first = createCandidate({ id: 1 });
    const second = createCandidate({ id: 2 });
    const deps = createDeps({
      targetState: staleState({ indexedCommitSha: "old" }),
    });
    deps.listSkillIndexableSourceControlRepositoryCandidates.mockResolvedValue([
      first,
      second,
    ]);
    deps.getSkillIndexableSourceControlRepositoryCandidateById.mockResolvedValue(
      first
    );
    deps.enqueueRefresh = vi.fn(async () => undefined);

    await expect(
      findChangedSkillIndexSources({ deps, limit: 1, totalLimit: 5 })
    ).resolves.toEqual({
      changed: [
        {
          sourceControlRepositoryId: 1,
          targetCommitSha: "current-main",
        },
      ],
      checked: 1,
    });

    expect(deps.readSkillRepositoryMainRef).toHaveBeenCalledOnce();

    deps.readSkillRepositoryMainRef.mockClear();
    await expect(
      reconcileSkillIndexSources({ deps, limit: 1, totalLimit: 5 })
    ).resolves.toEqual({ checked: 1, queued: 1 });

    expect(deps.readSkillRepositoryMainRef).toHaveBeenCalledOnce();
    expect(deps.enqueueRefresh).toHaveBeenCalledOnce();
    expect(deps.enqueueRefresh).toHaveBeenCalledWith({
      reason: "schedule",
      sourceControlRepositoryId: 1,
      targetCommitSha: "current-main",
    });
  });

  it("uses exact repository lookup instead of broad candidate scans for reads", async () => {
    const deps = createDeps({
      targetEntries: [entry({ indexedCommitSha: "current-main" })],
      targetState: staleState({
        githubRefEtag: "etag-current",
        indexedCommitSha: "current-main",
        lastCheckedCommitSha: "current-main",
        lastRefreshStatus: "fresh",
      }),
    });
    deps.readSkillRepositoryMainRef.mockResolvedValueOnce({
      status: "not_modified",
    });

    await ensureFreshSkillIndexForRead({
      clerkOrgId: "org_123",
      deps,
      sourceControlRepositoryId: 1,
    });

    expect(
      deps.getSkillIndexableSourceControlRepositoryCandidateById
    ).toHaveBeenCalledWith(deps.db, {
      clerkOrgId: "org_123",
      sourceControlRepositoryId: 1,
    });
    expect(
      deps.listSkillIndexableSourceControlRepositoryCandidates
    ).not.toHaveBeenCalled();
    expect(deps.readSkillRepositoryMainRef).toHaveBeenCalledWith(
      expect.objectContaining({ etag: "etag-current" })
    );
  });

  it("does not read index state before repository access is verified", async () => {
    const deps = createDeps({
      candidate: null,
      targetState: staleState({ indexedCommitSha: "private-index" }),
    });

    const result = await ensureFreshSkillIndexForRead({
      clerkOrgId: "org_123",
      deps,
      sourceControlRepositoryId: 1,
    });

    expect(result).toMatchObject({
      repositoryUrl: "",
      skills: [],
      freshness: {
        indexedCommitSha: null,
        status: "unavailable",
      },
    });
    expect(
      deps.getSkillIndexStateBySourceControlRepositoryId
    ).not.toHaveBeenCalled();
  });

  it("uses exact slug lookup instead of loading every entry for detail reads", async () => {
    const skill = entry({ indexedCommitSha: "current-main", slug: "selected" });
    const deps = createDeps({
      targetEntries: [skill],
      targetState: staleState({
        githubRefEtag: "etag-current",
        indexedCommitSha: "current-main",
        lastCheckedCommitSha: "current-main",
        lastRefreshStatus: "fresh",
      }),
    });
    deps.readSkillRepositoryMainRef.mockResolvedValueOnce({
      status: "not_modified",
    });

    const result = await ensureFreshSkillIndexForRead({
      clerkOrgId: "org_123",
      deps,
      slug: "selected",
      sourceControlRepositoryId: 1,
    });

    expect(result.skills).toEqual([skill]);
    expect(deps.getSkillIndexEntryBySlug).toHaveBeenCalledWith(deps.db, {
      slug: "selected",
      stateId: 100,
    });
    expect(deps.listSkillIndexEntries).not.toHaveBeenCalled();
  });

  it("reports zero queued refreshes when no enqueue function is configured", async () => {
    const eligible = createCandidate({ id: 1 });
    const deps = createDeps({
      targetState: staleState({ indexedCommitSha: "old" }),
    });
    deps.listSkillIndexableSourceControlRepositoryCandidates.mockResolvedValueOnce(
      [eligible]
    );
    deps.enqueueRefresh = undefined;

    await expect(
      reconcileSkillIndexSources({ deps, limit: 1, totalLimit: 5 })
    ).resolves.toEqual({ checked: 1, queued: 0 });
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

function createCandidate(
  overrides: {
    id?: number;
    providerInstallationId?: string | null;
    state?: FakeState | null;
  } = {}
) {
  const repository = {
    createdAt: now,
    fullName: "acme/lightfast-skills",
    id: overrides.id ?? 1,
    orgSourceControlBindingId: 1,
    providerRepositoryId: `repo_${overrides.id ?? 1}`,
    updatedAt: now,
    watchedPathGlobs: [],
  };
  const providerInstallationId =
    overrides.providerInstallationId === undefined
      ? "installation_1"
      : overrides.providerInstallationId;
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
          installationId: providerInstallationId ?? "installation_1",
          name: ".lightfast",
          verifiedAt: "2026-05-31T00:00:00.000Z",
        },
      },
      provider: "github",
      providerAccountId: "account_1",
      providerAccountLogin: "acme",
      providerInstallationId,
      revokedAt: null,
      status: "active",
      updatedAt: now,
    },
    repository,
    state: overrides.state === undefined ? staleState() : overrides.state,
  };
}

interface FakeState {
  createdAt: Date;
  githubRefEtag: string | null;
  id: number;
  indexDiagnostics: unknown[];
  indexedAt: Date | null;
  indexedCommitSha: string | null;
  indexedTreeSha: string | null;
  invalidSkillCount: number;
  lastCheckedAt: Date | null;
  lastCheckedCommitSha: string | null;
  lastRefreshErrorCode: string | null;
  lastRefreshErrorMessage: string | null;
  lastRefreshFailedAt: Date | null;
  lastRefreshStatus: string;
  refreshLockedUntil: Date | null;
  refreshLockToken: string | null;
  skillCount: number;
  sourceControlRepositoryId: number;
  updatedAt: Date;
}

function createDeps(
  input: {
    acquireLockResult?: boolean;
    createdState?: FakeState;
    readTreeError?: Error;
    candidate?: ReturnType<typeof createCandidate> | null;
    refSha?: string;
    targetEntries?: unknown[];
    targetState?: FakeState | null;
    treeTruncated?: boolean;
  } = {}
) {
  const state =
    input.targetState === undefined ? staleState() : input.targetState;
  const createdState = input.createdState ?? state ?? staleState();
  const candidate =
    input.candidate === undefined
      ? createCandidate({ state })
      : input.candidate;
  const deps = {
    acquireSkillIndexRefreshLock: vi.fn(
      async () => input.acquireLockResult ?? true
    ),
    createOrLoadSkillIndexState: vi.fn(async () => createdState),
    db: { fake: true },
    getSkillIndexStateBySourceControlRepositoryId: vi.fn(async () => state),
    getSkillIndexableSourceControlRepositoryCandidateById: vi.fn(
      async () => candidate
    ),
    getSkillIndexEntryBySlug: vi.fn(async () => {
      const targetEntry = input.targetEntries?.[0] ?? null;
      return targetEntry;
    }),
    listSkillIndexEntries: vi.fn(async () => input.targetEntries ?? []),
    listSkillIndexableSourceControlRepositoryCandidates: vi.fn(async () => [
      candidate,
    ]),
    markSkillIndexRefreshFailed: vi.fn(async () => undefined),
    now: vi.fn(() => now),
    publishSkillIndexChanged: vi.fn(async () => undefined),
    randomToken: vi.fn(() => "lock-token"),
    readSkillRepositoryBlob: vi.fn(
      async (_input: { signal?: AbortSignal }) => ({
        sha: "skill-sha",
        size: 60,
        text: "---\nname: test-skill\ndescription: Test skill\n---\nBody",
      })
    ),
    readSkillRepositoryMainRef: vi.fn(async () => ({
      etag: "etag-new",
      sha: input.refSha ?? "current-main",
      status: "found" as const,
    })) as SkillIndexServiceDeps["readSkillRepositoryMainRef"] &
      ReturnType<typeof vi.fn>,
    readSkillRepositoryTree: vi.fn(async (_input: { signal?: AbortSignal }) => {
      if (input.readTreeError) {
        throw input.readTreeError;
      }
      return {
        commit: { sha: input.refSha ?? "current-main", treeSha: "tree-sha" },
        tree: {
          sha: "tree-sha",
          tree: [skillFile("skills/test-skill/SKILL.md", "skill-sha", 60)],
          truncated: input.treeTruncated,
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
