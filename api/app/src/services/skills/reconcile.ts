import { resolveSkillIndexServiceDeps } from "./deps";
import { isVerifiedLightfastSkillRepository } from "./eligibility";
import { checkSkillIndexSourceRef } from "./refresh";
import type { SkillIndexServiceDeps } from "./types";

export async function reconcileSkillIndexSources(input: {
  deps?: SkillIndexServiceDeps;
  limit: number;
  totalLimit: number;
}): Promise<{ checked: number; queued: number }> {
  const deps = resolveSkillIndexServiceDeps(input.deps);
  let checked = 0;
  let queued = 0;

  while (checked < input.totalLimit) {
    const candidates =
      await deps.listSkillIndexableSourceControlRepositoryCandidates(deps.db, {
        limit: Math.min(input.limit, input.totalLimit - checked),
      });
    if (candidates.length === 0) {
      break;
    }

    for (const candidate of candidates) {
      if (checked >= input.totalLimit) {
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
        await deps.enqueueRefresh?.({
          reason: "schedule",
          sourceControlRepositoryId: candidate.repository.id,
          targetCommitSha: ref.currentCommitSha ?? undefined,
        });
        queued += 1;
      }
    }

    if (candidates.length < input.limit) {
      break;
    }
  }

  return { checked, queued };
}
