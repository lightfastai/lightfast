import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthAccess, AuthIdentity } from "../auth/identity";

const getActiveOrgBindingMock = vi.fn();
const getWatchedSourceControlRepositoryMock = vi.fn();
const insertWatchedSourceControlRepositoryMock = vi.fn();
const listWatchedSourceControlRepositoriesMock = vi.fn();
const createGitHubAppJwtMock = vi.fn();
const createGitHubInstallationTokenMock = vi.fn();
const getGitHubAppInstallationMock = vi.fn();
const listGitHubInstallationRepositoriesMock = vi.fn();
const getGitHubAppConfigMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  getActiveOrgBinding: getActiveOrgBindingMock,
  getWatchedSourceControlRepository: getWatchedSourceControlRepositoryMock,
  insertWatchedSourceControlRepository:
    insertWatchedSourceControlRepositoryMock,
  listWatchedSourceControlRepositories:
    listWatchedSourceControlRepositoriesMock,
}));

vi.mock("@repo/github-app-node", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@repo/github-app-node")>();
  return {
    ...actual,
    createGitHubAppJwt: createGitHubAppJwtMock,
    createGitHubInstallationToken: createGitHubInstallationTokenMock,
    getGitHubAppInstallation: getGitHubAppInstallationMock,
    listGitHubInstallationRepositories: listGitHubInstallationRepositoriesMock,
  };
});

vi.mock("../services/github/config", () => ({
  getGitHubAppConfig: getGitHubAppConfigMock,
}));

vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));

vi.mock("@vendor/clerk/server", () => ({
  auth: vi.fn(),
  clerkClient: vi.fn(),
}));

vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    ({ next }: { next: () => unknown }) =>
      next(),
}));

const { createCallerFactory, createTRPCRouter } = await import("../trpc");
const { orgSourceControlRouter } = await import(
  "../router/(pending-not-allowed)/org-source-control"
);

const testRouter = createTRPCRouter({
  org: createTRPCRouter({
    settings: createTRPCRouter({
      sourceControl: orgSourceControlRouter,
    }),
  }),
});
const createCaller = createCallerFactory(testRouter);

function activeIdentity(overrides: Partial<AuthIdentity> = {}): AuthIdentity {
  return {
    type: "active",
    userId: "user_test",
    orgId: "org_acme",
    orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
    ...overrides,
  } as AuthIdentity;
}

function activeBinding(overrides: Record<string, unknown> = {}) {
  const connectedAt = new Date("2026-05-29T01:02:03.000Z");
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
    fullName: "acme/app",
    id: "repo_live",
    name: "app",
    ownerId: "987654",
    ownerLogin: "acme",
    private: true,
    ...overrides,
  };
}

const pendingIdentity: AuthIdentity = {
  type: "pending",
  userId: "user_test",
};

const unauthenticatedIdentity: AuthIdentity = {
  type: "unauthenticated",
};

function caller(identity = activeIdentity()) {
  return createCaller({
    auth: { identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

function adminCaller(identity = activeIdentity()) {
  const access: AuthAccess = {
    has: ({ role }) => role === "org:admin",
    kind: "clerk-session",
    orgId: identity.type === "active" ? identity.orgId : null,
    userId: identity.type === "active" ? identity.userId : "user_test",
  };
  return createCaller({
    auth: { access, identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

beforeEach(() => {
  getActiveOrgBindingMock.mockReset();
  getWatchedSourceControlRepositoryMock.mockReset();
  insertWatchedSourceControlRepositoryMock.mockReset();
  listWatchedSourceControlRepositoriesMock.mockReset();
  createGitHubAppJwtMock.mockReset();
  createGitHubInstallationTokenMock.mockReset();
  getGitHubAppInstallationMock.mockReset();
  listGitHubInstallationRepositoriesMock.mockReset();
  getGitHubAppConfigMock.mockReset();

  createGitHubAppJwtMock.mockResolvedValue("app.jwt");
  createGitHubInstallationTokenMock.mockResolvedValue({
    expiresAt: "2026-05-29T02:02:03.000Z",
    token: "installation.token",
  });
  getGitHubAppConfigMock.mockReturnValue({
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
  });
});

describe("org.settings.sourceControl.get", () => {
  it("rejects pending identities before loading binding data", async () => {
    await expect(
      caller(pendingIdentity).org.settings.sourceControl.get()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(getActiveOrgBindingMock).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated identities before loading binding data", async () => {
    await expect(
      caller(unauthenticatedIdentity).org.settings.sourceControl.get()
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(getActiveOrgBindingMock).not.toHaveBeenCalled();
  });

  it("returns an empty read-only connection when the active org is unbound", async () => {
    getActiveOrgBindingMock.mockResolvedValue(undefined);

    await expect(caller().org.settings.sourceControl.get()).resolves.toEqual({
      binding: null,
      status: "unbound",
    });

    expect(getActiveOrgBindingMock).toHaveBeenCalledWith(
      expect.anything(),
      "org_acme"
    );
  });

  it("returns the active source-control binding with matching .lightfast proof", async () => {
    const binding = activeBinding();
    getActiveOrgBindingMock.mockResolvedValue(binding);
    listWatchedSourceControlRepositoriesMock.mockResolvedValue([
      watchedRepository(),
      watchedRepository({
        fullName: "acme/.lightfast",
        id: 11,
        providerRepositoryId: "repo_lightfast",
      }),
    ]);

    await expect(caller().org.settings.sourceControl.get()).resolves.toEqual({
      binding: {
        accountLogin: "acme",
        connectedAt: binding.connectedAt,
        importedRepositoryCount: 1,
        lightfastRepository: {
          fullName: "acme/.lightfast",
          id: "repo_lightfast",
          verifiedAt: new Date("2026-05-29T01:02:03.000Z"),
        },
        provider: "github",
        providerLabel: "GitHub",
      },
      status: "bound",
    });

    expect(listWatchedSourceControlRepositoriesMock).toHaveBeenCalledWith(
      expect.anything(),
      { orgSourceControlBindingId: 3 }
    );
  });
});

describe("org.settings.sourceControl.listRepositories", () => {
  it("returns live repositories merged with durable watches and excludes setup or stale rows", async () => {
    getActiveOrgBindingMock.mockResolvedValue(activeBinding());
    listWatchedSourceControlRepositoriesMock.mockResolvedValue([
      watchedRepository({
        fullName: "stale/full-name",
        providerRepositoryId: "repo_live",
        watchedPathGlobs: ["src/**"],
      }),
      watchedRepository({
        fullName: "acme/missing",
        id: 11,
        providerRepositoryId: "repo_missing",
        watchedPathGlobs: ["**"],
      }),
      watchedRepository({
        fullName: "acme/.lightfast",
        id: 12,
        providerRepositoryId: "repo_lightfast",
        watchedPathGlobs: ["skills/**"],
      }),
    ]);
    getGitHubAppInstallationMock.mockResolvedValue({
      account: { id: "987654", login: "acme-live", type: "Organization" },
      htmlUrl:
        "https://github.lightfast.localhost/apps/lightfast-test/installations/1001",
      id: "1001",
      targetType: "Organization",
    });
    listGitHubInstallationRepositoriesMock.mockResolvedValue({
      repositories: [
        liveRepository({ fullName: "acme-live/app", ownerLogin: "acme-live" }),
        liveRepository({
          fullName: "acme-live/.lightfast",
          id: "repo_lightfast",
          name: ".lightfast",
          ownerLogin: "acme-live",
        }),
        liveRepository({
          fullName: "other/foreign",
          id: "repo_foreign",
          ownerId: "111",
          ownerLogin: "other",
        }),
      ],
      totalCount: 3,
    });

    const result = await caller().org.settings.sourceControl.listRepositories();

    expect(result).toEqual({
      binding: {
        accountLogin: "acme",
        connectedAt: activeBinding().connectedAt,
        importedRepositoryCount: 2,
        lightfastRepository: {
          fullName: "acme/.lightfast",
          id: "repo_lightfast",
          verifiedAt: new Date("2026-05-29T01:02:03.000Z"),
        },
        provider: "github",
        providerLabel: "GitHub",
      },
      organization: {
        id: "987654",
        installationManageUrl:
          "https://github.lightfast.localhost/apps/lightfast-test/installations/1001",
        login: "acme-live",
      },
      lightfastRepository: {
        fullName: "acme/.lightfast",
        id: "repo_lightfast",
        verifiedAt: new Date("2026-05-29T01:02:03.000Z"),
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
        },
      ],
      repositoriesError: null,
      status: "bound",
    });
    expect(result.organization).not.toHaveProperty("type");

    expect(createGitHubAppJwtMock).toHaveBeenCalledWith({
      appId: "12345",
      privateKey: "test-private-key",
    });
    expect(getGitHubAppInstallationMock).toHaveBeenCalledWith({
      apiBaseUrl: "https://github.lightfast.localhost",
      apiVersion: "2022-11-28",
      appJwt: "app.jwt",
      installationId: "1001",
    });
    expect(listGitHubInstallationRepositoriesMock).toHaveBeenCalledWith({
      apiBaseUrl: "https://github.lightfast.localhost",
      apiVersion: "2022-11-28",
      installationToken: "installation.token",
      page: 1,
      perPage: 100,
    });
  });

  it("returns repository-list error without stale rows when GitHub listing fails after metadata succeeds", async () => {
    getActiveOrgBindingMock.mockResolvedValue(activeBinding());
    listWatchedSourceControlRepositoriesMock.mockResolvedValue([
      watchedRepository({ fullName: "stale/full-name" }),
    ]);
    getGitHubAppInstallationMock.mockResolvedValue({
      account: { id: "987654", login: "acme-live", type: "Organization" },
      htmlUrl:
        "https://github.lightfast.localhost/apps/lightfast-test/installations/1001",
      id: "1001",
      targetType: "Organization",
    });
    listGitHubInstallationRepositoriesMock.mockRejectedValue(
      new Error("repositories unavailable")
    );

    await expect(
      caller().org.settings.sourceControl.listRepositories()
    ).resolves.toEqual({
      binding: {
        accountLogin: "acme",
        connectedAt: activeBinding().connectedAt,
        importedRepositoryCount: 1,
        lightfastRepository: {
          fullName: "acme/.lightfast",
          id: "repo_lightfast",
          verifiedAt: new Date("2026-05-29T01:02:03.000Z"),
        },
        provider: "github",
        providerLabel: "GitHub",
      },
      organization: {
        id: "987654",
        installationManageUrl:
          "https://github.lightfast.localhost/apps/lightfast-test/installations/1001",
        login: "acme-live",
      },
      lightfastRepository: {
        fullName: "acme/.lightfast",
        id: "repo_lightfast",
        verifiedAt: new Date("2026-05-29T01:02:03.000Z"),
      },
      repositories: [],
      repositoriesError: {
        code: "github_repository_listing_failed",
        message: "GitHub repositories could not be refreshed.",
      },
      status: "bound",
    });
  });

  it("returns repository-list error when installation token creation fails after metadata succeeds", async () => {
    getActiveOrgBindingMock.mockResolvedValue(activeBinding());
    listWatchedSourceControlRepositoriesMock.mockResolvedValue([
      watchedRepository({ fullName: "stale/full-name" }),
    ]);
    getGitHubAppInstallationMock.mockResolvedValue({
      account: { id: "987654", login: "acme-live", type: "Organization" },
      htmlUrl:
        "https://github.lightfast.localhost/apps/lightfast-test/installations/1001",
      id: "1001",
      targetType: "Organization",
    });
    createGitHubInstallationTokenMock.mockRejectedValue(
      new Error("token unavailable")
    );

    await expect(
      caller().org.settings.sourceControl.listRepositories()
    ).resolves.toEqual({
      binding: {
        accountLogin: "acme",
        connectedAt: activeBinding().connectedAt,
        importedRepositoryCount: 1,
        lightfastRepository: {
          fullName: "acme/.lightfast",
          id: "repo_lightfast",
          verifiedAt: new Date("2026-05-29T01:02:03.000Z"),
        },
        provider: "github",
        providerLabel: "GitHub",
      },
      organization: {
        id: "987654",
        installationManageUrl:
          "https://github.lightfast.localhost/apps/lightfast-test/installations/1001",
        login: "acme-live",
      },
      lightfastRepository: {
        fullName: "acme/.lightfast",
        id: "repo_lightfast",
        verifiedAt: new Date("2026-05-29T01:02:03.000Z"),
      },
      repositories: [],
      repositoriesError: {
        code: "github_repository_listing_failed",
        message: "GitHub repositories could not be refreshed.",
      },
      status: "bound",
    });

    expect(listGitHubInstallationRepositoriesMock).not.toHaveBeenCalled();
  });

  it("returns metadata refresh error when installation metadata cannot be loaded", async () => {
    getActiveOrgBindingMock.mockResolvedValue(activeBinding());
    listWatchedSourceControlRepositoriesMock.mockResolvedValue([
      watchedRepository({ fullName: "stale/full-name" }),
    ]);
    getGitHubAppInstallationMock.mockRejectedValue(
      new Error("metadata unavailable")
    );

    await expect(
      caller().org.settings.sourceControl.listRepositories()
    ).resolves.toEqual({
      binding: {
        accountLogin: "acme",
        connectedAt: activeBinding().connectedAt,
        importedRepositoryCount: 1,
        lightfastRepository: {
          fullName: "acme/.lightfast",
          id: "repo_lightfast",
          verifiedAt: new Date("2026-05-29T01:02:03.000Z"),
        },
        provider: "github",
        providerLabel: "GitHub",
      },
      organization: null,
      lightfastRepository: {
        fullName: "acme/.lightfast",
        id: "repo_lightfast",
        verifiedAt: new Date("2026-05-29T01:02:03.000Z"),
      },
      repositories: [],
      repositoriesError: {
        code: "github_repository_listing_failed",
        message: "GitHub installation metadata could not be refreshed.",
      },
      status: "bound",
    });

    expect(createGitHubInstallationTokenMock).not.toHaveBeenCalled();
    expect(listGitHubInstallationRepositoriesMock).not.toHaveBeenCalled();
  });

  it("treats installation account mismatch as broken and does not mutate data", async () => {
    getActiveOrgBindingMock.mockResolvedValue(activeBinding());
    listWatchedSourceControlRepositoriesMock.mockResolvedValue([]);
    getGitHubAppInstallationMock.mockResolvedValue({
      account: { id: "moved-account", login: "renamed", type: "Organization" },
      htmlUrl:
        "https://github.lightfast.localhost/apps/lightfast-test/installations/1001",
      id: "1001",
      targetType: "Organization",
    });

    await expect(
      caller().org.settings.sourceControl.listRepositories()
    ).resolves.toEqual({
      binding: {
        accountLogin: "acme",
        connectedAt: activeBinding().connectedAt,
        importedRepositoryCount: 0,
        lightfastRepository: {
          fullName: "acme/.lightfast",
          id: "repo_lightfast",
          verifiedAt: new Date("2026-05-29T01:02:03.000Z"),
        },
        provider: "github",
        providerLabel: "GitHub",
      },
      organization: null,
      lightfastRepository: {
        fullName: "acme/.lightfast",
        id: "repo_lightfast",
        verifiedAt: new Date("2026-05-29T01:02:03.000Z"),
      },
      repositories: [],
      repositoriesError: {
        code: "github_installation_account_mismatch",
        message:
          "The connected GitHub installation no longer matches this Lightfast organization.",
      },
      status: "broken",
    });

    expect(createGitHubInstallationTokenMock).not.toHaveBeenCalled();
    expect(listGitHubInstallationRepositoriesMock).not.toHaveBeenCalled();
    expect(insertWatchedSourceControlRepositoryMock).not.toHaveBeenCalled();
  });
});

describe("org.settings.sourceControl.importRepository", () => {
  it("rejects non-admin imports", async () => {
    await expect(
      caller().org.settings.sourceControl.importRepository({
        repositoryId: "repo_live",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(getActiveOrgBindingMock).not.toHaveBeenCalled();
  });

  it("registers one repository without watch globs and with fresh GitHub fullName", async () => {
    const binding = activeBinding();
    getActiveOrgBindingMock.mockResolvedValue(binding);
    listWatchedSourceControlRepositoriesMock.mockResolvedValueOnce([
      watchedRepository({
        fullName: "acme-live/app",
        providerRepositoryId: "repo_live",
        watchedPathGlobs: null,
      }),
    ]);
    getWatchedSourceControlRepositoryMock.mockResolvedValue(undefined);
    insertWatchedSourceControlRepositoryMock.mockResolvedValue(
      watchedRepository({
        fullName: "acme-live/app",
        providerRepositoryId: "repo_live",
        watchedPathGlobs: null,
      })
    );
    getGitHubAppInstallationMock.mockResolvedValue({
      account: { id: "987654", login: "acme-live", type: "Organization" },
      htmlUrl:
        "https://github.lightfast.localhost/apps/lightfast-test/installations/1001",
      id: "1001",
      targetType: "Organization",
    });
    listGitHubInstallationRepositoriesMock.mockResolvedValue({
      repositories: [
        liveRepository({ fullName: "acme-live/app", ownerLogin: "acme-live" }),
      ],
      totalCount: 1,
    });

    await expect(
      adminCaller().org.settings.sourceControl.importRepository({
        repositoryId: "repo_live",
      })
    ).resolves.toEqual({
      binding: {
        accountLogin: "acme",
        connectedAt: binding.connectedAt,
        importedRepositoryCount: 1,
        lightfastRepository: {
          fullName: "acme/.lightfast",
          id: "repo_lightfast",
          verifiedAt: new Date("2026-05-29T01:02:03.000Z"),
        },
        provider: "github",
        providerLabel: "GitHub",
      },
      organization: {
        id: "987654",
        installationManageUrl:
          "https://github.lightfast.localhost/apps/lightfast-test/installations/1001",
        login: "acme-live",
      },
      lightfastRepository: {
        fullName: "acme/.lightfast",
        id: "repo_lightfast",
        verifiedAt: new Date("2026-05-29T01:02:03.000Z"),
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
          watchedPathGlobs: null,
        },
      ],
      repositoriesError: null,
      status: "bound",
    });

    expect(insertWatchedSourceControlRepositoryMock).toHaveBeenCalledWith(
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

  it("rejects imports before a GitHub organization is connected", async () => {
    getActiveOrgBindingMock.mockResolvedValue(undefined);

    await expect(
      adminCaller().org.settings.sourceControl.importRepository({
        repositoryId: "repo_live",
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Connect a GitHub organization before adding repositories.",
    });

    expect(createGitHubAppJwtMock).not.toHaveBeenCalled();
  });

  it("rejects imports when the active binding is not GitHub", async () => {
    getActiveOrgBindingMock.mockResolvedValue(
      activeBinding({
        provider: "gitlab",
        providerAccountId: "987654",
        providerInstallationId: "1001",
      })
    );

    await expect(
      adminCaller().org.settings.sourceControl.importRepository({
        repositoryId: "repo_live",
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Connect a GitHub organization before adding repositories.",
    });

    expect(createGitHubAppJwtMock).not.toHaveBeenCalled();
  });

  it("rejects imports when the installation account no longer matches", async () => {
    getActiveOrgBindingMock.mockResolvedValue(activeBinding());
    getGitHubAppInstallationMock.mockResolvedValue({
      account: { id: "moved-account", login: "renamed", type: "Organization" },
      htmlUrl:
        "https://github.lightfast.localhost/apps/lightfast-test/installations/1001",
      id: "1001",
      targetType: "Organization",
    });

    await expect(
      adminCaller().org.settings.sourceControl.importRepository({
        repositoryId: "repo_live",
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message:
        "The connected GitHub installation no longer matches this Lightfast organization.",
    });

    expect(createGitHubInstallationTokenMock).not.toHaveBeenCalled();
    expect(insertWatchedSourceControlRepositoryMock).not.toHaveBeenCalled();
  });

  it("rejects the .lightfast setup repository id before checking live repository access", async () => {
    getActiveOrgBindingMock.mockResolvedValue(activeBinding());
    getGitHubAppInstallationMock.mockResolvedValue({
      account: { id: "987654", login: "acme-live", type: "Organization" },
      htmlUrl:
        "https://github.lightfast.localhost/apps/lightfast-test/installations/1001",
      id: "1001",
      targetType: "Organization",
    });
    listGitHubInstallationRepositoriesMock.mockResolvedValue({
      repositories: [
        liveRepository({ fullName: "acme-live/app", ownerLogin: "acme-live" }),
      ],
      totalCount: 1,
    });

    await expect(
      adminCaller().org.settings.sourceControl.importRepository({
        repositoryId: "repo_lightfast",
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: ".lightfast is setup infrastructure and cannot be added here.",
    });

    expect(createGitHubAppJwtMock).not.toHaveBeenCalled();
    expect(listGitHubInstallationRepositoriesMock).not.toHaveBeenCalled();
    expect(getWatchedSourceControlRepositoryMock).not.toHaveBeenCalled();
    expect(insertWatchedSourceControlRepositoryMock).not.toHaveBeenCalled();
  });

  it("rejects live repositories named .lightfast with the setup message", async () => {
    getActiveOrgBindingMock.mockResolvedValue(
      activeBinding({
        metadata: {
          lightfastRepository: {
            fullName: "acme-live/.lightfast",
            id: "repo_other_lightfast",
            installationId: "1001",
            name: ".lightfast",
            verifiedAt: "2026-05-29T01:02:03.000Z",
          },
        },
      })
    );
    getGitHubAppInstallationMock.mockResolvedValue({
      account: { id: "987654", login: "acme-live", type: "Organization" },
      htmlUrl:
        "https://github.lightfast.localhost/apps/lightfast-test/installations/1001",
      id: "1001",
      targetType: "Organization",
    });
    listGitHubInstallationRepositoriesMock.mockResolvedValue({
      repositories: [
        liveRepository({
          fullName: "acme-live/.lightfast",
          id: "repo_live_lightfast",
          name: ".lightfast",
          ownerLogin: "acme-live",
        }),
      ],
      totalCount: 1,
    });

    await expect(
      adminCaller().org.settings.sourceControl.importRepository({
        repositoryId: "repo_live_lightfast",
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: ".lightfast is setup infrastructure and cannot be added here.",
    });

    expect(getWatchedSourceControlRepositoryMock).not.toHaveBeenCalled();
    expect(insertWatchedSourceControlRepositoryMock).not.toHaveBeenCalled();
  });

  it("rejects inaccessible or missing repositories with a distinct message", async () => {
    getActiveOrgBindingMock.mockResolvedValue(activeBinding());
    getGitHubAppInstallationMock.mockResolvedValue({
      account: { id: "987654", login: "acme-live", type: "Organization" },
      htmlUrl:
        "https://github.lightfast.localhost/apps/lightfast-test/installations/1001",
      id: "1001",
      targetType: "Organization",
    });
    listGitHubInstallationRepositoriesMock.mockResolvedValue({
      repositories: [
        liveRepository({ fullName: "acme-live/app", ownerLogin: "acme-live" }),
      ],
      totalCount: 1,
    });

    await expect(
      adminCaller().org.settings.sourceControl.importRepository({
        repositoryId: "repo_missing",
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message:
        "Selected repository is no longer accessible to this GitHub installation.",
    });

    expect(getWatchedSourceControlRepositoryMock).not.toHaveBeenCalled();
    expect(insertWatchedSourceControlRepositoryMock).not.toHaveBeenCalled();
  });

  it("is idempotent for already watched repositories and preserves watch policy", async () => {
    const binding = activeBinding();
    const existingWatch = watchedRepository({
      fullName: "stale/full-name",
      providerRepositoryId: "repo_live",
      watchedPathGlobs: ["src/**"],
    });
    getActiveOrgBindingMock.mockResolvedValue(binding);
    listWatchedSourceControlRepositoriesMock.mockResolvedValue([existingWatch]);
    getWatchedSourceControlRepositoryMock.mockResolvedValue(existingWatch);
    getGitHubAppInstallationMock.mockResolvedValue({
      account: { id: "987654", login: "acme-live", type: "Organization" },
      htmlUrl:
        "https://github.lightfast.localhost/apps/lightfast-test/installations/1001",
      id: "1001",
      targetType: "Organization",
    });
    listGitHubInstallationRepositoriesMock.mockResolvedValue({
      repositories: [
        liveRepository({ fullName: "acme-live/app", ownerLogin: "acme-live" }),
      ],
      totalCount: 1,
    });

    await expect(
      adminCaller().org.settings.sourceControl.importRepository({
        repositoryId: "repo_live",
      })
    ).resolves.toMatchObject({
      repositories: [
        {
          fullName: "acme-live/app",
          id: "repo_live",
          imported: true,
          watchedPathGlobs: ["src/**"],
        },
      ],
      repositoriesError: null,
      status: "bound",
    });

    expect(insertWatchedSourceControlRepositoryMock).not.toHaveBeenCalled();
  });

  it("does not expose stale .lightfast proof for another installation", async () => {
    const connectedAt = new Date("2026-05-29T01:02:03.000Z");
    getActiveOrgBindingMock.mockResolvedValue({
      clerkOrgId: "org_acme",
      connectedAt,
      connectedByUserId: "user_admin",
      createdAt: connectedAt,
      id: 3,
      metadata: {
        lightfastRepository: {
          fullName: "lightfast-emulated/.lightfast",
          id: "987",
          installationId: "old_installation",
          name: ".lightfast",
          verifiedAt: "2026-05-30T10:00:00.000Z",
        },
      },
      provider: "github",
      providerAccountId: "987654",
      providerAccountLogin: "lightfast-emulated",
      providerInstallationId: "1001",
      revokedAt: null,
      status: "active",
      updatedAt: connectedAt,
    });
    listWatchedSourceControlRepositoriesMock.mockResolvedValue([]);

    await expect(caller().org.settings.sourceControl.get()).resolves.toEqual({
      binding: expect.objectContaining({
        accountLogin: "lightfast-emulated",
        lightfastRepository: null,
      }),
      status: "bound",
    });
  });

  it("does not expose stale .lightfast proof for another account", async () => {
    const connectedAt = new Date("2026-05-29T01:02:03.000Z");
    getActiveOrgBindingMock.mockResolvedValue({
      clerkOrgId: "org_acme",
      connectedAt,
      connectedByUserId: "user_admin",
      createdAt: connectedAt,
      id: 3,
      metadata: {
        lightfastRepository: {
          fullName: "other-owner/.lightfast",
          id: "987",
          installationId: "1001",
          name: ".lightfast",
          verifiedAt: "2026-05-30T10:00:00.000Z",
        },
      },
      provider: "github",
      providerAccountId: "987654",
      providerAccountLogin: "lightfast-emulated",
      providerInstallationId: "1001",
      revokedAt: null,
      status: "active",
      updatedAt: connectedAt,
    });
    listWatchedSourceControlRepositoriesMock.mockResolvedValue([]);

    await expect(caller().org.settings.sourceControl.get()).resolves.toEqual({
      binding: expect.objectContaining({
        accountLogin: "lightfast-emulated",
        lightfastRepository: null,
      }),
      status: "bound",
    });
  });
});
