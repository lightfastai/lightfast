import type { Database } from "@db/app";
import { getActiveOrgBinding, type OrgSourceControlBinding } from "@db/app";
import {
  githubLightfastRepositoryProofSchema,
  LIGHTFAST_REPOSITORY_NAME,
  type OrgSetupGate,
} from "@repo/app-setup-contract";

function hasGitHubOrgRequirement(binding: OrgSourceControlBinding): boolean {
  return (
    binding.provider === "github" &&
    typeof binding.providerAccountLogin === "string" &&
    binding.providerAccountLogin.length > 0 &&
    typeof binding.providerInstallationId === "string" &&
    binding.providerInstallationId.length > 0
  );
}

export function hasMatchingGitHubLightfastRepositoryProof(
  binding: OrgSourceControlBinding
): boolean {
  if (!hasGitHubOrgRequirement(binding)) {
    return false;
  }

  const parsed = githubLightfastRepositoryProofSchema.safeParse(
    binding.metadata.lightfastRepository
  );
  if (!parsed.success) {
    return false;
  }

  return (
    parsed.data.fullName ===
      `${binding.providerAccountLogin}/${LIGHTFAST_REPOSITORY_NAME}` &&
    parsed.data.installationId === binding.providerInstallationId
  );
}

export function deriveOrgSetupGate(
  binding: OrgSourceControlBinding | undefined
): OrgSetupGate {
  if (!(binding && hasGitHubOrgRequirement(binding))) {
    return {
      bindingStatus: "unbound",
      nextSetupRequirement: "github_org",
    };
  }

  if (!hasMatchingGitHubLightfastRepositoryProof(binding)) {
    return {
      bindingStatus: "unbound",
      nextSetupRequirement: "github_lightfast_repo",
    };
  }

  return {
    bindingStatus: "bound",
    nextSetupRequirement: null,
  };
}

export async function resolveOrgSetupGate(input: {
  db: Database;
  clerkOrgId: string;
}): Promise<OrgSetupGate> {
  const binding = await getActiveOrgBinding(input.db, input.clerkOrgId);
  return deriveOrgSetupGate(binding);
}
