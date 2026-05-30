import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";

const clerkGetOrganizationMembershipListMock = vi.fn();
const getActiveOrgBindingMock = vi.fn();
const mirrorOrgSetupGateMock = vi.fn();
const nanoidMock = vi.fn();
const redisSetMock = vi.fn();
const redisGetdelMock = vi.fn();
const updateOrgSourceControlBindingMetadataMock = vi.fn();
const upsertWatchedSourceControlRepositoryMock = vi.fn();
const createGitHubAppJwtMock = vi.fn();
const createGitHubInstallationTokenMock = vi.fn();
const getGitHubRepositoryMock = vi.fn();
const verifyGitHubInstallationRepositoryMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("@db/app", () => ({
  getActiveOrgBinding: getActiveOrgBindingMock,
  updateOrgSourceControlBindingMetadata:
    updateOrgSourceControlBindingMetadataMock,
  upsertWatchedSourceControlRepository:
    upsertWatchedSourceControlRepositoryMock,
}));

vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
  getClerkFrontendApi: () => "https://clerk.example.com",
}));

vi.mock("@vendor/clerk/server", () => ({
  auth: vi.fn(),
  clerkClient: () =>
    Promise.resolve({
      users: {
        getOrganizationMembershipList: clerkGetOrganizationMembershipListMock,
      },
    }),
}));

vi.mock("@vendor/lib", () => ({
  nanoid: nanoidMock,
}));

vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    ({ next }: { next: () => unknown }) =>
      next(),
}));

vi.mock("@vendor/upstash", () => ({
  redis: {
    getdel: redisGetdelMock,
    set: redisSetMock,
  },
}));

vi.mock("@repo/github-app-node", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@repo/github-app-node")>();
  return {
    ...actual,
    createGitHubAppJwt: createGitHubAppJwtMock,
    createGitHubInstallationToken: createGitHubInstallationTokenMock,
    getGitHubRepository: getGitHubRepositoryMock,
    verifyGitHubInstallationRepository: verifyGitHubInstallationRepositoryMock,
  };
});

vi.mock("../auth/org-binding-mirror", () => ({
  mirrorOrgSetupGate: mirrorOrgSetupGateMock,
}));

vi.mock("../env", () => ({
  env: {
    GITHUB_API_VERSION: "2022-11-28",
    GITHUB_APP_CLIENT_ID: "github_client_test",
    GITHUB_APP_CLIENT_SECRET: "github_secret_test",
    GITHUB_APP_ENDPOINT_ORIGIN: "https://github.lightfast.localhost",
    GITHUB_APP_ID: "12345",
    GITHUB_APP_PRIVATE_KEY: "test-private-key",
    GITHUB_APP_SLUG: "lightfast-test",
    VERCEL_ENV: "development",
  },
}));

const { createCallerFactory, createTRPCRouter } = await import("../trpc");
const { githubSetupRouter } = await import(
  "../router/(pending-not-allowed)/github-setup"
);

const testRouter = createTRPCRouter({
  org: createTRPCRouter({
    setup: createTRPCRouter({
      github: githubSetupRouter,
    }),
  }),
});
const createCaller = createCallerFactory(testRouter);

function makeCaller(
  input: {
    accessOrgId?: string | null;
    identity?: AuthIdentity;
    identityOrgId?: string;
    isAdmin?: boolean;
  } = {}
) {
  const identity =
    input.identity ??
    ({
      orgGate: { bindingStatus: "unbound", nextSetupRequirement: "github_org" },
      orgId: input.identityOrgId ?? "org_1",
      type: "active",
      userId: "user_1",
    } satisfies AuthIdentity);
  const access =
    identity.type === "unauthenticated"
      ? undefined
      : {
          has: ({ role }: { role?: string }) =>
            (input.isAdmin ?? true) ? role === "org:admin" : false,
          kind: "clerk-session" as const,
          orgId:
            input.accessOrgId === undefined
              ? identity.type === "active"
                ? identity.orgId
                : null
              : input.accessOrgId,
          userId: identity.userId,
        };

  return createCaller({
    auth: access ? { access, identity } : { identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

describe("githubSetupRouter", () => {
  beforeEach(() => {
    clerkGetOrganizationMembershipListMock.mockReset();
    getActiveOrgBindingMock.mockReset();
    mirrorOrgSetupGateMock.mockReset();
    nanoidMock.mockReset();
    redisGetdelMock.mockReset();
    redisSetMock.mockReset();
    updateOrgSourceControlBindingMetadataMock.mockReset();
    upsertWatchedSourceControlRepositoryMock.mockReset();
    createGitHubAppJwtMock.mockReset();
    createGitHubInstallationTokenMock.mockReset();
    getGitHubRepositoryMock.mockReset();
    verifyGitHubInstallationRepositoryMock.mockReset();

    nanoidMock
      .mockReturnValueOnce("attempt_123456789012345678901234")
      .mockReturnValueOnce("nonce_1234567890123456789012345");
    getActiveOrgBindingMock.mockResolvedValue(undefined);
    updateOrgSourceControlBindingMetadataMock.mockResolvedValue(true);
    upsertWatchedSourceControlRepositoryMock.mockResolvedValue({});
    createGitHubAppJwtMock.mockResolvedValue("app.jwt");
    createGitHubInstallationTokenMock.mockResolvedValue({
      expiresAt: "2026-05-30T11:00:00.000Z",
      token: "ghs_installation",
    });
    verifyGitHubInstallationRepositoryMock.mockResolvedValue({
      installationId: "1001",
      repositorySelection: "all",
    });
    getGitHubRepositoryMock.mockResolvedValue({
      fullName: "acme/.lightfast",
      id: "987",
      name: ".lightfast",
      owner: "acme",
    });
    clerkGetOrganizationMembershipListMock.mockResolvedValue({
      data: [
        {
          organization: {
            id: "org_1",
            imageUrl: "https://img.example.com/acme.png",
            name: "Acme",
            slug: "acme",
          },
          role: "org:admin",
        },
      ],
    });
  });

  it("starts a GitHub setup attempt for an admin org", async () => {
    const result = await makeCaller().org.setup.github.start({
      orgSlug: "acme",
    });

    const issuedState = new URL(result.installationUrl).searchParams.get(
      "state"
    );

    expect(result.installationUrl).toBe(
      "https://github.lightfast.localhost/apps/lightfast-test/installations/new?state=" +
        issuedState
    );
    expect(redisSetMock).toHaveBeenCalledWith(
      "github-bind-install-attempt:attempt_123456789012345678901234",
      {
        clerkOrgId: "org_1",
        lightfastUserId: "user_1",
        orgSlug: "acme",
        stateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      { ex: 900 }
    );
  });

  it("rejects non-admin setup starts", async () => {
    await expect(
      makeCaller({ isAdmin: false }).org.setup.github.start({
        orgSlug: "acme",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(redisSetMock).not.toHaveBeenCalled();
  });

  it("rejects setup starts for pending callers without an active org", async () => {
    await expect(
      makeCaller({
        accessOrgId: null,
        identity: { type: "pending", userId: "user_1" },
      }).org.setup.github.start({
        orgSlug: "acme",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(redisSetMock).not.toHaveBeenCalled();
  });

  it("rejects setup starts for unauthenticated callers", async () => {
    await expect(
      makeCaller({
        identity: { type: "unauthenticated" },
      }).org.setup.github.start({
        orgSlug: "acme",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(redisSetMock).not.toHaveBeenCalled();
  });

  it("rejects setup starts when the active org does not match the slug", async () => {
    await expect(
      makeCaller({ identityOrgId: "org_other" }).org.setup.github.start({
        orgSlug: "acme",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(redisSetMock).not.toHaveBeenCalled();
  });

  it("syncs the active org binding claim", async () => {
    getActiveOrgBindingMock.mockResolvedValueOnce({
      id: 1,
      metadata: {
        lightfastRepository: {
          fullName: "acme/.lightfast",
          id: "987",
          installationId: "1001",
          name: ".lightfast",
          verifiedAt: "2026-05-30T10:00:00.000Z",
        },
      },
      provider: "github",
      providerAccountLogin: "acme",
      providerInstallationId: "1001",
    });

    await expect(
      makeCaller().org.setup.github.syncBindingClaim()
    ).resolves.toEqual({
      bindingStatus: "bound",
      nextSetupRequirement: null,
    });

    expect(mirrorOrgSetupGateMock).toHaveBeenCalledWith({
      clerkOrgId: "org_1",
      provider: "github",
      gate: {
        bindingStatus: "bound",
        nextSetupRequirement: null,
      },
    });
  });

  it("verifies .lightfast, stores proof, watches skills, and returns a bound gate", async () => {
    getActiveOrgBindingMock.mockResolvedValueOnce({
      id: 7,
      metadata: {
        events: ["push"],
        permissions: { contents: "read" },
      },
      provider: "github",
      providerAccountLogin: "acme",
      providerInstallationId: "1001",
    });

    await expect(
      makeCaller().org.setup.github.verifyLightfastRepo()
    ).resolves.toEqual({
      bindingStatus: "bound",
      nextSetupRequirement: null,
    });

    expect(createGitHubAppJwtMock).toHaveBeenCalledWith({
      appId: "12345",
      privateKey: "test-private-key",
    });
    expect(verifyGitHubInstallationRepositoryMock).toHaveBeenCalledWith({
      apiBaseUrl: "https://github.lightfast.localhost",
      apiVersion: "2022-11-28",
      appJwt: "app.jwt",
      expectedInstallationId: "1001",
      owner: "acme",
      repo: ".lightfast",
    });
    expect(updateOrgSourceControlBindingMetadataMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        id: 7,
        metadata: expect.objectContaining({
          lightfastRepository: expect.objectContaining({
            fullName: "acme/.lightfast",
            id: "987",
            installationId: "1001",
            name: ".lightfast",
          }),
        }),
      }
    );
    expect(upsertWatchedSourceControlRepositoryMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        fullName: "acme/.lightfast",
        orgSourceControlBindingId: 7,
        providerRepositoryId: "987",
        watchedPathGlobs: ["skills/**"],
      }
    );
    expect(mirrorOrgSetupGateMock).toHaveBeenCalledWith({
      clerkOrgId: "org_1",
      provider: "github",
      gate: {
        bindingStatus: "bound",
        nextSetupRequirement: null,
      },
    });
  });
});
