import type {
  SkillIndexableSourceControlRepositoryCandidate,
} from "@db/app";

import { isVerifiedLightfastSkillRepository } from "./eligibility";
import type { SkillIndexServiceDeps } from "./types";

export async function getVerifiedCandidateByRepositoryId(
  deps: SkillIndexServiceDeps,
  input: { clerkOrgId?: string; sourceControlRepositoryId: number }
): Promise<SkillIndexableSourceControlRepositoryCandidate | null> {
  const candidate =
    await deps.getSkillIndexableSourceControlRepositoryCandidateById(deps.db, {
      clerkOrgId: input.clerkOrgId,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    });
  if (!candidate || !isVerifiedLightfastSkillRepository(candidate)) {
    return null;
  }
  return candidate;
}
