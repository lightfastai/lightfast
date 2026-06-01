import type { Database } from "@db/app";
import {
  listSkillIndexableSourceControlRepositoryCandidates,
  type OrgSourceControlBinding,
  type SourceControlRepository,
} from "@db/app";
import { githubLightfastRepositoryProofSchema } from "@repo/app-setup-contract";
import { TRPCError } from "@trpc/server";

export function isVerifiedLightfastSkillRepository(input: {
  binding: OrgSourceControlBinding;
  repository: SourceControlRepository;
}): boolean {
  const { binding, repository } = input;
  if (
    binding.provider !== "github" ||
    binding.status !== "active" ||
    !binding.providerInstallationId ||
    !binding.providerAccountLogin
  ) {
    return false;
  }

  const proof = githubLightfastRepositoryProofSchema.safeParse(
    binding.metadata.lightfastRepository
  );
  if (!proof.success) {
    return false;
  }

  return (
    proof.data.id === repository.providerRepositoryId &&
    proof.data.installationId === binding.providerInstallationId &&
    proof.data.fullName === repository.fullName
  );
}

export async function getVerifiedLightfastSkillSourceRepositoryId(
  db: Database,
  input: { clerkOrgId: string }
): Promise<number> {
  const candidates = await listSkillIndexableSourceControlRepositoryCandidates(
    db,
    { clerkOrgId: input.clerkOrgId, limit: 100 }
  );
  const candidate = candidates.find((row) =>
    isVerifiedLightfastSkillRepository(row)
  );
  if (!candidate) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No verified Lightfast skills repository is configured.",
    });
  }
  return candidate.repository.id;
}
