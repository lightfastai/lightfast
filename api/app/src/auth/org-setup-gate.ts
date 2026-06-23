import type { Database } from "@db/app";
import {
  getActiveOrgBinding,
  getCurrentOrgConnectorConnection,
  type OrgConnectorConnection,
  type OrgSourceControlBinding,
} from "@db/app";
import {
  type GitHubLightfastRepositoryProof,
  githubLightfastRepositoryProofSchema,
  LIGHTFAST_REPOSITORY_NAME,
  type OrgSetupGate,
} from "@repo/api-contract";

export interface MatchingGitHubLightfastRepository {
  fullName: GitHubLightfastRepositoryProof["fullName"];
  id: GitHubLightfastRepositoryProof["id"];
  verifiedAt: Date;
}

function hasGitHubOrgRequirement(binding: OrgSourceControlBinding): boolean {
  return (
    binding.provider === "github" &&
    typeof binding.providerAccountLogin === "string" &&
    binding.providerAccountLogin.length > 0 &&
    typeof binding.providerInstallationId === "string" &&
    binding.providerInstallationId.length > 0
  );
}

export function getMatchingGitHubLightfastRepository(
  binding: OrgSourceControlBinding
): MatchingGitHubLightfastRepository | null {
  if (!hasGitHubOrgRequirement(binding)) {
    return null;
  }

  const parsed = githubLightfastRepositoryProofSchema.safeParse(
    binding.metadata.lightfastRepository
  );
  if (!parsed.success) {
    return null;
  }

  if (
    parsed.data.fullName !==
      `${binding.providerAccountLogin}/${LIGHTFAST_REPOSITORY_NAME}` ||
    parsed.data.installationId !== binding.providerInstallationId
  ) {
    return null;
  }

  const verifiedAt = new Date(parsed.data.verifiedAt);
  if (Number.isNaN(verifiedAt.getTime())) {
    return null;
  }

  return {
    fullName: parsed.data.fullName,
    id: parsed.data.id,
    verifiedAt,
  };
}

export function hasMatchingGitHubLightfastRepositoryProof(
  binding: OrgSourceControlBinding
): boolean {
  return getMatchingGitHubLightfastRepository(binding) !== null;
}

export function deriveOrgSetupGate(
  binding: OrgSourceControlBinding | undefined,
  xConnection?: OrgConnectorConnection
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

export async function resolveOrgSetupGate(input: {
  db: Database;
  clerkOrgId: string;
}): Promise<OrgSetupGate> {
  const binding = await getActiveOrgBinding(input.db, input.clerkOrgId);
  if (!(binding && hasMatchingGitHubLightfastRepositoryProof(binding))) {
    return deriveOrgSetupGate(binding);
  }

  const xConnection = await getCurrentOrgConnectorConnection(input.db, {
    clerkOrgId: input.clerkOrgId,
    provider: "x",
  });
  return deriveOrgSetupGate(binding, xConnection);
}
