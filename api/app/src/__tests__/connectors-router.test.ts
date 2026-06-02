import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";

const listConnectorsForOrgMock = vi.fn();
const startConnectorOAuthMock = vi.fn();
const refreshConnectorToolsMock = vi.fn();
const setConnectorAutomationEnabledMock = vi.fn();
const disconnectConnectorMock = vi.fn();

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

vi.mock("../services/connectors", () => ({
  disconnectConnector: disconnectConnectorMock,
  listConnectorsForOrg: listConnectorsForOrgMock,
  refreshConnectorTools: refreshConnectorToolsMock,
  setConnectorAutomationEnabled: setConnectorAutomationEnabledMock,
  startConnectorOAuth: startConnectorOAuthMock,
}));

const { createCallerFactory, createTRPCRouter } = await import("../trpc");
const { connectorsRouter } = await import(
  "../router/(pending-not-allowed)/connectors"
);

const testRouter = createTRPCRouter({
  connectors: connectorsRouter,
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
  return {
    ...adminAccess(),
    has: () => false,
  };
}

function caller(access = adminAccess()) {
  return createCaller({
    auth: { access, identity: activeIdentity },
    db: {} as Database,
    headers: new Headers(),
  });
}

describe("connectorsRouter", () => {
  beforeEach(() => {
    listConnectorsForOrgMock.mockReset();
    startConnectorOAuthMock.mockReset();
    refreshConnectorToolsMock.mockReset();
    setConnectorAutomationEnabledMock.mockReset();
    disconnectConnectorMock.mockReset();

    listConnectorsForOrgMock.mockResolvedValue([
      {
        canManage: false,
        catalogStatus: "available",
        connectAvailability: { status: "available" },
        connection: null,
        displayName: "Linear",
        provider: "linear",
      },
    ]);
    startConnectorOAuthMock.mockResolvedValue({
      authorizationUrl: "https://linear.test/oauth/authorize",
      mode: "connect",
    });
    refreshConnectorToolsMock.mockResolvedValue({ refreshed: true });
    setConnectorAutomationEnabledMock.mockResolvedValue({ enabled: true });
    disconnectConnectorMock.mockResolvedValue({ disconnected: true });
  });

  it("allows non-admin org members to list connectors", async () => {
    await expect(caller(nonAdminAccess()).connectors.list()).resolves.toEqual([
      expect.objectContaining({
        canManage: false,
        connectAvailability: { status: "available" },
        provider: "linear",
      }),
    ]);

    expect(listConnectorsForOrgMock).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: expect.objectContaining({
          identity: expect.objectContaining({ orgId: "org_acme" }),
        }),
      })
    );
  });

  it("rejects connector mutations for non-admin org members", async () => {
    await expect(
      caller(nonAdminAccess()).connectors.startConnect({ provider: "linear" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller(nonAdminAccess()).connectors.refreshTools({ provider: "linear" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller(nonAdminAccess()).connectors.setAutomationEnabled({
        enabled: true,
        provider: "linear",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller(nonAdminAccess()).connectors.disconnect({ provider: "linear" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(startConnectorOAuthMock).not.toHaveBeenCalled();
    expect(refreshConnectorToolsMock).not.toHaveBeenCalled();
    expect(setConnectorAutomationEnabledMock).not.toHaveBeenCalled();
    expect(disconnectConnectorMock).not.toHaveBeenCalled();
  });

  it("routes admin mutations to connector services", async () => {
    await expect(
      caller().connectors.startConnect({ provider: "linear" })
    ).resolves.toEqual({
      authorizationUrl: "https://linear.test/oauth/authorize",
      mode: "connect",
    });
    await expect(
      caller().connectors.refreshTools({ provider: "linear" })
    ).resolves.toEqual({ refreshed: true });
    await expect(
      caller().connectors.setAutomationEnabled({
        enabled: true,
        provider: "linear",
      })
    ).resolves.toEqual({ enabled: true });
    await expect(
      caller().connectors.disconnect({ provider: "linear" })
    ).resolves.toEqual({ disconnected: true });
  });
});
