import type {
  Database,
  OrgSourceControlBinding,
  SourceControlRepository,
  UpsertWatchedSourceControlRepositoryInput,
} from "@db/app";
import {
  githubLightfastRepositoryProofSchema,
  LIGHTFAST_REPOSITORY_NAME,
} from "@repo/api-contract";
import { sourceControlRepositorySyncStatusSchema } from "@repo/source-control-contract";
import { z } from "zod";

import { getMatchingGitHubLightfastRepository } from "../../auth/org-setup-gate";
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

interface GitHubAppConfig {
  apiVersion: string;
  appId: string;
  endpoints: {
    apiBaseUrl: string;
    webBaseUrl: string;
  };
  privateKey: string;
}

interface GitHubInstallation {
  account: {
    id: string;
    login: string;
  };
  htmlUrl: string;
}

interface SourceControlLiveRepository {
  fullName: string;
  id: string;
  name: string;
  ownerId: string;
  ownerLogin: string;
  private: boolean;
}

export interface SourceControlRepositoryRow {
  fullName: string;
  id: string;
  imported: boolean;
  name: string;
  owner: {
    id: string;
    login: string;
  };
  private: boolean;
  syncStatus: SourceControlRepository["syncStatus"];
  watchedPathGlobs: string[] | null;
  webUrl: string;
}

export interface SourceControlCommandDeps {
  buildGitHubNewRepositoryUrl: (input: {
    accountLogin: string;
    name: string;
    webBaseUrl?: string;
  }) => string;
  buildGitHubRepositoryUrl: (input: {
    fullName: string;
    webBaseUrl?: string;
  }) => string;
  createGitHubAppJwt: (input: {
    appId: string;
    privateKey: string;
  }) => Promise<string>;
  createGitHubInstallationToken: (input: {
    apiBaseUrl?: string;
    apiVersion?: string;
    appJwt: string;
    installationId: string;
  }) => Promise<{ token: string }>;
  db: Database;
  getActiveOrgBinding: (
    db: Database,
    clerkOrgId: string
  ) => Promise<OrgSourceControlBinding | undefined>;
  getGitHubAppConfig: () => GitHubAppConfig;
  getGitHubAppInstallation: (input: {
    apiBaseUrl?: string;
    apiVersion?: string;
    appJwt: string;
    installationId: string;
  }) => Promise<GitHubInstallation>;
  insertWatchedSourceControlRepository: (
    db: Database,
    input: UpsertWatchedSourceControlRepositoryInput
  ) => Promise<unknown>;
  listAllGitHubInstallationRepositories: (input: {
    apiBaseUrl?: string;
    apiVersion?: string;
    installationToken: string;
  }) => Promise<SourceControlLiveRepository[]>;
  listWatchedSourceControlRepositories: (
    db: Database,
    input: { orgSourceControlBindingId: number }
  ) => Promise<SourceControlRepository[]>;
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

const lightfastRepositoryOutput = z.object({
  fullName: z.string().min(1),
  id: z.string().min(1),
  verifiedAt: z.date(),
});

const sourceControlBindingSummaryOutput = z.object({
  accountLogin: z.string().min(1),
  connectedAt: z.date(),
  importedRepositoryCount: z.number().int().nonnegative(),
  lightfastRepository: lightfastRepositoryOutput.nullable(),
  newLightfastRepositoryUrl: z.string().url(),
  provider: z.string().min(1),
  providerLabel: z.string().min(1),
}) satisfies z.ZodType<SourceControlBindingSummary>;

const getSourceControlConnectionOutput = z.discriminatedUnion("status", [
  z.object({
    binding: z.null(),
    status: z.literal("unbound"),
  }),
  z.object({
    binding: sourceControlBindingSummaryOutput,
    status: z.literal("bound"),
  }),
]) satisfies z.ZodType<SourceControlConnectionResult>;

const sourceControlOrganizationOutput = z.object({
  id: z.string().min(1),
  installationManageUrl: z.string().url(),
  login: z.string().min(1),
}) satisfies z.ZodType<SourceControlOrganization>;

const sourceControlRepositoryErrorOutput = z.discriminatedUnion("code", [
  z.object({
    code: z.literal("github_installation_account_mismatch"),
    message: z.string().min(1),
  }),
  z.object({
    code: z.literal("github_repository_listing_failed"),
    message: z.string().min(1),
  }),
]) satisfies z.ZodType<SourceControlRepositoryError>;

const sourceControlRepositoryRowOutput = z.object({
  fullName: z.string().min(1),
  id: z.string().min(1),
  imported: z.boolean(),
  name: z.string().min(1),
  owner: z.object({
    id: z.string().min(1),
    login: z.string().min(1),
  }),
  private: z.boolean(),
  syncStatus: sourceControlRepositorySyncStatusSchema,
  watchedPathGlobs: z.array(z.string().min(1)).nullable(),
  webUrl: z.string().url(),
}) satisfies z.ZodType<SourceControlRepositoryRow>;

const listSourceControlRepositoriesInput = z.object({}).strict();
const listSourceControlRepositoriesOutput = z.discriminatedUnion("status", [
  z.object({
    binding: z.null(),
    lightfastRepository: z.null(),
    organization: z.null(),
    repositories: z.tuple([]),
    repositoriesError: z.null(),
    status: z.literal("unbound"),
  }),
  z.object({
    binding: sourceControlBindingSummaryOutput,
    lightfastRepository: lightfastRepositoryOutput.nullable(),
    organization: sourceControlOrganizationOutput.nullable(),
    repositories: z.array(sourceControlRepositoryRowOutput),
    repositoriesError: sourceControlRepositoryErrorOutput.nullable(),
    status: z.literal("bound"),
  }),
  z.object({
    binding: sourceControlBindingSummaryOutput,
    lightfastRepository: lightfastRepositoryOutput.nullable(),
    organization: sourceControlOrganizationOutput.nullable(),
    repositories: z.array(sourceControlRepositoryRowOutput),
    repositoriesError: sourceControlRepositoryErrorOutput.nullable(),
    status: z.literal("broken"),
  }),
]) satisfies z.ZodType<ListSourceControlRepositoriesResult>;

const importSourceControlRepositoryInput = z.object({
  repositoryId: z.string().min(1),
});
const importSourceControlRepositoryOutput = listSourceControlRepositoriesOutput;

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
  binding: OrgSourceControlBinding | undefined
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
  deps: Pick<SourceControlCommandDeps, "buildGitHubNewRepositoryUrl">;
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
    newLightfastRepositoryUrl: input.deps.buildGitHubNewRepositoryUrl({
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

function lightfastRepositoryIdFromBinding(input: {
  metadata: Record<string, unknown>;
  providerInstallationId?: string | null;
}): string | null {
  const parsed = githubLightfastRepositoryProofSchema.safeParse(
    input.metadata.lightfastRepository
  );

  if (!parsed.success) {
    return null;
  }

  if (
    input.providerInstallationId &&
    parsed.data.installationId !== input.providerInstallationId
  ) {
    return null;
  }

  return parsed.data.id;
}

function countNormalImportedRepositories(input: {
  binding: {
    metadata: Record<string, unknown>;
  };
  watchedRepositories: SourceControlRepository[];
}): number {
  const lightfastRepositoryId = lightfastRepositoryIdFromBinding(input.binding);
  return input.watchedRepositories.filter(
    (repository) => repository.providerRepositoryId !== lightfastRepositoryId
  ).length;
}

function buildSourceControlRepositoryResponse(input: {
  binding: {
    id: number;
    metadata: Record<string, unknown>;
    providerAccountId: string | null;
  };
  buildGitHubRepositoryUrl: SourceControlCommandDeps["buildGitHubRepositoryUrl"];
  liveRepositories: SourceControlLiveRepository[];
  watchedRepositories: SourceControlRepository[];
  webBaseUrl: string;
}): SourceControlRepositoryRow[] {
  const lightfastRepositoryId = lightfastRepositoryIdFromBinding(input.binding);
  const watchedByProviderId = new Map(
    input.watchedRepositories.map((repository) => [
      repository.providerRepositoryId,
      repository,
    ])
  );

  return input.liveRepositories
    .filter(
      (repository) => repository.ownerId === input.binding.providerAccountId
    )
    .filter((repository) => repository.id !== lightfastRepositoryId)
    .filter((repository) => repository.name !== LIGHTFAST_REPOSITORY_NAME)
    .map((repository) => {
      const watched = watchedByProviderId.get(repository.id);
      return {
        fullName: repository.fullName,
        id: repository.id,
        imported: Boolean(watched),
        name: repository.name,
        owner: {
          id: repository.ownerId,
          login: repository.ownerLogin,
        },
        private: repository.private,
        syncStatus: watched?.syncStatus ?? "disabled",
        watchedPathGlobs: watched?.watchedPathGlobs ?? null,
        webUrl: input.buildGitHubRepositoryUrl({
          fullName: repository.fullName,
          webBaseUrl: input.webBaseUrl,
        }),
      };
    });
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
    deps: input.deps,
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
      deps,
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
          buildGitHubRepositoryUrl: deps.buildGitHubRepositoryUrl,
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

    // The insert helper handles duplicate-key races without overwriting an
    // existing watch's sync status or path policy.
    await deps.insertWatchedSourceControlRepository(deps.db, {
      fullName: selectedRepository.fullName,
      orgSourceControlBindingId: binding.id,
      providerRepositoryId: selectedRepository.id,
      syncStatus: "disabled",
      watchedPathGlobs: null,
    });

    const watchedRepositories = await deps.listWatchedSourceControlRepositories(
      deps.db,
      {
        orgSourceControlBindingId: binding.id,
      }
    );
    const bindingSummary = bindingResponse({
      binding,
      deps,
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
        buildGitHubRepositoryUrl: deps.buildGitHubRepositoryUrl,
        liveRepositories,
        watchedRepositories,
        webBaseUrl: config.endpoints.webBaseUrl,
      }),
      repositoriesError: null,
      status: "bound" as const,
    };
  },
});
