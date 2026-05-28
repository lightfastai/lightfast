import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const clerkGetOrganizationMembershipListMock = vi.fn();
const isOrgBoundMock = vi.fn();
const mirrorOrgBindingMock = vi.fn();
const nanoidMock = vi.fn();
const redisSetMock = vi.fn();
const redisGetdelMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("@db/app", () => ({
  isOrgBound: isOrgBoundMock,
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

vi.mock("../auth/org-binding-mirror", () => ({
  mirrorOrgBinding: mirrorOrgBindingMock,
}));

vi.mock("../env", () => ({
  env: {
    GITHUB_API_VERSION: "2022-11-28",
    GITHUB_APP_CLIENT_ID: "github_client_test",
    GITHUB_APP_CLIENT_SECRET: "github_secret_test",
    GITHUB_APP_ID: "12345",
    GITHUB_APP_PRIVATE_KEY: "test-private-key",
    GITHUB_APP_SLUG: "lightfast-test",
    GITHUB_INSTALL_URL_OVERRIDE:
      "https://app.lightfast.localhost/api/dev/github/install?emulator_origin=http%3A%2F%2F127.0.0.1%3A4567&installation_id=1001&provider_account_login=lightfast-emulated",
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
    identityOrgId?: string;
    isAdmin?: boolean;
  } = {}
) {
  return createCaller({
    auth: {
      access: {
        has: ({ role }: { role?: string }) =>
          (input.isAdmin ?? true) ? role === "org:admin" : false,
        kind: "clerk-session",
        orgId: input.accessOrgId === undefined ? "org_1" : input.accessOrgId,
        userId: "user_1",
      },
      identity: {
        orgGate: { bindingStatus: "unbound" },
        orgId: input.identityOrgId ?? "org_1",
        type: "active",
        userId: "user_1",
      },
    },
    db: {} as Database,
    headers: new Headers(),
  });
}

describe("githubSetupRouter", () => {
  beforeEach(() => {
    clerkGetOrganizationMembershipListMock.mockReset();
    isOrgBoundMock.mockReset();
    mirrorOrgBindingMock.mockReset();
    nanoidMock.mockReset();
    redisGetdelMock.mockReset();
    redisSetMock.mockReset();

    nanoidMock
      .mockReturnValueOnce("attempt_123456789012345678901234")
      .mockReturnValueOnce("nonce_1234567890123456789012345");
    isOrgBoundMock.mockResolvedValue(false);
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

    expect(result).toEqual({
      installationUrl:
        "https://app.lightfast.localhost/api/dev/github/install?emulator_origin=http%3A%2F%2F127.0.0.1%3A4567&installation_id=1001&provider_account_login=lightfast-emulated&state=" +
        issuedState,
    });
    expect(redisSetMock).toHaveBeenCalledWith(
      "github-bind-install-attempt:attempt_123456789012345678901234",
      expect.objectContaining({
        clerkOrgId: "org_1",
        lightfastUserId: "user_1",
        orgSlug: "acme",
      }),
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

  it("rejects setup starts when the active org does not match the slug", async () => {
    await expect(
      makeCaller({ identityOrgId: "org_other" }).org.setup.github.start({
        orgSlug: "acme",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(redisSetMock).not.toHaveBeenCalled();
  });

  it("syncs the active org binding claim", async () => {
    isOrgBoundMock.mockResolvedValueOnce(true);

    await expect(
      makeCaller().org.setup.github.syncBindingClaim()
    ).resolves.toEqual({ bindingStatus: "bound" });

    expect(mirrorOrgBindingMock).toHaveBeenCalledWith({
      clerkOrgId: "org_1",
      provider: "github",
      status: "bound",
    });
  });
});
