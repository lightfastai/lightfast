import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";
import { actorFromAuthIdentity } from "../domain";
import {
  type AccountCommandDeps,
  disconnectGitHubAccountCommand,
  getGitHubAccountStatusCommand,
  startGitHubAccountBindingCommand,
  syncGitHubAccountCommand,
} from "../domain/account";

const getGitHubUserAccountStatusMock = vi.fn();
const startGitHubUserAccountBindingMock = vi.fn();
const disconnectGitHubUserAccountMock = vi.fn();

const pendingIdentity: AuthIdentity = {
  type: "pending",
  userId: "user_test",
};

const unauthenticatedIdentity: AuthIdentity = {
  type: "unauthenticated",
};

function ctx(identity: AuthIdentity = pendingIdentity) {
  return {
    actor: actorFromAuthIdentity(identity, "web"),
    request: { id: "req_test", source: "tanstack" as const },
  };
}

function deps() {
  return {
    clerk: {
      users: {
        getUser: vi.fn(),
        updateUser: vi.fn(),
      },
    },
    db: {} as Database,
    deletePreClerkNamespaceReservation: vi.fn(),
    disconnectGitHubUserAccount: disconnectGitHubUserAccountMock,
    finalizeNamespaceOperation: vi.fn(),
    getGitHubUserAccountStatus: getGitHubUserAccountStatusMock,
    isClerkConflictError: vi.fn(),
    log: { error: vi.fn() },
    markNamespaceOperationClerkApplied: vi.fn(),
    parseError: (error: unknown) => error,
    reserveNamespaceForOperation: vi.fn(),
    startGitHubUserAccountBinding: startGitHubUserAccountBindingMock,
    startNamespaceOperation: vi.fn(),
  } satisfies AccountCommandDeps;
}

describe("GitHub account domain commands", () => {
  beforeEach(() => {
    getGitHubUserAccountStatusMock.mockReset();
    startGitHubUserAccountBindingMock.mockReset();
    disconnectGitHubUserAccountMock.mockReset();
  });

  it("gets status for the signed-in Clerk user without requiring an org", async () => {
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

    await expect(
      getGitHubAccountStatusCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: {},
      })
    ).resolves.toBe(serviceResult);

    expect(getGitHubUserAccountStatusMock).toHaveBeenCalledWith({
      clerkUserId: "user_test",
    });
  });

  it("starts GitHub binding for the signed-in Clerk user with a validated return path", async () => {
    startGitHubUserAccountBindingMock.mockResolvedValue({
      authorizationUrl: "https://github.example.com/login/oauth/authorize",
    });

    await expect(
      startGitHubAccountBindingCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { returnTo: "/settings/account" },
      })
    ).resolves.toEqual({
      authorizationUrl: "https://github.example.com/login/oauth/authorize",
    });

    expect(startGitHubUserAccountBindingMock).toHaveBeenCalledWith({
      lightfastUserId: "user_test",
      returnTo: "/settings/account",
    });
  });

  it("rejects unsafe return paths before starting GitHub binding", async () => {
    await expect(
      startGitHubAccountBindingCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { returnTo: "https://evil.example.com/settings" },
      })
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      kind: "validation",
    });

    expect(startGitHubUserAccountBindingMock).not.toHaveBeenCalled();
  });

  it("syncs by reading the current GitHub account status", async () => {
    const serviceResult = { account: null };
    getGitHubUserAccountStatusMock.mockResolvedValue(serviceResult);

    await expect(
      syncGitHubAccountCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: {},
      })
    ).resolves.toBe(serviceResult);

    expect(getGitHubUserAccountStatusMock).toHaveBeenCalledWith({
      clerkUserId: "user_test",
    });
  });

  it("disconnects only the signed-in Clerk user's GitHub account", async () => {
    disconnectGitHubUserAccountMock.mockResolvedValue({ ok: true });

    await expect(
      disconnectGitHubAccountCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: {},
      })
    ).resolves.toEqual({ ok: true });

    expect(disconnectGitHubUserAccountMock).toHaveBeenCalledWith({
      clerkUserId: "user_test",
    });
  });

  it("rejects unauthenticated callers before service calls", () => {
    expect(() => ctx(unauthenticatedIdentity)).toThrowError(
      expect.objectContaining({
        code: "AUTH_REQUIRED",
        kind: "authz",
      })
    );

    expect(getGitHubUserAccountStatusMock).not.toHaveBeenCalled();
    expect(startGitHubUserAccountBindingMock).not.toHaveBeenCalled();
    expect(disconnectGitHubUserAccountMock).not.toHaveBeenCalled();
  });
});
