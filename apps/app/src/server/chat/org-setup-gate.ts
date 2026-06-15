import type { Database, OrgSourceControlBinding } from "@db/app";
import { getActiveOrgBinding, getCurrentOrgConnectorConnection } from "@db/app";
import {
  githubLightfastRepositoryProofSchema,
  LIGHTFAST_REPOSITORY_NAME,
  type OrgSetupGate,
} from "@repo/app-setup-contract";

function hasGitHubOrgRequirement(binding: OrgSourceControlBinding) {
  return (
    binding.provider === "github" &&
    typeof binding.providerAccountLogin === "string" &&
    binding.providerAccountLogin.length > 0 &&
    typeof binding.providerInstallationId === "string" &&
    binding.providerInstallationId.length > 0
  );
}

function hasMatchingGitHubLightfastRepositoryProof(
  binding: OrgSourceControlBinding
) {
  if (!hasGitHubOrgRequirement(binding)) {
    return false;
  }

  const parsed = githubLightfastRepositoryProofSchema.safeParse(
    binding.metadata.lightfastRepository
  );
  if (!parsed.success) {
    return false;
  }

  if (
    parsed.data.fullName !==
      `${binding.providerAccountLogin}/${LIGHTFAST_REPOSITORY_NAME}` ||
    parsed.data.installationId !== binding.providerInstallationId
  ) {
    return false;
  }

  return !Number.isNaN(new Date(parsed.data.verifiedAt).getTime());
}

export async function resolveWorkspaceAssistantOrgSetupGate(input: {
  db: Database;
  clerkOrgId: string;
}): Promise<OrgSetupGate> {
  const binding = await getActiveOrgBinding(input.db, input.clerkOrgId);
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

  const xConnection = await getCurrentOrgConnectorConnection(input.db, {
    clerkOrgId: input.clerkOrgId,
    provider: "x",
  });
  if (xConnection?.status !== "active") {
    return {
      bindingStatus: "unbound",
      nextSetupRequirement: "x_connector",
    };
  }

  return {
    bindingStatus: "bound",
    nextSetupRequirement: null,
  };
}
