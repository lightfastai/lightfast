import { resolveIdentityIndexServiceDeps } from "./deps";
import { isVerifiedLightfastIdentityRepository } from "./eligibility";
import { checkIdentityIndexCandidateRef } from "./refresh";
import type { IdentityIndexServiceDeps } from "./types";

export interface ChangedIdentityIndexSource {
  sourceControlRepositoryId: number;
  targetCommitSha?: string;
}

export async function findChangedIdentityIndexSources(input: {
  deps?: Partial<IdentityIndexServiceDeps>;
  limit: number;
  totalLimit: number;
}): Promise<{ changed: ChangedIdentityIndexSource[]; checked: number }> {
  const deps = resolveIdentityIndexServiceDeps(input.deps);
  let checked = 0;
  const changed: ChangedIdentityIndexSource[] = [];

  const candidates = await deps.listIdentityIndexRefreshCandidates(deps.db, {
    limit: input.totalLimit,
  });
  if (candidates.length === 0) {
    return { changed, checked };
  }

  for (const candidate of candidates.slice(0, input.totalLimit)) {
    if (changed.length >= input.limit) {
      break;
    }
    checked += 1;
    if (!isVerifiedLightfastIdentityRepository(candidate)) {
      continue;
    }
    const ref = await checkIdentityIndexCandidateRef({
      candidate,
      deps,
      sourceControlRepositoryId: candidate.repository.id,
    });
    if (ref.status === "changed") {
      changed.push({
        sourceControlRepositoryId: candidate.repository.id,
        targetCommitSha: ref.currentCommitSha ?? undefined,
      });
    }
    if (checked >= input.totalLimit || changed.length >= input.limit) {
      break;
    }
  }

  return { changed, checked };
}

export async function reconcileIdentityIndexSources(input: {
  deps?: Partial<IdentityIndexServiceDeps>;
  limit: number;
  totalLimit: number;
}): Promise<{ checked: number; queued: number }> {
  const deps = resolveIdentityIndexServiceDeps(input.deps);
  let queued = 0;
  const result = await findChangedIdentityIndexSources({
    deps,
    limit: input.limit,
    totalLimit: input.totalLimit,
  });
  if (!deps.enqueueRefresh) {
    return { checked: result.checked, queued };
  }

  for (const source of result.changed) {
    await deps.enqueueRefresh({
      reason: "schedule",
      sourceControlRepositoryId: source.sourceControlRepositoryId,
      targetCommitSha: source.targetCommitSha,
    });
    queued += 1;
  }

  return { checked: result.checked, queued };
}
