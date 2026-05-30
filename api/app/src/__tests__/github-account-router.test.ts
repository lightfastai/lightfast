import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";

const getGitHubUserAccountStatusMock = vi.fn();
const startGitHubUserAccountBindingMock = vi.fn();
const disconnectGitHubUserAccountMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));

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

vi.mock("../services/github", () => ({
  disconnectGitHubUserAccount: disconnectGitHubUserAccountMock,
  getGitHubUserAccountStatus: getGitHubUserAccountStatusMock,
  startGitHubUserAccountBinding: startGitHubUserAccountBindingMock,
}));

const { appRouter } = await import("../root");
const { createCallerFactory } = await import("../trpc");

const createCaller = createCallerFactory(appRouter);

const pendingIdentity: AuthIdentity = {
  type: "pending",
  userId: "user_test",
};

const unauthenticatedIdentity: AuthIdentity = {
  type: "unauthenticated",
};

function caller(identity: AuthIdentity = pendingIdentity) {
  return createCaller({
    auth:
      identity.type === "unauthenticated"
        ? { identity }
        : {
            access: {
              has: () => false,
              kind: "clerk-session" as const,
              orgId: identity.type === "active" ? identity.orgId : null,
              userId: identity.userId,
            },
            identity,
          },
    db: {} as Database,
    headers: new Headers(),
  });
}

describe("viewer.githubAccount", () => {
  beforeEach(() => {
    getGitHubUserAccountStatusMock.mockReset();
    startGitHubUserAccountBindingMock.mockReset();
    disconnectGitHubUserAccountMock.mockReset();
  });

  it("status uses the current signed-in user's id and returns service result", async () => {
    const serviceResult = {
      account: {
        accessTokenExpiresAt: new Date("2026-01-01T00:00:00.000Z"),
        connectedAt: new Date("2025-01-01T00:00:00.000Z"),
        provider: "github" as const,
        providerUserId: "12345",
        refreshTokenExpiresAt: new Date("2026-06-01T00:00:00.000Z"),
        status: "active" as const,
      },
    };
    getGitHubUserAccountStatusMock.mockResolvedValue(serviceResult);

    const result = await caller().viewer.githubAccount.status();

    expect(result).toBe(serviceResult);
    expect(getGitHubUserAccountStatusMock).toHaveBeenCalledWith({
      clerkUserId: "user_test",
    });
  });

  it("start returns authorizationUrl and passes lightfastUserId with returnTo", async () => {
    startGitHubUserAccountBindingMock.mockResolvedValue({
      authorizationUrl: "https://github.example.com/login/oauth/authorize",
    });

    const result = await caller().viewer.githubAccount.start({
      returnTo: "/settings/account",
    });

    expect(result).toEqual({
      authorizationUrl: "https://github.example.com/login/oauth/authorize",
    });
    expect(startGitHubUserAccountBindingMock).toHaveBeenCalledWith({
      lightfastUserId: "user_test",
      returnTo: "/settings/account",
    });
  });

  it("sync returns current status and passes clerkUserId", async () => {
    const serviceResult = { account: null };
    getGitHubUserAccountStatusMock.mockResolvedValue(serviceResult);

    const result = await caller().viewer.githubAccount.sync();

    expect(result).toBe(serviceResult);
    expect(getGitHubUserAccountStatusMock).toHaveBeenCalledWith({
      clerkUserId: "user_test",
    });
  });

  it("disconnect passes clerkUserId and returns ok", async () => {
    disconnectGitHubUserAccountMock.mockResolvedValue({ ok: true });

    const result = await caller().viewer.githubAccount.disconnect();

    expect(result).toEqual({ ok: true });
    expect(disconnectGitHubUserAccountMock).toHaveBeenCalledWith({
      clerkUserId: "user_test",
    });
  });

  it("rejects an external returnTo before starting binding", async () => {
    await expect(
      caller().viewer.githubAccount.start({
        returnTo: "https://evil.example.com/settings",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(startGitHubUserAccountBindingMock).not.toHaveBeenCalled();
  });

  it("rejects a too-long returnTo before starting binding", async () => {
    await expect(
      caller().viewer.githubAccount.start({
        returnTo: `/${"a".repeat(512)}`,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(startGitHubUserAccountBindingMock).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers before service calls", async () => {
    await expect(
      caller(unauthenticatedIdentity).viewer.githubAccount.status()
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(getGitHubUserAccountStatusMock).not.toHaveBeenCalled();
    expect(startGitHubUserAccountBindingMock).not.toHaveBeenCalled();
    expect(disconnectGitHubUserAccountMock).not.toHaveBeenCalled();
  });
});
