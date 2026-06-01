import { resolveSkillIndexServiceDeps } from "./deps";
import { isVerifiedLightfastSkillRepository } from "./eligibility";
import { checkSkillIndexSourceRef } from "./refresh";
import type { SkillIndexServiceDeps } from "./types";

export type ChangedSkillIndexSource = {
  sourceControlRepositoryId: number;
  targetCommitSha?: string;
};

export async function findChangedSkillIndexSources(input: {
  deps?: Partial<SkillIndexServiceDeps>;
  limit: number;
  totalLimit: number;
}): Promise<{ checked: number; changed: ChangedSkillIndexSource[] }> {
  const deps = resolveSkillIndexServiceDeps(input.deps);
  let checked = 0;
  const changed: ChangedSkillIndexSource[] = [];

  const candidates =
    await deps.listSkillIndexableSourceControlRepositoryCandidates(deps.db, {
      limit: input.totalLimit,
    });
  if (candidates.length === 0) {
    return { checked, changed };
  }

  for (const candidate of candidates.slice(0, input.totalLimit)) {
    if (changed.length >= input.limit) {
      break;
    }
    checked += 1;
    if (!isVerifiedLightfastSkillRepository(candidate)) {
      continue;
    }
    const ref = await checkSkillIndexSourceRef({
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

  return { checked, changed };
}

export async function reconcileSkillIndexSources(input: {
  deps?: Partial<SkillIndexServiceDeps>;
  limit: number;
  totalLimit: number;
}): Promise<{ checked: number; queued: number }> {
  const deps = resolveSkillIndexServiceDeps(input.deps);
  let queued = 0;
  const result = await findChangedSkillIndexSources({
    deps,
    limit: input.limit,
    totalLimit: input.totalLimit,
  });

  for (const source of result.changed) {
    await deps.enqueueRefresh?.({
      reason: "schedule",
      sourceControlRepositoryId: source.sourceControlRepositoryId,
      targetCommitSha: source.targetCommitSha,
    });
    queued += 1;
  }

  return { checked: result.checked, queued };
}
