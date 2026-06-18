import { finalizeActiveOrgProviderBinding } from "@db/app";
import { db } from "@db/app/client";
import { githubInstallationMetadataSchema } from "@lightfast/connector-github/contract";
import { log } from "@vendor/observability/log/next";

import { mirrorOrgSetupGate } from "../../../auth/org-binding-mirror";
import { resolveOrgSetupGate } from "../../../auth/org-setup-gate";

interface GitHubFinalizedInstallation {
  account: {
    id: string;
    login: string;
  };
  appId: string;
  appSlug: string | null;
  events: string[];
  id: string;
  permissions: Record<string, string>;
  repositorySelection: "all" | "selected";
}

export async function finalizeGitHubOrgBinding(input: {
  clerkOrgId: string;
  connectedByUserId: string;
  installation: GitHubFinalizedInstallation;
  setupAction?: string;
}): Promise<void> {
  const metadata = githubInstallationMetadataSchema.parse({
    events: input.installation.events,
    githubAppId: input.installation.appId,
    githubAppSlug: input.installation.appSlug,
    githubSetupAction: input.setupAction,
    permissions: input.installation.permissions,
    repositorySelection: input.installation.repositorySelection,
  });

  await finalizeActiveOrgProviderBinding(db, {
    clerkOrgId: input.clerkOrgId,
    connectedByUserId: input.connectedByUserId,
    metadata,
    provider: "github",
    providerAccountId: input.installation.account.id,
    providerAccountLogin: input.installation.account.login,
    providerInstallationId: input.installation.id,
  });

  try {
    const gate = await resolveOrgSetupGate({
      db,
      clerkOrgId: input.clerkOrgId,
    });
    await mirrorOrgSetupGate({
      clerkOrgId: input.clerkOrgId,
      gate,
      provider: "github",
    });
  } catch (error) {
    log.warn("[github-setup] org binding mirror failed", {
      clerkOrgId: input.clerkOrgId,
      error,
    });
  }
}

export async function syncGitHubBindingClaim(input: { clerkOrgId: string }) {
  const gate = await resolveOrgSetupGate({ db, clerkOrgId: input.clerkOrgId });
  await mirrorOrgSetupGate({
    clerkOrgId: input.clerkOrgId,
    gate,
    provider: "github",
  });
  return gate;
}
