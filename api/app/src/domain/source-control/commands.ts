import type { Database, OrgSourceControlBinding } from "@db/app";
import {
  getActiveOrgBinding,
  getWatchedSourceControlRepository,
  insertWatchedSourceControlRepository,
  listWatchedSourceControlRepositories,
} from "@db/app";
import { LIGHTFAST_REPOSITORY_NAME } from "@repo/app-setup-contract";
import {
  buildGitHubNewRepositoryUrl,
  createGitHubAppJwt,
  createGitHubInstallationToken,
  getGitHubAppInstallation,
} from "@repo/github-app-node";
import { z } from "zod";

import { getMatchingGitHubLightfastRepository } from "../../auth/org-setup-gate";
import { getGitHubAppConfig } from "../../services/github/config";
import {
  buildSourceControlRepositoryResponse,
  countNormalImportedRepositories,
  lightfastRepositoryIdFromBinding,
  listAllGitHubInstallationRepositories,
  type SourceControlRepositoryRow,
} from "../../services/github/source-control/repositories";
import { defineCommand } from "../command";
import { ConflictError } from "../errors";
import {
  requireActiveClerkOrgActor,
  requireClerkOrgAdminActor,
} from "../gates";

type ActiveGitHubBinding = OrgSourceControlBinding & {
  provider: "github";
  providerAccountId: string;
  providerInstallationId: string;
};

type GitHubAppConfig = ReturnType<typeof getGitHubAppConfig>;
type GitHubInstallation = Awaited<ReturnType<typeof getGitHubAppInstallation>>;

interface SourceControlCommandDeps {
  createGitHubAppJwt: typeof createGitHubAppJwt;
  createGitHubInstallationToken: typeof createGitHubInstallationToken;
  db: Database;
  getActiveOrgBinding: typeof getActiveOrgBinding;
  getGitHubAppConfig: typeof getGitHubAppConfig;
  getGitHubAppInstallation: typeof getGitHubAppInstallation;
  getWatchedSourceControlRepository: typeof getWatchedSourceControlRepository;
  insertWatchedSourceControlRepository: typeof insertWatchedSourceControlRepository;
  listAllGitHubInstallationRepositories: typeof listAllGitHubInstallationRepositories;
  listWatchedSourceControlRepositories: typeof listWatchedSourceControlRepositories;
}

export function createDefaultSourceControlCommandDeps(input: {
  createGitHubAppJwt?: typeof createGitHubAppJwt;
  createGitHubInstallationToken?: typeof createGitHubInstallationToken;
  db: Database;
  getActiveOrgBinding?: typeof getActiveOrgBinding;
  getGitHubAppConfig?: typeof getGitHubAppConfig;
  getGitHubAppInstallation?: typeof getGitHubAppInstallation;
  getWatchedSourceControlRepository?: typeof getWatchedSourceControlRepository;
  insertWatchedSourceControlRepository?: typeof insertWatchedSourceControlRepository;
  listAllGitHubInstallationRepositories?: typeof listAllGitHubInstallationRepositories;
  listWatchedSourceControlRepositories?: typeof listWatchedSourceControlRepositories;
}): SourceControlCommandDeps {
  return {
    createGitHubAppJwt: input.createGitHubAppJwt ?? createGitHubAppJwt,
    createGitHubInstallationToken:
      input.createGitHubInstallationToken ?? createGitHubInstallationToken,
    db: input.db,
    getActiveOrgBinding: input.getActiveOrgBinding ?? getActiveOrgBinding,
    getGitHubAppConfig: input.getGitHubAppConfig ?? getGitHubAppConfig,
    getGitHubAppInstallation:
      input.getGitHubAppInstallation ?? getGitHubAppInstallation,
    getWatchedSourceControlRepository:
      input.getWatchedSourceControlRepository ??
      getWatchedSourceControlRepository,
    insertWatchedSourceControlRepository:
      input.insertWatchedSourceControlRepository ??
      insertWatchedSourceControlRepository,
    listAllGitHubInstallationRepositories:
      input.listAllGitHubInstallationRepositories ??
      listAllGitHubInstallationRepositories,
    listWatchedSourceControlRepositories:
      input.listWatchedSourceControlRepositories ??
      listWatchedSourceControlRepositories,
  };
}

export interface SourceControlBindingSummary {
  accountLogin: string;
  connectedAt: Date;
  importedRepositoryCount: number;
  lightfastRepository: {
    fullName: string;
    id: string;
    verifiedAt: Date;
  } | null;
  newLightfastRepositoryUrl: string;
  provider: string;
  providerLabel: string;
}

export type SourceControlConnectionResult =
  | {
      binding: null;
      status: "unbound";
    }
  | {
      binding: SourceControlBindingSummary;
      status: "bound";
    };

type SourceControlRepositoryError =
  | {
      code: "github_installation_account_mismatch";
      message: string;
    }
  | {
      code: "github_repository_listing_failed";
      message: string;
    };

interface SourceControlOrganization {
  id: string;
  installationManageUrl: string;
  login: string;
}

export type ListSourceControlRepositoriesResult =
  | {
      binding: null;
      lightfastRepository: null;
      organization: null;
      repositories: [];
      repositoriesError: null;
      status: "unbound";
    }
  | {
      binding: SourceControlBindingSummary;
      lightfastRepository: SourceControlBindingSummary["lightfastRepository"];
      organization: SourceControlOrganization | null;
      repositories: SourceControlRepositoryRow[];
      repositoriesError: SourceControlRepositoryError | null;
      status: "bound" | "broken";
    };

const getSourceControlConnectionInput = z.object({}).strict();
const getSourceControlConnectionOutput =
  z.custom<SourceControlConnectionResult>(
    (value) => typeof value === "object" && value !== null
  );

const listSourceControlRepositoriesInput = z.object({}).strict();
const listSourceControlRepositoriesOutput =
  z.custom<ListSourceControlRepositoriesResult>(
    (value) => typeof value === "object" && value !== null
  );

const importSourceControlRepositoryInput = z.object({
  repositoryId: z.string().min(1),
});
const importSourceControlRepositoryOutput =
  z.custom<ListSourceControlRepositoriesResult>(
    (value) => typeof value === "object" && value !== null
  );

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

function providerLabel(provider: string) {
  return provider === "github" ? "GitHub" : provider;
}

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
  githubWebBaseUrl: string;
  importedRepositoryCount: number;
}): SourceControlBindingSummary {
  const accountLogin =
    input.binding.providerAccountLogin ?? input.binding.providerAccountId;

  return {
    accountLogin,
    connectedAt: input.binding.connectedAt,
    importedRepositoryCount: input.importedRepositoryCount,
    lightfastRepository: getMatchingGitHubLightfastRepository(input.binding),
    newLightfastRepositoryUrl: buildGitHubNewRepositoryUrl({
      accountLogin,
      name: LIGHTFAST_REPOSITORY_NAME,
      webBaseUrl: input.githubWebBaseUrl,
    }),
    provider: input.binding.provider,
    providerLabel: providerLabel(input.binding.provider),
  };
}

function organizationResponse(
  input: Pick<GitHubInstallation, "account" | "htmlUrl">
): SourceControlOrganization {
  return {
    id: input.account.id,
    installationManageUrl: input.htmlUrl,
    login: input.account.login,
  };
}

function repositoryListingFailed(
  message: string
): SourceControlRepositoryError {
  return { code: "github_repository_listing_failed", message };
}

function installationAccountMismatch(): SourceControlRepositoryError {
  return {
    code: "github_installation_account_mismatch",
    message: GITHUB_INSTALLATION_ACCOUNT_MISMATCH_MESSAGE,
  };
}

function importPreconditionFailed(code: string, message: string) {
  return new ConflictError(code, message);
}

async function getActiveBindingForOrg(input: {
  deps: SourceControlCommandDeps;
  orgId: string;
}) {
  return assertActiveGitHubBinding(
    await input.deps.getActiveOrgBinding(input.deps.db, input.orgId)
  );
}

async function createBindingSummary(input: {
  binding: ActiveGitHubBinding;
  config: GitHubAppConfig;
  deps: SourceControlCommandDeps;
}): Promise<SourceControlBindingSummary> {
  const watchedRepositories =
    await input.deps.listWatchedSourceControlRepositories(input.deps.db, {
      orgSourceControlBindingId: input.binding.id,
    });

  return bindingResponse({
    binding: input.binding,
    githubWebBaseUrl: input.config.endpoints.webBaseUrl,
    importedRepositoryCount: countNormalImportedRepositories({
      binding: input.binding,
      watchedRepositories,
    }),
  });
}

export const getSourceControlConnectionCommand = defineCommand<
  "sourceControl.getConnection",
  typeof getSourceControlConnectionInput,
  typeof getSourceControlConnectionOutput,
  SourceControlCommandDeps
>({
  name: "sourceControl.getConnection",
  input: getSourceControlConnectionInput,
  output: getSourceControlConnectionOutput,
  run: async ({ ctx, deps }) => {
    const actor = requireActiveClerkOrgActor(ctx);
    const binding = await getActiveBindingForOrg({
      deps,
      orgId: actor.orgId,
    });

    if (!binding) {
      return {
        binding: null,
        status: "unbound" as const,
      };
    }

    const config = deps.getGitHubAppConfig();

    return {
      binding: await createBindingSummary({ binding, config, deps }),
      status: "bound" as const,
    };
  },
});

export const listSourceControlRepositoriesCommand = defineCommand<
  "sourceControl.listRepositories",
  typeof listSourceControlRepositoriesInput,
  typeof listSourceControlRepositoriesOutput,
  SourceControlCommandDeps
>({
  name: "sourceControl.listRepositories",
  input: listSourceControlRepositoriesInput,
  output: listSourceControlRepositoriesOutput,
  run: async ({ ctx, deps }) => {
    const actor = requireActiveClerkOrgActor(ctx);
    const binding = await getActiveBindingForOrg({
      deps,
      orgId: actor.orgId,
    });

    if (!binding) {
      return {
        binding: null,
        lightfastRepository: null,
        organization: null,
        repositories: [],
        repositoriesError: null,
        status: "unbound" as const,
      };
    }

    const config = deps.getGitHubAppConfig();
    const watchedRepositories = await deps.listWatchedSourceControlRepositories(
      deps.db,
      {
        orgSourceControlBindingId: binding.id,
      }
    );
    const bindingSummary = bindingResponse({
      binding,
      githubWebBaseUrl: config.endpoints.webBaseUrl,
      importedRepositoryCount: countNormalImportedRepositories({
        binding,
        watchedRepositories,
      }),
    });
    const lightfastRepository = bindingSummary.lightfastRepository;
    const appJwt = await deps.createGitHubAppJwt({
      appId: config.appId,
      privateKey: config.privateKey,
    });

    let installation: GitHubInstallation;
    try {
      installation = await deps.getGitHubAppInstallation({
        apiBaseUrl: config.endpoints.apiBaseUrl,
        apiVersion: config.apiVersion,
        appJwt,
        installationId: binding.providerInstallationId,
      });
    } catch {
      return {
        binding: bindingSummary,
        lightfastRepository,
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
        lightfastRepository,
        organization: null,
        repositories: [],
        repositoriesError: installationAccountMismatch(),
        status: "broken" as const,
      };
    }

    try {
      const installationToken = await deps.createGitHubInstallationToken({
        apiBaseUrl: config.endpoints.apiBaseUrl,
        apiVersion: config.apiVersion,
        appJwt,
        installationId: binding.providerInstallationId,
      });
      const liveRepositories = await deps.listAllGitHubInstallationRepositories(
        {
          apiBaseUrl: config.endpoints.apiBaseUrl,
          apiVersion: config.apiVersion,
          installationToken: installationToken.token,
        }
      );

      return {
        binding: bindingSummary,
        lightfastRepository,
        organization: organizationResponse(installation),
        repositories: buildSourceControlRepositoryResponse({
          binding,
          liveRepositories,
          watchedRepositories,
          webBaseUrl: config.endpoints.webBaseUrl,
        }),
        repositoriesError: null,
        status: "bound" as const,
      };
    } catch {
      return {
        binding: bindingSummary,
        lightfastRepository,
        organization: organizationResponse(installation),
        repositories: [],
        repositoriesError: repositoryListingFailed(
          GITHUB_REPOSITORIES_FAILED_MESSAGE
        ),
        status: "bound" as const,
      };
    }
  },
});

export const importSourceControlRepositoryCommand = defineCommand<
  "sourceControl.importRepository",
  typeof importSourceControlRepositoryInput,
  typeof importSourceControlRepositoryOutput,
  SourceControlCommandDeps
>({
  name: "sourceControl.importRepository",
  input: importSourceControlRepositoryInput,
  output: importSourceControlRepositoryOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkOrgAdminActor(ctx);
    const binding = await getActiveBindingForOrg({
      deps,
      orgId: actor.orgId,
    });

    if (!binding) {
      throw importPreconditionFailed(
        "SOURCE_CONTROL_UNBOUND",
        GITHUB_UNBOUND_IMPORT_MESSAGE
      );
    }

    const lightfastRepositoryId = lightfastRepositoryIdFromBinding(binding);
    if (input.repositoryId === lightfastRepositoryId) {
      throw importPreconditionFailed(
        "SOURCE_CONTROL_LIGHTFAST_REPOSITORY",
        GITHUB_LIGHTFAST_IMPORT_MESSAGE
      );
    }

    const config = deps.getGitHubAppConfig();
    const appJwt = await deps.createGitHubAppJwt({
      appId: config.appId,
      privateKey: config.privateKey,
    });
    const installation = await deps.getGitHubAppInstallation({
      apiBaseUrl: config.endpoints.apiBaseUrl,
      apiVersion: config.apiVersion,
      appJwt,
      installationId: binding.providerInstallationId,
    });

    if (installation.account.id !== binding.providerAccountId) {
      throw importPreconditionFailed(
        "SOURCE_CONTROL_INSTALLATION_ACCOUNT_MISMATCH",
        GITHUB_INSTALLATION_ACCOUNT_MISMATCH_MESSAGE
      );
    }

    const installationToken = await deps.createGitHubInstallationToken({
      apiBaseUrl: config.endpoints.apiBaseUrl,
      apiVersion: config.apiVersion,
      appJwt,
      installationId: binding.providerInstallationId,
    });
    const liveRepositories = await deps.listAllGitHubInstallationRepositories({
      apiBaseUrl: config.endpoints.apiBaseUrl,
      apiVersion: config.apiVersion,
      installationToken: installationToken.token,
    });
    const selectedRepository = liveRepositories.find(
      (repository) => repository.id === input.repositoryId
    );

    if (!selectedRepository) {
      throw importPreconditionFailed(
        "SOURCE_CONTROL_REPOSITORY_INACCESSIBLE",
        GITHUB_REPOSITORY_INACCESSIBLE_MESSAGE
      );
    }

    if (selectedRepository.name === LIGHTFAST_REPOSITORY_NAME) {
      throw importPreconditionFailed(
        "SOURCE_CONTROL_LIGHTFAST_REPOSITORY",
        GITHUB_LIGHTFAST_IMPORT_MESSAGE
      );
    }

    if (selectedRepository.ownerId !== binding.providerAccountId) {
      throw importPreconditionFailed(
        "SOURCE_CONTROL_REPOSITORY_INACCESSIBLE",
        GITHUB_REPOSITORY_INACCESSIBLE_MESSAGE
      );
    }

    const existingWatch = await deps.getWatchedSourceControlRepository(
      deps.db,
      {
        orgSourceControlBindingId: binding.id,
        providerRepositoryId: selectedRepository.id,
      }
    );

    if (!existingWatch) {
      await deps.insertWatchedSourceControlRepository(deps.db, {
        fullName: selectedRepository.fullName,
        orgSourceControlBindingId: binding.id,
        providerRepositoryId: selectedRepository.id,
        syncStatus: "disabled",
        watchedPathGlobs: null,
      });
    }

    const watchedRepositories = await deps.listWatchedSourceControlRepositories(
      deps.db,
      {
        orgSourceControlBindingId: binding.id,
      }
    );
    const bindingSummary = bindingResponse({
      binding,
      githubWebBaseUrl: config.endpoints.webBaseUrl,
      importedRepositoryCount: countNormalImportedRepositories({
        binding,
        watchedRepositories,
      }),
    });

    return {
      binding: bindingSummary,
      lightfastRepository: bindingSummary.lightfastRepository,
      organization: organizationResponse(installation),
      repositories: buildSourceControlRepositoryResponse({
        binding,
        liveRepositories,
        watchedRepositories,
        webBaseUrl: config.endpoints.webBaseUrl,
      }),
      repositoriesError: null,
      status: "bound" as const,
    };
  },
});
