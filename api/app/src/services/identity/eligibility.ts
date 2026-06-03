import type { Database } from "@db/app";
import {
  listIdentityIndexRefreshCandidates,
  type OrgSourceControlBinding,
  type SourceControlRepository,
} from "@db/app";
import { githubLightfastRepositoryProofSchema } from "@repo/app-setup-contract";
import { TRPCError } from "@trpc/server";

export function isVerifiedLightfastIdentityRepository(input: {
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

export async function getVerifiedLightfastIdentitySourceRepositoryId(
  db: Database,
  input: { clerkOrgId: string }
): Promise<number> {
  const candidates = await listIdentityIndexRefreshCandidates(db, {
    clerkOrgId: input.clerkOrgId,
    limit: 100,
  });
  const candidate = candidates.find((row) =>
    isVerifiedLightfastIdentityRepository(row)
  );
  if (!candidate) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No verified Lightfast identity repository is configured.",
    });
  }
  return candidate.repository.id;
}
