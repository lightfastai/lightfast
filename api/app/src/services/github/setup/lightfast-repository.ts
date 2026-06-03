import type { Database } from "@db/app";
import {
  completeWatchedSourceControlRepositorySetup,
  getActiveOrgBinding,
  upsertWatchedSourceControlRepository,
} from "@db/app";
import {
  githubLightfastRepositoryProofSchema,
  LIGHTFAST_REPOSITORY_NAME,
  type OrgSetupGate,
} from "@repo/app-setup-contract";
import {
  createGitHubAppJwt,
  createGitHubInstallationToken,
  getGitHubRepository,
  verifyGitHubInstallationRepository,
} from "@repo/github-app-node";
import { IDENTITY_WATCHED_PATH_GLOBS } from "@repo/identity-contract";
import { log } from "@vendor/observability/log/next";

import { mirrorOrgSetupGate } from "../../../auth/org-binding-mirror";
import {
  deriveOrgSetupGate,
  hasMatchingGitHubLightfastRepositoryProof,
} from "../../../auth/org-setup-gate";
import { createIdentityRefreshDedupeKey } from "../../../inngest/workflow/identity-refresh-event";
import { createSkillRefreshDedupeKey } from "../../../inngest/workflow/skill-refresh-event";
import { getGitHubAppConfig } from "../config";

export class GitHubLightfastRepositorySetupError extends Error {
  constructor(
    readonly code:
      | "github_org_missing"
      | "lightfast_repo_missing"
      | "lightfast_repo_inaccessible"
      | "github_transient_error",
    message: string
  ) {
    super(message);
    this.name = "GitHubLightfastRepositorySetupError";
  }
}

function assertGitHubBinding(
  binding: Awaited<ReturnType<typeof getActiveOrgBinding>>
): asserts binding is NonNullable<typeof binding> & {
  providerAccountLogin: string;
  providerInstallationId: string;
} {
  if (
    !binding ||
    binding.provider !== "github" ||
    !binding.providerAccountLogin ||
    !binding.providerInstallationId
  ) {
    throw new GitHubLightfastRepositorySetupError(
      "github_org_missing",
      "Connect a GitHub organization before verifying .lightfast."
    );
  }
}

async function ensureWatchedLightfastRepository(input: {
  bindingId: number;
  db: Database;
  fullName: string;
  providerRepositoryId: string;
}) {
  return await upsertWatchedSourceControlRepository(input.db, {
    fullName: input.fullName,
    orgSourceControlBindingId: input.bindingId,
    providerRepositoryId: input.providerRepositoryId,
    watchedPathGlobs: [...IDENTITY_WATCHED_PATH_GLOBS],
  });
}

async function enqueueInitialSkillRefresh(input: {
  sourceControlRepositoryId: number;
}) {
  try {
    const { inngest } = await import("../../../inngest/client");
    await inngest.send({
      name: "app/skills.index.refresh.requested",
      data: {
        dedupeKey: createSkillRefreshDedupeKey({
          reason: "setup",
          sourceControlRepositoryId: input.sourceControlRepositoryId,
        }),
        reason: "setup",
        sourceControlRepositoryId: input.sourceControlRepositoryId,
      },
    });
  } catch (error) {
    log.warn("[github-setup] initial skill refresh enqueue failed", {
      error,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    });
    return;
  }
}

async function enqueueInitialIdentityRefresh(input: {
  sourceControlRepositoryId: number;
}) {
  try {
    const { inngest } = await import("../../../inngest/client");
    await inngest.send({
      name: "app/identity.index.refresh.requested",
      data: {
        dedupeKey: createIdentityRefreshDedupeKey({
          reason: "setup",
          sourceControlRepositoryId: input.sourceControlRepositoryId,
        }),
        reason: "setup",
        sourceControlRepositoryId: input.sourceControlRepositoryId,
      },
    });
  } catch (error) {
    log.warn("[github-setup] initial identity refresh enqueue failed", {
      error,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    });
    return;
  }
}

export async function verifyGitHubLightfastRepositorySetup(input: {
  clerkOrgId: string;
  db: Database;
}): Promise<OrgSetupGate> {
  const binding = await getActiveOrgBinding(input.db, input.clerkOrgId);
  assertGitHubBinding(binding);

  if (hasMatchingGitHubLightfastRepositoryProof(binding)) {
    const proof = githubLightfastRepositoryProofSchema.parse(
      binding.metadata.lightfastRepository
    );
    const watchedRepository = await ensureWatchedLightfastRepository({
      bindingId: binding.id,
      db: input.db,
      fullName: proof.fullName,
      providerRepositoryId: proof.id,
    });
    await enqueueInitialSkillRefresh({
      sourceControlRepositoryId: watchedRepository.id,
    });
    await enqueueInitialIdentityRefresh({
      sourceControlRepositoryId: watchedRepository.id,
    });
    const gate = deriveOrgSetupGate(binding);
    await mirrorOrgSetupGate({
      clerkOrgId: input.clerkOrgId,
      gate,
      provider: "github",
    });
    return gate;
  }

  const config = getGitHubAppConfig();
  const appJwt = await createGitHubAppJwt({
    appId: config.appId,
    privateKey: config.privateKey,
  });

  try {
    await verifyGitHubInstallationRepository({
      apiBaseUrl: config.endpoints.apiBaseUrl,
      apiVersion: config.apiVersion,
      appJwt,
      expectedInstallationId: binding.providerInstallationId,
      owner: binding.providerAccountLogin,
      repo: LIGHTFAST_REPOSITORY_NAME,
    });
  } catch (error) {
    const code =
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "GITHUB_REPOSITORY_NOT_FOUND"
        ? "lightfast_repo_missing"
        : error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "GITHUB_REPOSITORY_INACCESSIBLE"
          ? "lightfast_repo_inaccessible"
          : "github_transient_error";
    throw new GitHubLightfastRepositorySetupError(
      code,
      "Lightfast could not verify the .lightfast repository."
    );
  }

  const installationToken = await createGitHubInstallationToken({
    apiBaseUrl: config.endpoints.apiBaseUrl,
    apiVersion: config.apiVersion,
    appJwt,
    installationId: binding.providerInstallationId,
  });
  const repository = await getGitHubRepository({
    apiBaseUrl: config.endpoints.apiBaseUrl,
    apiVersion: config.apiVersion,
    installationToken: installationToken.token,
    owner: binding.providerAccountLogin,
    repo: LIGHTFAST_REPOSITORY_NAME,
  });
  const proof = githubLightfastRepositoryProofSchema.parse({
    fullName: repository.fullName,
    id: repository.id,
    installationId: binding.providerInstallationId,
    name: repository.name,
    verifiedAt: new Date().toISOString(),
  });

  const metadata = {
    ...binding.metadata,
    lightfastRepository: proof,
  };
  let watchedRepository: Awaited<
    ReturnType<typeof completeWatchedSourceControlRepositorySetup>
  >;
  try {
    watchedRepository = await completeWatchedSourceControlRepositorySetup(
      input.db,
      {
        bindingMetadata: metadata,
        fullName: proof.fullName,
        orgSourceControlBindingId: binding.id,
        providerRepositoryId: proof.id,
        watchedPathGlobs: [...IDENTITY_WATCHED_PATH_GLOBS],
      }
    );
  } catch {
    throw new GitHubLightfastRepositorySetupError(
      "github_transient_error",
      "Lightfast could not store the .lightfast repository proof."
    );
  }
  await enqueueInitialSkillRefresh({
    sourceControlRepositoryId: watchedRepository.id,
  });
  await enqueueInitialIdentityRefresh({
    sourceControlRepositoryId: watchedRepository.id,
  });

  const gate = deriveOrgSetupGate({
    ...binding,
    metadata,
  });
  await mirrorOrgSetupGate({
    clerkOrgId: input.clerkOrgId,
    gate,
    provider: "github",
  });
  return gate;
}
