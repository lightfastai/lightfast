import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";

const listConnectorsForOrgMock = vi.fn();
const startConnectorOAuthMock = vi.fn();
const refreshConnectorToolsMock = vi.fn();
const setConnectorAutomationEnabledMock = vi.fn();
const setConnectorAgentEnabledMock = vi.fn();
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
  setConnectorAgentEnabled: setConnectorAgentEnabledMock,
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

const xSetupIdentity = {
  ...activeIdentity,
  orgGate: { bindingStatus: "unbound", nextSetupRequirement: "x_connector" },
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

function caller(
  access = adminAccess(),
  identity: AuthIdentity = activeIdentity
) {
  return createCaller({
    auth: { access, identity },
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
    setConnectorAgentEnabledMock.mockReset();
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
    setConnectorAgentEnabledMock.mockResolvedValue({ enabled: true });
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
      (
        caller(nonAdminAccess()).connectors as unknown as {
          setAgentEnabled: (input: {
            enabled: boolean;
            provider: "linear";
          }) => Promise<unknown>;
        }
      ).setAgentEnabled({
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
    expect(setConnectorAgentEnabledMock).not.toHaveBeenCalled();
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
      (
        caller().connectors as unknown as {
          setAgentEnabled: (input: {
            enabled: boolean;
            provider: "linear";
          }) => Promise<unknown>;
        }
      ).setAgentEnabled({
        enabled: true,
        provider: "linear",
      })
    ).resolves.toEqual({ enabled: true });
    await expect(
      caller().connectors.disconnect({ provider: "linear" })
    ).resolves.toEqual({ disconnected: true });

    expect(setConnectorAgentEnabledMock).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: expect.objectContaining({
          identity: expect.objectContaining({ orgId: "org_acme" }),
        }),
      }),
      { enabled: true, provider: "linear" }
    );

    await expect(
      caller().connectors.startConnect({ provider: "x" })
    ).resolves.toEqual({
      authorizationUrl: "https://linear.test/oauth/authorize",
      mode: "connect",
    });
    await expect(
      caller().connectors.refreshTools({ provider: "x" })
    ).resolves.toEqual({ refreshed: true });
    await expect(
      caller().connectors.setAutomationEnabled({
        enabled: true,
        provider: "x",
      })
    ).resolves.toEqual({ enabled: true });
    await expect(
      caller().connectors.disconnect({ provider: "x" })
    ).resolves.toEqual({ disconnected: true });

    expect(startConnectorOAuthMock).toHaveBeenCalledWith(expect.anything(), {
      provider: "x",
    });
    expect(refreshConnectorToolsMock).toHaveBeenCalledWith(expect.anything(), {
      provider: "x",
    });
    expect(setConnectorAutomationEnabledMock).toHaveBeenCalledWith(
      expect.anything(),
      { enabled: true, provider: "x" }
    );
    expect(disconnectConnectorMock).toHaveBeenCalledWith(expect.anything(), {
      provider: "x",
    });
  });

  it("preserves connector scope status fields in list results", async () => {
    listConnectorsForOrgMock.mockResolvedValueOnce([
      {
        canManage: true,
        catalogStatus: "available",
        connectAvailability: { status: "available" },
        connection: {
          missingScopes: ["tweet.write"],
          scopeStatus: "missing_requested_scopes",
        },
        displayName: "X",
        provider: "x",
      },
    ]);

    await expect(caller().connectors.list()).resolves.toEqual([
      expect.objectContaining({
        connection: expect.objectContaining({
          missingScopes: ["tweet.write"],
          scopeStatus: "missing_requested_scopes",
        }),
        provider: "x",
      }),
    ]);
  });

  it("allows X setup to list connectors and start X OAuth before the org is bound", async () => {
    await expect(
      caller(adminAccess(), xSetupIdentity).connectors.list()
    ).resolves.toEqual([expect.objectContaining({ provider: "linear" })]);

    await expect(
      caller(adminAccess(), xSetupIdentity).connectors.startConnect({
        provider: "x",
      })
    ).resolves.toEqual({
      authorizationUrl: "https://linear.test/oauth/authorize",
      mode: "connect",
    });

    expect(listConnectorsForOrgMock).toHaveBeenCalled();
    expect(startConnectorOAuthMock).toHaveBeenCalledWith(expect.anything(), {
      provider: "x",
    });
  });
});
