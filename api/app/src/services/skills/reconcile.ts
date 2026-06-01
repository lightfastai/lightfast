import { resolveSkillIndexServiceDeps } from "./deps";
import { isVerifiedLightfastSkillRepository } from "./eligibility";
import { checkSkillIndexSourceRef } from "./refresh";
import type { SkillIndexServiceDeps } from "./types";

export async function reconcileSkillIndexSources(input: {
  deps?: Partial<SkillIndexServiceDeps>;
  limit: number;
  totalLimit: number;
}): Promise<{ checked: number; queued: number }> {
  const deps = resolveSkillIndexServiceDeps(input.deps);
  let checked = 0;
  let queued = 0;

  const candidates =
    await deps.listSkillIndexableSourceControlRepositoryCandidates(deps.db, {
      limit: input.totalLimit,
    });
  if (candidates.length === 0) {
    return { checked, queued };
  }

  for (const candidate of candidates.slice(0, input.totalLimit)) {
    checked += 1;
    if (!isVerifiedLightfastSkillRepository(candidate)) {
      continue;
    }
    const ref = await checkSkillIndexSourceRef({
      deps,
      sourceControlRepositoryId: candidate.repository.id,
    });
    if (ref.status === "changed") {
      await deps.enqueueRefresh?.({
        reason: "schedule",
        sourceControlRepositoryId: candidate.repository.id,
        targetCommitSha: ref.currentCommitSha ?? undefined,
      });
      queued += 1;
    }
    if (checked >= input.totalLimit) {
      break;
    }
  }

  return { checked, queued };
}
