import {
  getActiveOrgBinding,
  getWatchedSourceControlRepository,
  insertWatchedSourceControlRepository,
  listWatchedSourceControlRepositories,
  type OrgSourceControlBinding,
} from "@db/app";
import {
  createGitHubAppJwt,
  createGitHubInstallationToken,
  getGitHubAppInstallation,
} from "@repo/github-app-node";
import { SOURCE_CONTROL_ALL_PATHS_GLOB } from "@repo/source-control-contract";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { getGitHubAppConfig } from "../../services/github/config";
import {
  buildSourceControlRepositoryResponse,
  countNormalImportedRepositories,
  lightfastRepositoryIdFromBinding,
  listAllGitHubInstallationRepositories,
} from "../../services/github/source-control/repositories";
import { orgAdminProcedure, orgProcedure } from "../../trpc";

function providerLabel(provider: string) {
  return provider === "github" ? "GitHub" : provider;
}

type ActiveGitHubBinding = OrgSourceControlBinding & {
  provider: "github";
  providerAccountId: string;
  providerInstallationId: string;
};

const GITHUB_INSTALLATION_METADATA_FAILED_MESSAGE =
  "GitHub installation metadata could not be refreshed.";
const GITHUB_REPOSITORIES_FAILED_MESSAGE =
  "GitHub repositories could not be refreshed.";
const GITHUB_INSTALLATION_ACCOUNT_MISMATCH_MESSAGE =
  "The connected GitHub installation no longer matches this Lightfast organization.";
const GITHUB_UNBOUND_IMPORT_MESSAGE =
  "Connect a GitHub organization before adding repositories.";
const GITHUB_LIGHTFAST_IMPORT_MESSAGE =
  ".lightfast is setup infrastructure and cannot be added here.";
const GITHUB_REPOSITORY_INACCESSIBLE_MESSAGE =
  "Selected repository is no longer accessible to this GitHub installation.";

function assertActiveGitHubBinding(
  binding: Awaited<ReturnType<typeof getActiveOrgBinding>>
): ActiveGitHubBinding | null {
  if (
    !binding ||
    binding.provider !== "github" ||
    !binding.providerAccountId ||
    !binding.providerInstallationId
  ) {
    return null;
  }
  return binding as ActiveGitHubBinding;
}

function bindingResponse(input: {
  binding: ActiveGitHubBinding;
  importedRepositoryCount: number;
}) {
  return {
    connectedAt: input.binding.connectedAt,
    importedRepositoryCount: input.importedRepositoryCount,
    provider: input.binding.provider,
    providerLabel: providerLabel(input.binding.provider),
  };
}

function organizationResponse(input: {
  account: { id: string; login: string };
  htmlUrl: string;
}) {
  return {
    id: input.account.id,
    installationManageUrl: input.htmlUrl,
    login: input.account.login,
  };
}

function repositoryListingFailed(message: string) {
  return { code: "github_repository_listing_failed" as const, message };
}

function installationAccountMismatch() {
  return {
    code: "github_installation_account_mismatch" as const,
    message: GITHUB_INSTALLATION_ACCOUNT_MISMATCH_MESSAGE,
  };
}

export const orgSourceControlRouter = {
  get: orgProcedure.query(async ({ ctx }) => {
    const binding = assertActiveGitHubBinding(
      await getActiveOrgBinding(ctx.db, ctx.auth.identity.orgId)
    );

    if (!binding) {
      return {
        binding: null,
        status: "unbound" as const,
      };
    }

    const watchedRepositories = await listWatchedSourceControlRepositories(
      ctx.db,
      {
        orgSourceControlBindingId: binding.id,
      }
    );

    return {
      binding: bindingResponse({
        binding,
        importedRepositoryCount: countNormalImportedRepositories({
          binding,
          watchedRepositories,
        }),
      }),
      status: "bound" as const,
    };
  }),

  listRepositories: orgProcedure.query(async ({ ctx }) => {
    const binding = assertActiveGitHubBinding(
      await getActiveOrgBinding(ctx.db, ctx.auth.identity.orgId)
    );

    if (!binding) {
      return {
        binding: null,
        organization: null,
        repositories: [],
        repositoriesError: null,
        status: "unbound" as const,
      };
    }

    const config = getGitHubAppConfig();
    const watchedRepositories = await listWatchedSourceControlRepositories(
      ctx.db,
      {
        orgSourceControlBindingId: binding.id,
      }
    );
    const bindingSummary = bindingResponse({
      binding,
      importedRepositoryCount: countNormalImportedRepositories({
        binding,
        watchedRepositories,
      }),
    });
    const appJwt = await createGitHubAppJwt({
      appId: config.appId,
      privateKey: config.privateKey,
    });

    let installation;
    try {
      installation = await getGitHubAppInstallation({
        apiBaseUrl: config.endpoints.apiBaseUrl,
        apiVersion: config.apiVersion,
        appJwt,
        installationId: binding.providerInstallationId,
      });
    } catch {
      return {
        binding: bindingSummary,
        organization: null,
        repositories: [],
        repositoriesError: repositoryListingFailed(
          GITHUB_INSTALLATION_METADATA_FAILED_MESSAGE
        ),
        status: "bound" as const,
      };
    }

    if (installation.account.id !== binding.providerAccountId) {
      return {
        binding: bindingSummary,
        organization: null,
        repositories: [],
        repositoriesError: installationAccountMismatch(),
        status: "broken" as const,
      };
    }

    try {
      const installationToken = await createGitHubInstallationToken({
        apiBaseUrl: config.endpoints.apiBaseUrl,
        apiVersion: config.apiVersion,
        appJwt,
        installationId: binding.providerInstallationId,
      });
      const liveRepositories = await listAllGitHubInstallationRepositories({
        apiBaseUrl: config.endpoints.apiBaseUrl,
        apiVersion: config.apiVersion,
        installationToken: installationToken.token,
      });

      return {
        binding: bindingSummary,
        organization: organizationResponse(installation),
        repositories: buildSourceControlRepositoryResponse({
          binding,
          liveRepositories,
          watchedRepositories,
        }),
        repositoriesError: null,
        status: "bound" as const,
      };
    } catch {
      return {
        binding: bindingSummary,
        organization: organizationResponse(installation),
        repositories: [],
        repositoriesError: repositoryListingFailed(
          GITHUB_REPOSITORIES_FAILED_MESSAGE
        ),
        status: "bound" as const,
      };
    }
  }),

  importRepository: orgAdminProcedure
    .input(z.object({ repositoryId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const binding = assertActiveGitHubBinding(
        await getActiveOrgBinding(ctx.db, ctx.auth.identity.orgId)
      );

      if (!binding) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: GITHUB_UNBOUND_IMPORT_MESSAGE,
        });
      }

      const lightfastRepositoryId = lightfastRepositoryIdFromBinding(binding);
      if (input.repositoryId === lightfastRepositoryId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: GITHUB_LIGHTFAST_IMPORT_MESSAGE,
        });
      }

      const config = getGitHubAppConfig();
      const appJwt = await createGitHubAppJwt({
        appId: config.appId,
        privateKey: config.privateKey,
      });
      const installation = await getGitHubAppInstallation({
        apiBaseUrl: config.endpoints.apiBaseUrl,
        apiVersion: config.apiVersion,
        appJwt,
        installationId: binding.providerInstallationId,
      });

      if (installation.account.id !== binding.providerAccountId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: GITHUB_INSTALLATION_ACCOUNT_MISMATCH_MESSAGE,
        });
      }

      const installationToken = await createGitHubInstallationToken({
        apiBaseUrl: config.endpoints.apiBaseUrl,
        apiVersion: config.apiVersion,
        appJwt,
        installationId: binding.providerInstallationId,
      });
      const liveRepositories = await listAllGitHubInstallationRepositories({
        apiBaseUrl: config.endpoints.apiBaseUrl,
        apiVersion: config.apiVersion,
        installationToken: installationToken.token,
      });
      const selectedRepository = liveRepositories.find(
        (repository) => repository.id === input.repositoryId
      );

      if (!selectedRepository) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: GITHUB_REPOSITORY_INACCESSIBLE_MESSAGE,
        });
      }

      if (selectedRepository.name === ".lightfast") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: GITHUB_LIGHTFAST_IMPORT_MESSAGE,
        });
      }

      if (selectedRepository.ownerId !== binding.providerAccountId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: GITHUB_REPOSITORY_INACCESSIBLE_MESSAGE,
        });
      }

      const existingWatch = await getWatchedSourceControlRepository(ctx.db, {
        orgSourceControlBindingId: binding.id,
        providerRepositoryId: selectedRepository.id,
      });

      if (!existingWatch) {
        await insertWatchedSourceControlRepository(ctx.db, {
          fullName: selectedRepository.fullName,
          orgSourceControlBindingId: binding.id,
          providerRepositoryId: selectedRepository.id,
          syncStatus: "disabled",
          watchedPathGlobs: [SOURCE_CONTROL_ALL_PATHS_GLOB],
        });
      }

      const watchedRepositories = await listWatchedSourceControlRepositories(
        ctx.db,
        {
          orgSourceControlBindingId: binding.id,
        }
      );

      return {
        binding: bindingResponse({
          binding,
          importedRepositoryCount: countNormalImportedRepositories({
            binding,
            watchedRepositories,
          }),
        }),
        organization: organizationResponse(installation),
        repositories: buildSourceControlRepositoryResponse({
          binding,
          liveRepositories,
          watchedRepositories,
        }),
        repositoriesError: null,
        status: "bound" as const,
      };
    }),
} satisfies TRPCRouterRecord;
