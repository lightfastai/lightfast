import type { IdentityIndexRefreshCandidate } from "@db/app";

import { isVerifiedLightfastIdentityRepository } from "./eligibility";
import type { IdentityIndexServiceDeps } from "./types";

export async function getVerifiedIdentityCandidateByRepositoryId(
  deps: IdentityIndexServiceDeps,
  input: { clerkOrgId?: string; sourceControlRepositoryId: number }
): Promise<IdentityIndexRefreshCandidate | null> {
  const candidate = await deps.getIdentityIndexRefreshCandidateById(deps.db, {
    clerkOrgId: input.clerkOrgId,
    sourceControlRepositoryId: input.sourceControlRepositoryId,
  });
  if (!(candidate && isVerifiedLightfastIdentityRepository(candidate))) {
    return null;
  }
  return candidate;
}

export async function getVerifiedIdentityCandidateForOrg(
  deps: IdentityIndexServiceDeps,
  input: { clerkOrgId: string }
): Promise<IdentityIndexRefreshCandidate | null> {
  const candidates = await deps.listIdentityIndexRefreshCandidates(deps.db, {
    clerkOrgId: input.clerkOrgId,
    limit: 100,
  });
  return (
    candidates.find((candidate) =>
      isVerifiedLightfastIdentityRepository(candidate)
    ) ?? null
  );
}
