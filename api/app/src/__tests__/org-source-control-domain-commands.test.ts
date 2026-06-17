import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExecutionContext } from "../domain";
import {
  getSourceControlConnectionCommand,
  importSourceControlRepositoryCommand,
  listSourceControlRepositoriesCommand,
} from "../domain/source-control";

const connectedAt = new Date("2026-05-29T01:02:03.000Z");

const activeCtx: ExecutionContext = {
  actor: {
    kind: "clerkUser",
    orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
    orgId: "org_acme",
    source: "web",
    userId: "user_test",
  },
};

const adminCtx: ExecutionContext = {
  actor: {
    kind: "clerkUser",
    orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
    orgId: "org_acme",
    orgRole: "admin",
    source: "web",
    userId: "user_test",
  },
};

const pendingCtx: ExecutionContext = {
  actor: {
    kind: "clerkUser",
    source: "web",
    userId: "user_test",
  },
};

function activeBinding(overrides: Record<string, unknown> = {}) {
  return {
    clerkOrgId: "org_acme",
    connectedAt,
    connectedByUserId: "user_admin",
    createdAt: connectedAt,
    id: 3,
    metadata: {
      lightfastRepository: {
        fullName: "acme/.lightfast",
        id: "repo_lightfast",
        installationId: "1001",
        name: ".lightfast",
        verifiedAt: "2026-05-29T01:02:03.000Z",
      },
    },
    provider: "github",
    providerAccountId: "987654",
    providerAccountLogin: "acme",
    providerInstallationId: "1001",
    revokedAt: null,
    status: "active",
    updatedAt: connectedAt,
    ...overrides,
  };
}

function watchedRepository(overrides: Record<string, unknown> = {}) {
  const createdAt = new Date("2026-05-30T01:02:03.000Z");
  return {
    createdAt,
    fullName: "stale/repo",
    id: 10,
    orgSourceControlBindingId: 3,
    providerRepositoryId: "repo_live",
    syncStatus: "disabled",
    updatedAt: createdAt,
    watchedPathGlobs: ["src/**"],
    ...overrides,
  };
}

function liveRepository(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "acme-live/app",
    id: "repo_live",
    name: "app",
    ownerId: "987654",
    ownerLogin: "acme-live",
    private: true,
    ...overrides,
  };
}

function createDeps() {
  return {
    createGitHubAppJwt: vi.fn().mockResolvedValue("app.jwt"),
    createGitHubInstallationToken: vi.fn().mockResolvedValue({
      expiresAt: "2026-05-29T02:02:03.000Z",
      token: "installation.token",
    }),
    db: {} as Database,
    getActiveOrgBinding: vi.fn(),
    getGitHubAppConfig: vi.fn().mockReturnValue({
      apiVersion: "2022-11-28",
      appId: "12345",
      appSlug: "lightfast-test",
      clientId: "github_client_test",
      clientSecret: "github_secret_test",
      endpoints: {
        apiBaseUrl: "https://github.lightfast.localhost",
        oauthAuthorizeUrl:
          "https://github.lightfast.localhost/login/oauth/authorize",
        oauthTokenUrl:
          "https://github.lightfast.localhost/login/oauth/access_token",
        webBaseUrl: "https://github.lightfast.localhost",
      },
      privateKey: "test-private-key",
    }),
    getGitHubAppInstallation: vi.fn().mockResolvedValue({
      account: { id: "987654", login: "acme-live", type: "Organization" },
      htmlUrl:
        "https://github.lightfast.localhost/apps/lightfast-test/installations/1001",
      id: "1001",
      targetType: "Organization",
    }),
    listAllGitHubInstallationRepositories: vi
      .fn()
      .mockResolvedValue([liveRepository()]),
    listWatchedSourceControlRepositories: vi.fn(),
    insertWatchedSourceControlRepository: vi.fn(),
  };
}

let deps: ReturnType<typeof createDeps>;

beforeEach(() => {
  deps = createDeps();
});

describe("getSourceControlConnectionCommand", () => {
  it("rejects pending actors before loading source-control data", async () => {
    await expect(
      getSourceControlConnectionCommand.run({
        ctx: pendingCtx,
        deps,
        input: {},
      })
    ).rejects.toMatchObject({
      code: "ORG_REQUIRED",
      kind: "authz",
    });

    expect(deps.getActiveOrgBinding).not.toHaveBeenCalled();
  });

  it("returns the active GitHub binding with .lightfast proof", async () => {
    deps.getActiveOrgBinding.mockResolvedValue(activeBinding());
    deps.listWatchedSourceControlRepositories.mockResolvedValue([
      watchedRepository(),
      watchedRepository({
        fullName: "acme/.lightfast",
        id: 11,
        providerRepositoryId: "repo_lightfast",
      }),
    ]);

    await expect(
      getSourceControlConnectionCommand.run({
        ctx: activeCtx,
        deps,
        input: {},
      })
    ).resolves.toEqual({
      binding: {
        accountLogin: "acme",
        connectedAt,
        importedRepositoryCount: 1,
        lightfastRepository: {
          fullName: "acme/.lightfast",
          id: "repo_lightfast",
          verifiedAt: connectedAt,
        },
        newLightfastRepositoryUrl:
          "https://github.lightfast.localhost/organizations/acme/repositories/new?name=.lightfast",
        provider: "github",
        providerLabel: "GitHub",
      },
      status: "bound",
    });
  });
});

describe("listSourceControlRepositoriesCommand", () => {
  it("merges live GitHub repositories with durable watches", async () => {
    deps.getActiveOrgBinding.mockResolvedValue(activeBinding());
    deps.listWatchedSourceControlRepositories.mockResolvedValue([
      watchedRepository({
        fullName: "stale/full-name",
        providerRepositoryId: "repo_live",
        watchedPathGlobs: ["src/**"],
      }),
      watchedRepository({
        fullName: "acme/.lightfast",
        id: 11,
        providerRepositoryId: "repo_lightfast",
      }),
    ]);
    deps.listAllGitHubInstallationRepositories.mockResolvedValue([
      liveRepository(),
      liveRepository({
        fullName: "acme-live/.lightfast",
        id: "repo_lightfast",
        name: ".lightfast",
        ownerLogin: "acme-live",
      }),
    ]);

    await expect(
      listSourceControlRepositoriesCommand.run({
        ctx: activeCtx,
        deps,
        input: {},
      })
    ).resolves.toEqual({
      binding: expect.objectContaining({
        accountLogin: "acme",
        importedRepositoryCount: 1,
      }),
      lightfastRepository: {
        fullName: "acme/.lightfast",
        id: "repo_lightfast",
        verifiedAt: connectedAt,
      },
      organization: {
        id: "987654",
        installationManageUrl:
          "https://github.lightfast.localhost/apps/lightfast-test/installations/1001",
        login: "acme-live",
      },
      repositories: [
        {
          fullName: "acme-live/app",
          id: "repo_live",
          imported: true,
          name: "app",
          owner: { id: "987654", login: "acme-live" },
          private: true,
          syncStatus: "disabled",
          watchedPathGlobs: ["src/**"],
          webUrl: "https://github.lightfast.localhost/acme-live/app",
        },
      ],
      repositoriesError: null,
      status: "bound",
    });
  });

  it("reports broken state when GitHub installation ownership changed", async () => {
    deps.getActiveOrgBinding.mockResolvedValue(activeBinding());
    deps.listWatchedSourceControlRepositories.mockResolvedValue([]);
    deps.getGitHubAppInstallation.mockResolvedValue({
      account: { id: "moved-account", login: "renamed" },
      htmlUrl:
        "https://github.lightfast.localhost/apps/lightfast-test/installations/1001",
    });

    await expect(
      listSourceControlRepositoriesCommand.run({
        ctx: activeCtx,
        deps,
        input: {},
      })
    ).resolves.toEqual({
      binding: expect.objectContaining({
        accountLogin: "acme",
      }),
      lightfastRepository: {
        fullName: "acme/.lightfast",
        id: "repo_lightfast",
        verifiedAt: connectedAt,
      },
      organization: null,
      repositories: [],
      repositoriesError: {
        code: "github_installation_account_mismatch",
        message:
          "The connected GitHub installation no longer matches this Lightfast organization.",
      },
      status: "broken",
    });

    expect(deps.createGitHubInstallationToken).not.toHaveBeenCalled();
    expect(deps.insertWatchedSourceControlRepository).not.toHaveBeenCalled();
  });
});

describe("importSourceControlRepositoryCommand", () => {
  it("rejects non-admin actors before loading binding data", async () => {
    await expect(
      importSourceControlRepositoryCommand.run({
        ctx: activeCtx,
        deps,
        input: { repositoryId: "repo_live" },
      })
    ).rejects.toMatchObject({
      code: "PERMISSION_REQUIRED",
      kind: "authz",
    });

    expect(deps.getActiveOrgBinding).not.toHaveBeenCalled();
  });

  it("registers one repository without watch globs", async () => {
    deps.getActiveOrgBinding.mockResolvedValue(activeBinding());
    deps.listWatchedSourceControlRepositories.mockResolvedValueOnce([
      watchedRepository({
        fullName: "acme-live/app",
        providerRepositoryId: "repo_live",
        watchedPathGlobs: null,
      }),
    ]);

    await expect(
      importSourceControlRepositoryCommand.run({
        ctx: adminCtx,
        deps,
        input: { repositoryId: "repo_live" },
      })
    ).resolves.toMatchObject({
      repositories: [
        {
          fullName: "acme-live/app",
          id: "repo_live",
          imported: true,
          watchedPathGlobs: null,
        },
      ],
      repositoriesError: null,
      status: "bound",
    });

    expect(deps.insertWatchedSourceControlRepository).toHaveBeenCalledWith(
      expect.anything(),
      {
        fullName: "acme-live/app",
        orgSourceControlBindingId: 3,
        providerRepositoryId: "repo_live",
        syncStatus: "disabled",
        watchedPathGlobs: null,
      }
    );
  });

  it("rejects the .lightfast setup repository before checking GitHub", async () => {
    deps.getActiveOrgBinding.mockResolvedValue(activeBinding());

    await expect(
      importSourceControlRepositoryCommand.run({
        ctx: adminCtx,
        deps,
        input: { repositoryId: "repo_lightfast" },
      })
    ).rejects.toMatchObject({
      code: "SOURCE_CONTROL_LIGHTFAST_REPOSITORY",
      kind: "conflict",
      message: ".lightfast is setup infrastructure and cannot be added here.",
    });

    expect(deps.createGitHubAppJwt).not.toHaveBeenCalled();
    expect(deps.listAllGitHubInstallationRepositories).not.toHaveBeenCalled();
    expect(deps.insertWatchedSourceControlRepository).not.toHaveBeenCalled();
  });
});
