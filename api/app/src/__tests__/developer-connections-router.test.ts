import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";

const listDeveloperConnectionsForOrgMock = vi.fn();
const connectDeveloperConnectionMock = vi.fn();
const completeSentryDeveloperConnectionAuthMock = vi.fn();
const setDeveloperConnectionSandboxEnabledMock = vi.fn();
const disconnectDeveloperConnectionMock = vi.fn();
const isDeveloperConnectionsEnabledMock = vi.fn();
const startSentryDeveloperConnectionAuthMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));

vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    ({ next }: { next: () => unknown }) =>
      next(),
}));

vi.mock("../services/developer-connections", () => ({
  connectDeveloperConnection: connectDeveloperConnectionMock,
  completeSentryDeveloperConnectionAuth:
    completeSentryDeveloperConnectionAuthMock,
  disconnectDeveloperConnection: disconnectDeveloperConnectionMock,
  listDeveloperConnectionsForOrg: listDeveloperConnectionsForOrgMock,
  setDeveloperConnectionSandboxEnabled:
    setDeveloperConnectionSandboxEnabledMock,
  startSentryDeveloperConnectionAuth: startSentryDeveloperConnectionAuthMock,
}));

vi.mock("../feature-flags", () => ({
  isDeveloperConnectionsEnabled: isDeveloperConnectionsEnabledMock,
}));

const { createCallerFactory, createTRPCRouter } = await import("../trpc");
const { developerConnectionsRouter } = await import(
  "../router/(pending-not-allowed)/developer-connections"
);

const testRouter = createTRPCRouter({
  developerConnections: developerConnectionsRouter,
});
const createCaller = createCallerFactory(testRouter);

const activeIdentity = {
  orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
  orgId: "org_acme",
  type: "active",
  userId: "user_current",
} satisfies AuthIdentity;

function adminAccess() {
  return {
    has: ({ role }: { role?: string }) => role === "org:admin",
    kind: "clerk-session" as const,
    orgId: "org_acme",
    userId: "user_current",
  };
}

function nonAdminAccess() {
  return { ...adminAccess(), has: () => false };
}

function caller(access = adminAccess()) {
  return createCaller({
    auth: { access, identity: activeIdentity },
    db: {} as Database,
    headers: new Headers(),
  });
}

describe("developerConnectionsRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isDeveloperConnectionsEnabledMock.mockResolvedValue(true);
    listDeveloperConnectionsForOrgMock.mockResolvedValue([
      { provider: "sentry", canManage: false, connection: null },
    ]);
    connectDeveloperConnectionMock.mockResolvedValue({
      provider: "sentry",
      status: "connected",
    });
    startSentryDeveloperConnectionAuthMock.mockResolvedValue({
      attemptId: "auth_attempt_1",
      expiresAt: new Date("2026-06-03T00:05:00.000Z"),
      userCode: "ABCD-EFGH",
      verificationUri: "https://sentry.io/account/settings/auth-tokens/",
    });
    completeSentryDeveloperConnectionAuthMock.mockResolvedValue({
      provider: "sentry",
      status: "connected",
    });
    setDeveloperConnectionSandboxEnabledMock.mockResolvedValue({
      enabled: false,
    });
    disconnectDeveloperConnectionMock.mockResolvedValue({ disconnected: true });
  });

  it("allows non-admin members to list developer connections", async () => {
    await expect(
      caller(nonAdminAccess()).developerConnections.list()
    ).resolves.toEqual([expect.objectContaining({ provider: "sentry" })]);
  });

  it("hides developer connections procedures when the feature flag is disabled", async () => {
    isDeveloperConnectionsEnabledMock.mockResolvedValue(false);

    await expect(caller().developerConnections.list()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(listDeveloperConnectionsForOrgMock).not.toHaveBeenCalled();
  });

  it("does not expose public lease materialization on the workspace router", () => {
    expect("issueLease" in developerConnectionsRouter._def.procedures).toBe(
      false
    );
  });

  it("rejects management mutations for non-admin members", async () => {
    await expect(
      caller(nonAdminAccess()).developerConnections.connect({
        provider: "sentry",
        providerAccountName: "lightfast/app",
        token: "token",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      caller(nonAdminAccess()).developerConnections.setSandboxEnabled({
        provider: "sentry",
        enabled: false,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      caller(nonAdminAccess()).developerConnections.disconnect({
        provider: "sentry",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      caller(nonAdminAccess()).developerConnections.startSentryAuth({
        provider: "sentry",
        providerAccountName: "lightfast/app",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      caller(nonAdminAccess()).developerConnections.completeSentryAuth({
        provider: "sentry",
        attemptId: "auth_attempt_1",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("routes admin mutations to services", async () => {
    await expect(
      caller().developerConnections.connect({
        provider: "sentry",
        providerAccountName: "lightfast/app",
        token: "token",
      })
    ).resolves.toEqual({ provider: "sentry", status: "connected" });

    await expect(
      caller().developerConnections.setSandboxEnabled({
        provider: "sentry",
        enabled: false,
      })
    ).resolves.toEqual({ enabled: false });

    await expect(
      caller().developerConnections.disconnect({ provider: "sentry" })
    ).resolves.toEqual({ disconnected: true });

    await expect(
      caller().developerConnections.startSentryAuth({
        provider: "sentry",
        providerAccountName: "lightfast/app",
      })
    ).resolves.toMatchObject({ attemptId: "auth_attempt_1" });

    await expect(
      caller().developerConnections.completeSentryAuth({
        provider: "sentry",
        attemptId: "auth_attempt_1",
      })
    ).resolves.toEqual({ provider: "sentry", status: "connected" });
  });
});
