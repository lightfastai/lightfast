import type { SkillIndexableSourceControlRepositoryCandidate } from "@db/app";
import { SKILL_FILE_MAX_BYTES } from "@repo/skills-contract";
import { log } from "@vendor/observability/log/next";

import { buildSkillIndexEntriesFromTree } from "./build";
import { resolveSkillIndexServiceDeps } from "./deps";
import { getVerifiedCandidateByRepositoryId } from "./repository";
import type { SkillIndexChangedEvent, SkillIndexServiceDeps } from "./types";

const LOCK_TTL_SECONDS = 60;

class SkillIndexTreeTruncatedError extends Error {
  constructor() {
    super(
      "GitHub tree response was truncated, so the skill index was not replaced."
    );
    this.name = "SkillIndexTreeTruncatedError";
  }
}

export async function checkSkillIndexSourceRef(input: {
  deps?: SkillIndexServiceDeps;
  sourceControlRepositoryId: number;
}): Promise<{
  currentCommitSha: string | null;
  status: "changed" | "missing" | "unchanged";
}> {
  const deps = resolveSkillIndexServiceDeps(input.deps);
  const candidate = await getVerifiedCandidateByRepositoryId(deps, {
    sourceControlRepositoryId: input.sourceControlRepositoryId,
  });
  if (!candidate?.binding.providerInstallationId) {
    return { currentCommitSha: null, status: "missing" };
  }

  return await checkSkillIndexCandidateRef({
    candidate,
    deps,
    sourceControlRepositoryId: input.sourceControlRepositoryId,
  });
}

export async function checkSkillIndexCandidateRef(input: {
  candidate: SkillIndexableSourceControlRepositoryCandidate;
  deps: SkillIndexServiceDeps;
  sourceControlRepositoryId: number;
}): Promise<{
  currentCommitSha: string | null;
  status: "changed" | "missing" | "unchanged";
}> {
  if (!input.candidate.binding.providerInstallationId) {
    return { currentCommitSha: null, status: "missing" };
  }

  const state =
    input.candidate.state ??
    (await input.deps.getSkillIndexStateBySourceControlRepositoryId(
      input.deps.db,
      {
        sourceControlRepositoryId: input.sourceControlRepositoryId,
      }
    ));
  const etag =
    state?.githubRefEtag && state.lastCheckedCommitSha
      ? state.githubRefEtag
      : null;
  const ref = await input.deps.readSkillRepositoryMainRef({
    etag,
    fullName: input.candidate.repository.fullName,
    installationId: input.candidate.binding.providerInstallationId,
  });
  const checkedAt = input.deps.now();

  if (ref.status === "not_modified") {
    await input.deps.updateSkillIndexRefCheck(input.deps.db, {
      githubRefEtag: state?.githubRefEtag ?? null,
      lastCheckedAt: checkedAt,
      lastCheckedCommitSha: state?.lastCheckedCommitSha ?? null,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    });
    return {
      currentCommitSha: state?.lastCheckedCommitSha ?? null,
      status:
        state?.lastCheckedCommitSha &&
        state.indexedCommitSha !== state.lastCheckedCommitSha
          ? "changed"
          : "unchanged",
    };
  }

  if (ref.status === "missing") {
    await input.deps.updateSkillIndexRefCheck(input.deps.db, {
      githubRefEtag: null,
      lastCheckedAt: checkedAt,
      lastCheckedCommitSha: null,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    });
    return { currentCommitSha: null, status: "missing" };
  }

  await input.deps.updateSkillIndexRefCheck(input.deps.db, {
    githubRefEtag: ref.etag,
    lastCheckedAt: checkedAt,
    lastCheckedCommitSha: ref.sha,
    sourceControlRepositoryId: input.sourceControlRepositoryId,
  });
  return {
    currentCommitSha: ref.sha,
    status: state?.indexedCommitSha === ref.sha ? "unchanged" : "changed",
  };
}

export async function refreshSkillIndexSource(input: {
  deps?: SkillIndexServiceDeps;
  reason: "read" | "schedule" | "setup" | "webhook";
  sourceControlRepositoryId: number;
  signal?: AbortSignal;
  targetCommitSha?: string;
}): Promise<{ status: "failed" | "fresh" | "missing" | "stale" }> {
  const deps = resolveSkillIndexServiceDeps(input.deps);
  const state = await deps.createOrLoadSkillIndexState(deps.db, {
    sourceControlRepositoryId: input.sourceControlRepositoryId,
  });
  const candidate = await getVerifiedCandidateByRepositoryId(deps, {
    sourceControlRepositoryId: input.sourceControlRepositoryId,
  });
  if (!candidate?.binding.providerInstallationId) {
    return { status: "missing" };
  }

  const lockToken = deps.randomToken();
  const lockAcquired = await deps.acquireSkillIndexRefreshLock(deps.db, {
    lockToken,
    now: deps.now(),
    stateId: state.id,
    ttlSeconds: LOCK_TTL_SECONDS,
  });
  if (!lockAcquired) {
    return { status: "stale" };
  }

  let publishAfterRelease:
    | { clerkOrgId: string; sourceControlRepositoryId: number }
    | undefined;
  const queueTerminalPublish = () => {
    publishAfterRelease = {
      clerkOrgId: candidate.binding.clerkOrgId,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    };
  };

  try {
    input.signal?.throwIfAborted();
    const ref = await deps.readSkillRepositoryMainRef({
      fullName: candidate.repository.fullName,
      installationId: candidate.binding.providerInstallationId,
      signal: input.signal,
    });
    input.signal?.throwIfAborted();
    const checkedAt = deps.now();
    if (ref.status === "not_modified") {
      await deps.updateSkillIndexRefCheck(deps.db, {
        githubRefEtag: state.githubRefEtag,
        lastCheckedAt: checkedAt,
        lastCheckedCommitSha: state.lastCheckedCommitSha,
        sourceControlRepositoryId: input.sourceControlRepositoryId,
      });
      if (
        input.targetCommitSha &&
        state.lastCheckedCommitSha !== input.targetCommitSha
      ) {
        await markStaleTargetRefreshTerminal({
          currentCommitSha: state.lastCheckedCommitSha,
          deps,
          lockToken,
          state,
        });
        queueTerminalPublish();
        return { status: "stale" };
      }
      await deps.markSkillIndexRefreshFresh(deps.db, {
        lockToken,
        stateId: state.id,
      });
      queueTerminalPublish();
      return { status: "fresh" };
    }
    if (ref.status === "missing") {
      await deps.updateSkillIndexRefCheck(deps.db, {
        githubRefEtag: null,
        lastCheckedAt: checkedAt,
        lastCheckedCommitSha: null,
        sourceControlRepositoryId: input.sourceControlRepositoryId,
      });
      await deps.markSkillIndexRefreshFailed(deps.db, {
        errorCode: "github_ref_missing",
        errorMessage: "GitHub main branch was not found.",
        failedAt: checkedAt,
        lockToken,
        stateId: state.id,
      });
      queueTerminalPublish();
      return { status: "missing" };
    }

    await deps.updateSkillIndexRefCheck(deps.db, {
      githubRefEtag: ref.etag,
      lastCheckedAt: checkedAt,
      lastCheckedCommitSha: ref.sha,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    });
    if (input.targetCommitSha && ref.sha !== input.targetCommitSha) {
      await markStaleTargetRefreshTerminal({
        currentCommitSha: ref.sha,
        deps,
        lockToken,
        state,
      });
      queueTerminalPublish();
      return { status: "stale" };
    }

    const { commit, tree } = await deps.readSkillRepositoryTree({
      commitSha: ref.sha,
      fullName: candidate.repository.fullName,
      installationId: candidate.binding.providerInstallationId,
      signal: input.signal,
    });
    input.signal?.throwIfAborted();
    if (tree.truncated) {
      throw new SkillIndexTreeTruncatedError();
    }
    const blobs = await readSkillBlobs({
      commitTree: tree.tree,
      deps,
      fullName: candidate.repository.fullName,
      installationId: candidate.binding.providerInstallationId,
      signal: input.signal,
    });
    input.signal?.throwIfAborted();
    const built = buildSkillIndexEntriesFromTree({
      blobs,
      commitSha: commit.sha,
      stateId: state.id,
      tree: tree.tree,
    });
    await deps.replaceSkillIndexEntries(deps.db, {
      entries: built.entries,
      indexDiagnostics: built.indexDiagnostics,
      indexedAt: deps.now(),
      indexedCommitSha: commit.sha,
      indexedTreeSha: tree.sha,
      lockToken,
      stateId: state.id,
    });
    queueTerminalPublish();
    return { status: "fresh" };
  } catch (error) {
    const code = getRefreshFailureCode(error);
    await deps.markSkillIndexRefreshFailed(deps.db, {
      errorCode: code,
      errorMessage: error instanceof Error ? error.message : "Refresh failed.",
      failedAt: deps.now(),
      lockToken,
      stateId: state.id,
    });
    queueTerminalPublish();
    return { status: "failed" };
  } finally {
    await deps.releaseSkillIndexRefreshLock(deps.db, {
      lockToken,
      stateId: state.id,
    });
    if (publishAfterRelease) {
      await publishCurrentSkillIndexState({
        clerkOrgId: publishAfterRelease.clerkOrgId,
        deps,
        sourceControlRepositoryId: publishAfterRelease.sourceControlRepositoryId,
      });
    }
  }
}

async function markStaleTargetRefreshTerminal(input: {
  currentCommitSha: string | null;
  deps: SkillIndexServiceDeps;
  lockToken: string;
  state: { id: number; indexedCommitSha: string | null };
}) {
  if (
    input.currentCommitSha &&
    input.state.indexedCommitSha === input.currentCommitSha
  ) {
    await input.deps.markSkillIndexRefreshFresh(input.deps.db, {
      lockToken: input.lockToken,
      stateId: input.state.id,
    });
    return;
  }

  await input.deps.markSkillIndexRefreshStale(input.deps.db, {
    lockToken: input.lockToken,
    stateId: input.state.id,
  });
}

async function publishCurrentSkillIndexState(input: {
  clerkOrgId: string;
  deps: SkillIndexServiceDeps;
  sourceControlRepositoryId: number;
}) {
  let event: SkillIndexChangedEvent | undefined;
  try {
    const state =
      await input.deps.getSkillIndexStateBySourceControlRepositoryId(
        input.deps.db,
        {
          sourceControlRepositoryId: input.sourceControlRepositoryId,
        }
      );
    if (!state) {
      return;
    }
    event = {
      clerkOrgId: input.clerkOrgId,
      indexedCommitSha: state.indexedCommitSha,
      lastRefreshStatus: state.lastRefreshStatus,
      snapshotVersion: [
        state.id,
        state.updatedAt.getTime(),
        state.indexedCommitSha ?? "",
        state.lastRefreshStatus,
      ].join(":"),
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    };
    await input.deps.publishSkillIndexChanged(event);
  } catch (error) {
    log.warn("[skills] skill index change publish failed", {
      clerkOrgId: input.clerkOrgId,
      error,
      indexedCommitSha: event?.indexedCommitSha,
      lastRefreshStatus: event?.lastRefreshStatus,
      snapshotVersion: event?.snapshotVersion,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    });
  }
}

async function readSkillBlobs(input: {
  commitTree: { path: string; sha: string; size: number; type: string }[];
  deps: SkillIndexServiceDeps;
  fullName: string;
  installationId: string;
  signal?: AbortSignal;
}): Promise<Map<string, string>> {
  const files = input.commitTree.filter(
    (file) =>
      file.type === "blob" &&
      /^skills\/[^/]+\/SKILL\.md$/.test(file.path) &&
      file.size <= SKILL_FILE_MAX_BYTES
  );
  const blobs = new Map<string, string>();
  for (let index = 0; index < files.length; index += 4) {
    const chunk = files.slice(index, index + 4);
    const results = await Promise.all(
      chunk.map((file) =>
        input.deps.readSkillRepositoryBlob({
          fullName: input.fullName,
          installationId: input.installationId,
          sha: file.sha,
          signal: input.signal,
        })
      )
    );
    for (const blob of results) {
      blobs.set(blob.sha, blob.text);
    }
  }
  return blobs;
}

function getRefreshFailureCode(error: unknown): string {
  if (isAbortError(error)) {
    return "refresh_timeout";
  }
  if (error instanceof SkillIndexTreeTruncatedError) {
    return "github_tree_truncated";
  }
  return "refresh_failed";
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError") ||
    (error instanceof Error &&
      error.cause instanceof DOMException &&
      error.cause.name === "AbortError")
  );
}
