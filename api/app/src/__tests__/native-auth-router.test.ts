import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const clerkGetUserMock = vi.fn();
const clerkGetOrganizationMembershipListMock = vi.fn();
const isOrgBoundMock = vi.fn();
const issueNativeAuthAttemptMock = vi.fn();
const consumeNativeAuthAttemptMock = vi.fn();

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
        getUser: clerkGetUserMock,
      },
    }),
}));

vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    ({ next }: { next: () => unknown }) =>
      next(),
}));

vi.mock("../env", () => ({
  env: {
    CLERK_CLI_OAUTH_CLIENT_ID: "cli_client_test",
    CLERK_DESKTOP_OAUTH_CLIENT_ID: "desktop_client_test",
    VERCEL_ENV: "development",
  },
}));

vi.mock("../auth/native-auth-attempts", () => ({
  consumeNativeAuthAttempt: consumeNativeAuthAttemptMock,
  issueNativeAuthAttempt: issueNativeAuthAttemptMock,
}));

const { createCallerFactory, createTRPCRouter } = await import("../trpc");
const { nativeAuthRouter } = await import(
  "../router/(pending-allowed)/native-auth"
);

const testRouter = createTRPCRouter({
  native: createTRPCRouter({ auth: nativeAuthRouter }),
});
const createCaller = createCallerFactory(testRouter);

function makeCaller(
  access:
    | {
        client: "cli" | "desktop";
        clientId: string;
        kind: "clerk-oauth";
        scopes: string[];
        userId: string;
      }
    | { kind: "clerk-session"; userId: string; orgId: string | null }
    | null
) {
  return createCaller({
    auth: {
      access: access
        ? access.kind === "clerk-session"
          ? { ...access, has: () => false }
          : access
        : undefined,
      identity: { type: "pending", userId: "user_1" },
    },
    db: {} as Database,
    headers: new Headers(),
  });
}

describe("nativeAuthRouter", () => {
  beforeEach(() => {
    clerkGetUserMock.mockReset();
    clerkGetOrganizationMembershipListMock.mockReset();
    issueNativeAuthAttemptMock.mockReset();
    consumeNativeAuthAttemptMock.mockReset();
    isOrgBoundMock.mockReset();
    isOrgBoundMock.mockImplementation(
      async (_db: Database, orgId: string) => orgId === "org_1"
    );
    clerkGetUserMock.mockResolvedValue({
      emailAddresses: [
        { emailAddress: "dev@example.com", id: "email_primary" },
      ],
      primaryEmailAddressId: "email_primary",
    });
    clerkGetOrganizationMembershipListMock.mockResolvedValue({
      data: [
        {
          organization: { id: "org_1", name: "Acme", slug: "acme" },
          role: "org:admin",
        },
        {
          organization: { id: "org_2", name: "Beta", slug: null },
          role: "org:member",
        },
      ],
    });
  });

  it("returns native OAuth config for CLI and desktop", async () => {
    await expect(
      makeCaller(null).native.auth.oauthConfig({ client: "cli" })
    ).resolves.toMatchObject({
      client: "cli",
      clientId: "cli_client_test",
      supportsDynamicLoopbackPort: true,
    });
    await expect(
      makeCaller(null).native.auth.oauthConfig({ client: "desktop" })
    ).resolves.toMatchObject({
      client: "desktop",
      clientId: "desktop_client_test",
      supportsDynamicLoopbackPort: true,
    });
  });

  it("creates attempts only for user organization memberships", async () => {
    issueNativeAuthAttemptMock.mockResolvedValue({
      attemptId: "attempt_123456789",
      state: "state_1234567890123",
    });

    await expect(
      makeCaller({
        kind: "clerk-session",
        orgId: null,
        userId: "user_1",
      }).native.auth.createAttempt({
        client: "cli",
        codeChallenge: "a".repeat(43),
        codeChallengeMethod: "S256",
        organizationId: "org_1",
        redirectUri: "http://127.0.0.1:51010/callback",
        stateNonce: "nonce_1234567890",
      })
    ).resolves.toMatchObject({
      attemptId: "attempt_123456789",
      authorizationUrl: expect.stringContaining("code_challenge="),
    });

    await expect(
      makeCaller({
        kind: "clerk-session",
        orgId: null,
        userId: "user_1",
      }).native.auth.createAttempt({
        client: "cli",
        codeChallenge: "a".repeat(43),
        codeChallengeMethod: "S256",
        organizationId: "org_missing",
        redirectUri: "http://127.0.0.1:51010/callback",
        stateNonce: "nonce_1234567890",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("finalizes a consumed attempt into org-bound native metadata", async () => {
    consumeNativeAuthAttemptMock.mockResolvedValue({
      client: "desktop",
      codeChallenge: "a".repeat(43),
      codeChallengeMethod: "S256",
      organizationId: "org_1",
      redirectUri: "http://127.0.0.1:51010/callback",
      stateHash: "hash",
      userId: "user_1",
    });

    await expect(
      makeCaller({
        client: "desktop",
        clientId: "desktop_client_test",
        kind: "clerk-oauth",
        scopes: ["openid", "profile", "email"],
        userId: "user_1",
      }).native.auth.finalize({
        attemptId: "attempt_123456789",
        client: "desktop",
        state: "state_1234567890123",
      })
    ).resolves.toEqual({
      client: "desktop",
      organization: { id: "org_1", name: "Acme", slug: "acme" },
      user: { email: "dev@example.com", id: "user_1" },
    });
  });
});
