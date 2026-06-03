import {
  IDENTITY_FILE_NAMES,
  IDENTITY_INDEX_MAX_CHARS_PER_FILE,
} from "@repo/identity-contract";

import { buildIdentityIndexFilesFromTree } from "./build";
import { resolveIdentityIndexServiceDeps } from "./deps";
import { getVerifiedIdentityCandidateByRepositoryId } from "./repository";
import type { IdentityIndexServiceDeps, IdentityRepositoryTree } from "./types";

const LOCK_TTL_SECONDS = 60;

class IdentityIndexTreeTruncatedError extends Error {
  constructor() {
    super(
      "GitHub tree response was truncated, so the identity index was not replaced."
    );
    this.name = "IdentityIndexTreeTruncatedError";
  }
}

export async function checkIdentityIndexSourceRef(input: {
  deps?: IdentityIndexServiceDeps;
  sourceControlRepositoryId: number;
}): Promise<{
  currentCommitSha: string | null;
  status: "changed" | "missing" | "unchanged";
}> {
  const deps = resolveIdentityIndexServiceDeps(input.deps);
  const candidate = await getVerifiedIdentityCandidateByRepositoryId(deps, {
    sourceControlRepositoryId: input.sourceControlRepositoryId,
  });
  if (!candidate?.binding.providerInstallationId) {
    return { currentCommitSha: null, status: "missing" };
  }

  return await checkIdentityIndexCandidateRef({
    candidate,
    deps,
    sourceControlRepositoryId: input.sourceControlRepositoryId,
  });
}

export async function checkIdentityIndexCandidateRef(input: {
  candidate: Awaited<
    ReturnType<typeof getVerifiedIdentityCandidateByRepositoryId>
  > extends infer T
    ? NonNullable<T>
    : never;
  deps: IdentityIndexServiceDeps;
  sourceControlRepositoryId: number;
}): Promise<{
  currentCommitSha: string | null;
  status: "changed" | "missing" | "unchanged";
}> {
  const state =
    input.candidate.state ??
    (await input.deps.getIdentityIndexStateBySourceControlRepositoryId(
      input.deps.db,
      {
        sourceControlRepositoryId: input.sourceControlRepositoryId,
      }
    ));
  const etag =
    state?.githubRefEtag && state.lastCheckedCommitSha
      ? state.githubRefEtag
      : null;
  const ref = await input.deps.readIdentityRepositoryMainRef({
    etag,
    fullName: input.candidate.repository.fullName,
    installationId: input.candidate.binding.providerInstallationId ?? "",
  });
  const checkedAt = input.deps.now();

  if (ref.status === "not_modified") {
    await input.deps.updateIdentityIndexRefCheck(input.deps.db, {
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
    await input.deps.updateIdentityIndexRefCheck(input.deps.db, {
      githubRefEtag: null,
      lastCheckedAt: checkedAt,
      lastCheckedCommitSha: null,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    });
    return { currentCommitSha: null, status: "missing" };
  }

  await input.deps.updateIdentityIndexRefCheck(input.deps.db, {
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

export async function refreshIdentityIndexSource(input: {
  deps?: IdentityIndexServiceDeps;
  reason: "read" | "schedule" | "setup" | "webhook";
  sourceControlRepositoryId: number;
  signal?: AbortSignal;
  targetCommitSha?: string;
}): Promise<{ status: "failed" | "fresh" | "missing" | "stale" }> {
  const deps = resolveIdentityIndexServiceDeps(input.deps);
  const state = await deps.createOrLoadIdentityIndexState(deps.db, {
    sourceControlRepositoryId: input.sourceControlRepositoryId,
  });
  const candidate = await getVerifiedIdentityCandidateByRepositoryId(deps, {
    sourceControlRepositoryId: input.sourceControlRepositoryId,
  });
  if (!candidate?.binding.providerInstallationId) {
    return { status: "missing" };
  }

  const lockToken = deps.randomToken();
  const lockAcquired = await deps.acquireIdentityIndexRefreshLock(deps.db, {
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
    const ref = await deps.readIdentityRepositoryMainRef({
      fullName: candidate.repository.fullName,
      installationId: candidate.binding.providerInstallationId,
      signal: input.signal,
    });
    input.signal?.throwIfAborted();
    const checkedAt = deps.now();
    if (ref.status === "not_modified") {
      await deps.updateIdentityIndexRefCheck(deps.db, {
        githubRefEtag: state.githubRefEtag,
        lastCheckedAt: checkedAt,
        lastCheckedCommitSha: state.lastCheckedCommitSha,
        sourceControlRepositoryId: input.sourceControlRepositoryId,
      });
      if (
        input.targetCommitSha &&
        state.lastCheckedCommitSha !== input.targetCommitSha
      ) {
        return { status: "stale" };
      }
      return { status: "fresh" };
    }
    if (ref.status === "missing") {
      await deps.updateIdentityIndexRefCheck(deps.db, {
        githubRefEtag: null,
        lastCheckedAt: checkedAt,
        lastCheckedCommitSha: null,
        sourceControlRepositoryId: input.sourceControlRepositoryId,
      });
      await deps.markIdentityIndexRefreshFailed(deps.db, {
        errorCode: "github_ref_missing",
        errorMessage: "GitHub main branch was not found.",
        failedAt: checkedAt,
        lockToken,
        stateId: state.id,
      });
      return { status: "missing" };
    }

    await deps.updateIdentityIndexRefCheck(deps.db, {
      githubRefEtag: ref.etag,
      lastCheckedAt: checkedAt,
      lastCheckedCommitSha: ref.sha,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    });
    if (input.targetCommitSha && ref.sha !== input.targetCommitSha) {
      return { status: "stale" };
    }

    const { commit, tree } = await deps.readIdentityRepositoryTree({
      commitSha: ref.sha,
      fullName: candidate.repository.fullName,
      installationId: candidate.binding.providerInstallationId,
      signal: input.signal,
    });
    input.signal?.throwIfAborted();
    if (tree.truncated) {
      throw new IdentityIndexTreeTruncatedError();
    }
    const blobs = await readIdentityBlobs({
      commitTree: tree,
      deps,
      fullName: candidate.repository.fullName,
      installationId: candidate.binding.providerInstallationId,
      signal: input.signal,
    });
    input.signal?.throwIfAborted();
    const built = buildIdentityIndexFilesFromTree({
      blobs,
      commitSha: commit.sha,
      tree: tree.tree,
    });
    await deps.replaceIdentityIndexFiles(deps.db, {
      files: built.files,
      indexDiagnostics: built.indexDiagnostics,
      indexedAt: deps.now(),
      indexedCommitSha: commit.sha,
      indexedTreeSha: tree.sha,
      lockToken,
      stateId: state.id,
    });
    return { status: "fresh" };
  } catch (error) {
    await deps.markIdentityIndexRefreshFailed(deps.db, {
      errorCode: getRefreshFailureCode(error),
      errorMessage: error instanceof Error ? error.message : "Refresh failed.",
      failedAt: deps.now(),
      lockToken,
      stateId: state.id,
    });
    return { status: "failed" };
  } finally {
    await deps.releaseIdentityIndexRefreshLock(deps.db, {
      lockToken,
      stateId: state.id,
    });
  }
}

async function readIdentityBlobs(input: {
  commitTree: IdentityRepositoryTree;
  deps: IdentityIndexServiceDeps;
  fullName: string;
  installationId: string;
  signal?: AbortSignal;
}): Promise<Map<string, string>> {
  const targetPaths = new Set<string>([
    IDENTITY_FILE_NAMES.identity,
    IDENTITY_FILE_NAMES.soul,
  ]);
  const files = input.commitTree.tree.filter(
    (file) =>
      file.type === "blob" &&
      targetPaths.has(file.path) &&
      (file.size === undefined ||
        file.size <= IDENTITY_INDEX_MAX_CHARS_PER_FILE)
  );
  const blobs = new Map<string, string>();
  for (const file of files) {
    const blob = await input.deps.readIdentityRepositoryBlob({
      fullName: input.fullName,
      installationId: input.installationId,
      sha: file.sha,
      signal: input.signal,
    });
    blobs.set(blob.sha, blob.text);
  }
  return blobs;
}

function getRefreshFailureCode(error: unknown): string {
  if (isAbortError(error)) {
    return "refresh_timeout";
  }
  if (error instanceof IdentityIndexTreeTruncatedError) {
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
