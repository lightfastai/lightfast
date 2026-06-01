import { SKILL_FILE_MAX_BYTES } from "@repo/skills-contract";

import { buildSkillIndexEntriesFromTree } from "./build";
import { resolveSkillIndexServiceDeps } from "./deps";
import { getVerifiedCandidateByRepositoryId } from "./repository";
import type { SkillIndexServiceDeps } from "./types";

const LOCK_TTL_SECONDS = 15;

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

  const state =
    candidate.state ??
    (await deps.getSkillIndexStateBySourceControlRepositoryId(deps.db, {
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    }));
  const etag =
    state?.githubRefEtag && state.lastCheckedCommitSha
      ? state.githubRefEtag
      : null;
  const ref = await deps.readSkillRepositoryMainRef({
    etag,
    fullName: candidate.repository.fullName,
    installationId: candidate.binding.providerInstallationId,
  });
  const checkedAt = deps.now();

  if (ref.status === "not_modified") {
    await deps.updateSkillIndexRefCheck(deps.db, {
      githubRefEtag: state?.githubRefEtag ?? null,
      lastCheckedAt: checkedAt,
      lastCheckedCommitSha: state?.lastCheckedCommitSha ?? null,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    });
    return {
      currentCommitSha: state?.lastCheckedCommitSha ?? null,
      status: "unchanged",
    };
  }

  if (ref.status === "missing") {
    await deps.updateSkillIndexRefCheck(deps.db, {
      githubRefEtag: null,
      lastCheckedAt: checkedAt,
      lastCheckedCommitSha: null,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    });
    return { currentCommitSha: null, status: "missing" };
  }

  await deps.updateSkillIndexRefCheck(deps.db, {
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
      return { status: "missing" };
    }

    await deps.updateSkillIndexRefCheck(deps.db, {
      githubRefEtag: ref.etag,
      lastCheckedAt: checkedAt,
      lastCheckedCommitSha: ref.sha,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    });

    const { commit, tree } = await deps.readSkillRepositoryTree({
      commitSha: ref.sha,
      fullName: candidate.repository.fullName,
      installationId: candidate.binding.providerInstallationId,
      signal: input.signal,
    });
    input.signal?.throwIfAborted();
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
    return { status: "fresh" };
  } catch (error) {
    const code = isAbortError(error) ? "refresh_timeout" : "refresh_failed";
    await deps.markSkillIndexRefreshFailed(deps.db, {
      errorCode: code,
      errorMessage: error instanceof Error ? error.message : "Refresh failed.",
      failedAt: deps.now(),
      lockToken,
      stateId: state.id,
    });
    return { status: "failed" };
  } finally {
    await deps.releaseSkillIndexRefreshLock(deps.db, {
      lockToken,
      stateId: state.id,
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

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError") ||
    (error instanceof Error &&
      error.cause instanceof DOMException &&
      error.cause.name === "AbortError")
  );
}
