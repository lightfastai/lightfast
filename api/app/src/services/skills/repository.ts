import type {
  SkillIndexableSourceControlRepositoryCandidate,
} from "@db/app";

import { isVerifiedLightfastSkillRepository } from "./eligibility";
import type { SkillIndexServiceDeps } from "./types";

export async function getVerifiedCandidateByRepositoryId(
  deps: SkillIndexServiceDeps,
  input: { clerkOrgId?: string; sourceControlRepositoryId: number }
): Promise<SkillIndexableSourceControlRepositoryCandidate | null> {
  const candidates =
    await deps.listSkillIndexableSourceControlRepositoryCandidates(deps.db, {
      clerkOrgId: input.clerkOrgId,
      limit: 1000,
    });
  return (
    candidates.find(
      (candidate) =>
        candidate.repository.id === input.sourceControlRepositoryId &&
        isVerifiedLightfastSkillRepository(candidate)
    ) ?? null
  );
}
