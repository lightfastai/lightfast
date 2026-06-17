import type { Database } from "@db/app";
import { orgSetupGateSchema } from "@repo/app-setup-contract";
import { clerkOrgSlugSchema } from "@repo/app-validation";
import { githubBindStartOutputSchema } from "@repo/github-app-contract";
import { buildGitHubInstallationUrl } from "@repo/github-app-node";
import { z } from "zod";

import {
  getOrgAccessBySlug,
  isOrgAccessError,
} from "../../auth/organization-access";
import { getGitHubAppConfig } from "../../services/github/config";
import { issueGitHubInstallAttempt } from "../../services/github/setup/attempts";
import { syncGitHubBindingClaim } from "../../services/github/setup/flow";
import {
  GitHubLightfastRepositorySetupError,
  verifyGitHubLightfastRepositorySetup,
} from "../../services/github/setup/lightfast-repository";
import { defineCommand } from "../command";
import {
  AuthzError,
  InternalDomainError,
  NotFoundError,
  ValidationError,
} from "../errors";
import {
  requireActiveClerkOrgActor,
  requireClerkOrgAdminActor,
} from "../gates";

type GitHubLightfastRepositorySetupErrorCode =
  | "github_org_missing"
  | "github_transient_error"
  | "lightfast_repo_inaccessible"
  | "lightfast_repo_missing";

interface GitHubSetupCommandDeps {
  buildGitHubInstallationUrl: typeof buildGitHubInstallationUrl;
  db: Database;
  getGitHubAppConfig: typeof getGitHubAppConfig;
  getOrgAccessBySlug: typeof getOrgAccessBySlug;
  isOrgAccessError: (error: unknown) => boolean;
  issueGitHubInstallAttempt: typeof issueGitHubInstallAttempt;
  syncGitHubBindingClaim: typeof syncGitHubBindingClaim;
  verifyGitHubLightfastRepositorySetup: typeof verifyGitHubLightfastRepositorySetup;
}

export function createDefaultGitHubSetupCommandDeps(
  input: { db: Database } & Partial<GitHubSetupCommandDeps>
): GitHubSetupCommandDeps {
  return {
    buildGitHubInstallationUrl:
      input.buildGitHubInstallationUrl ?? buildGitHubInstallationUrl,
    db: input.db,
    getGitHubAppConfig: input.getGitHubAppConfig ?? getGitHubAppConfig,
    getOrgAccessBySlug: input.getOrgAccessBySlug ?? getOrgAccessBySlug,
    isOrgAccessError: input.isOrgAccessError ?? isOrgAccessError,
    issueGitHubInstallAttempt:
      input.issueGitHubInstallAttempt ?? issueGitHubInstallAttempt,
    syncGitHubBindingClaim:
      input.syncGitHubBindingClaim ?? syncGitHubBindingClaim,
    verifyGitHubLightfastRepositorySetup:
      input.verifyGitHubLightfastRepositorySetup ??
      verifyGitHubLightfastRepositorySetup,
  };
}

const startGitHubOrgSetupInput = z.object({
  orgSlug: clerkOrgSlugSchema,
});
const emptyInput = z.object({}).strict();

function isGitHubLightfastRepositorySetupError(error: unknown): error is {
  code: GitHubLightfastRepositorySetupErrorCode;
  message: string;
} {
  if (error instanceof GitHubLightfastRepositorySetupError) {
    return true;
  }

  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "GitHubLightfastRepositorySetupError" &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string"
  );
}

function mapGitHubLightfastRepositorySetupError(error: {
  code: GitHubLightfastRepositorySetupErrorCode;
  message: string;
}): never {
  if (error.code === "github_transient_error") {
    throw new InternalDomainError(
      "GITHUB_SETUP_TRANSIENT",
      error.message,
      {},
      { cause: error }
    );
  }

  if (error.code === "github_org_missing") {
    throw new ValidationError(
      "GITHUB_ORG_MISSING",
      error.message,
      {},
      { cause: error }
    );
  }

  if (error.code === "lightfast_repo_inaccessible") {
    throw new ValidationError(
      "LIGHTFAST_REPO_INACCESSIBLE",
      error.message,
      {},
      { cause: error }
    );
  }

  throw new ValidationError(
    "LIGHTFAST_REPO_MISSING",
    error.message,
    {},
    { cause: error }
  );
}

export const startGitHubOrgSetupCommand = defineCommand<
  "githubSetup.start",
  typeof startGitHubOrgSetupInput,
  typeof githubBindStartOutputSchema,
  GitHubSetupCommandDeps
>({
  name: "githubSetup.start",
  input: startGitHubOrgSetupInput,
  output: githubBindStartOutputSchema,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkOrgAdminActor(ctx);

    try {
      const orgAccess = await deps.getOrgAccessBySlug({
        db: deps.db,
        slug: input.orgSlug,
        userId: actor.userId,
      });

      if (orgAccess.org.id !== actor.orgId || orgAccess.role !== "org:admin") {
        throw new AuthzError(
          "GITHUB_SETUP_ADMIN_REQUIRED",
          "Only organization administrators can start GitHub setup."
        );
      }

      const config = deps.getGitHubAppConfig();
      const issued = await deps.issueGitHubInstallAttempt({
        clerkOrgId: orgAccess.org.id,
        lightfastUserId: actor.userId,
        orgSlug: orgAccess.org.slug,
      });

      return {
        installationUrl: deps.buildGitHubInstallationUrl({
          appSlug: config.appSlug,
          state: issued.state,
          webBaseUrl: config.endpoints.webBaseUrl,
        }),
      };
    } catch (error) {
      if (deps.isOrgAccessError(error)) {
        throw new NotFoundError(
          "ORG_NOT_FOUND",
          "Organization not found",
          {},
          { cause: error }
        );
      }
      throw error;
    }
  },
});

export const syncGitHubBindingClaimCommand = defineCommand<
  "githubSetup.syncBindingClaim",
  typeof emptyInput,
  typeof orgSetupGateSchema,
  GitHubSetupCommandDeps
>({
  name: "githubSetup.syncBindingClaim",
  input: emptyInput,
  output: orgSetupGateSchema,
  run: async ({ ctx, deps }) => {
    const actor = requireActiveClerkOrgActor(ctx);
    return deps.syncGitHubBindingClaim({ clerkOrgId: actor.orgId });
  },
});

export const verifyGitHubLightfastRepoCommand = defineCommand<
  "githubSetup.verifyLightfastRepo",
  typeof emptyInput,
  typeof orgSetupGateSchema,
  GitHubSetupCommandDeps
>({
  name: "githubSetup.verifyLightfastRepo",
  input: emptyInput,
  output: orgSetupGateSchema,
  run: async ({ ctx, deps }) => {
    const actor = requireClerkOrgAdminActor(ctx);
    try {
      return await deps.verifyGitHubLightfastRepositorySetup({
        clerkOrgId: actor.orgId,
        db: deps.db,
      });
    } catch (error) {
      if (isGitHubLightfastRepositorySetupError(error)) {
        mapGitHubLightfastRepositorySetupError(error);
      }
      throw error;
    }
  },
});
