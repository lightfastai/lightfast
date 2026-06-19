import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";
import { actorFromAuthIdentity } from "../domain";
import {
  createDefaultConnectorCommandDeps,
  disconnectConnectorCommand,
  listConnectorSectionsCommand,
  listConnectorsCommand,
  refreshConnectorToolsCommand,
  setConnectorAgentEnabledCommand,
  setConnectorAutomationEnabledCommand,
  startConnectorOAuthCommand,
} from "../domain/connectors";
import { ValidationError } from "../domain/errors";

const serviceMocks = vi.hoisted(() => ({
  disconnectConnector: vi.fn(),
  listConnectorsForOrg: vi.fn(),
  listUserConnectorsForViewer: vi.fn(),
  refreshConnectorTools: vi.fn(),
  setConnectorAgentEnabled: vi.fn(),
  setConnectorAutomationEnabled: vi.fn(),
  startConnectorOAuth: vi.fn(),
}));

vi.mock("../services/connectors", () => ({
  disconnectConnector: serviceMocks.disconnectConnector,
  listConnectorsForOrg: serviceMocks.listConnectorsForOrg,
  refreshConnectorTools: serviceMocks.refreshConnectorTools,
  setConnectorAgentEnabled: serviceMocks.setConnectorAgentEnabled,
  setConnectorAutomationEnabled: serviceMocks.setConnectorAutomationEnabled,
  startConnectorOAuth: serviceMocks.startConnectorOAuth,
}));

vi.mock("../services/user-connectors", () => ({
  listUserConnectorsForViewer: serviceMocks.listUserConnectorsForViewer,
}));

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

function ctx(input: { admin?: boolean; identity?: AuthIdentity } = {}) {
  const actor = actorFromAuthIdentity(input.identity ?? activeIdentity, "web");
  return {
    actor:
      actor.kind === "clerkUser" && input.admin
        ? { ...actor, orgRole: "admin" as const }
        : actor,
    request: { id: "req_test", source: "tanstack" as const },
  };
}

function deps() {
  return createDefaultConnectorCommandDeps({
    db: {} as Database,
    disconnectConnector: serviceMocks.disconnectConnector,
    headers: new Headers(),
    listConnectorsForOrg: serviceMocks.listConnectorsForOrg,
    listUserConnectorsForViewer: serviceMocks.listUserConnectorsForViewer,
    refreshConnectorTools: serviceMocks.refreshConnectorTools,
    setConnectorAgentEnabled: serviceMocks.setConnectorAgentEnabled,
    setConnectorAutomationEnabled: serviceMocks.setConnectorAutomationEnabled,
    startConnectorOAuth: serviceMocks.startConnectorOAuth,
  });
}

describe("connector domain commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    serviceMocks.listConnectorsForOrg.mockResolvedValue([
      {
        canManage: false,
        catalogStatus: "available",
        connectAvailability: { status: "available" },
        connection: null,
        displayName: "Linear",
        provider: "linear",
      },
    ]);
    serviceMocks.listUserConnectorsForViewer.mockResolvedValue([
      {
        canManage: true,
        catalogStatus: "available",
        connection: null,
        displayName: "Granola",
        ownerType: "user",
        provider: "granola",
      },
    ]);
    serviceMocks.startConnectorOAuth.mockResolvedValue({
      authorizationUrl: "https://linear.test/oauth/authorize",
      mode: "connect",
    });
    serviceMocks.refreshConnectorTools.mockResolvedValue({
      refreshed: true,
      status: "ok",
    });
    serviceMocks.setConnectorAutomationEnabled.mockResolvedValue({
      enabled: true,
    });
    serviceMocks.setConnectorAgentEnabled.mockResolvedValue({ enabled: true });
    serviceMocks.disconnectConnector.mockResolvedValue({ disconnected: true });
  });

  it("allows active non-admin org members to list connector sections before binding", async () => {
    await expect(
      listConnectorSectionsCommand.run({
        ctx: ctx({ identity: xSetupIdentity }),
        deps: deps(),
        input: {},
      })
    ).resolves.toEqual({
      teamConnectors: [expect.objectContaining({ provider: "linear" })],
      yourConnectors: [
        expect.objectContaining({ ownerType: "user", provider: "granola" }),
      ],
    });

    expect(serviceMocks.listConnectorsForOrg).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: expect.objectContaining({
          access: expect.objectContaining({ kind: "clerk-session" }),
          identity: expect.objectContaining({
            orgGate: expect.objectContaining({ bindingStatus: "unbound" }),
            orgId: "org_acme",
            userId: "user_current",
          }),
        }),
      })
    );
    expect(serviceMocks.listUserConnectorsForViewer).toHaveBeenCalledWith({
      db: expect.anything(),
      viewer: { userId: "user_current" },
    });
  });

  it("marks admin actors as matching Clerk-session admins for catalog canManage checks", async () => {
    await listConnectorsCommand.run({
      ctx: ctx({ admin: true }),
      deps: deps(),
      input: {},
    });

    const serviceContext = serviceMocks.listConnectorsForOrg.mock.calls[0]?.[0];
    expect(serviceContext.auth.access.has({ role: "org:admin" })).toBe(true);
  });

  it("allows org admins to start connector OAuth before binding", async () => {
    await expect(
      startConnectorOAuthCommand.run({
        ctx: ctx({ admin: true, identity: xSetupIdentity }),
        deps: deps(),
        input: { provider: "x" },
      })
    ).resolves.toEqual({
      authorizationUrl: "https://linear.test/oauth/authorize",
      mode: "connect",
    });

    expect(serviceMocks.startConnectorOAuth).toHaveBeenCalledWith(
      expect.anything(),
      { provider: "x" }
    );
  });

  it("preserves domain errors raised by connector services", async () => {
    serviceMocks.startConnectorOAuth.mockRejectedValueOnce(
      new ValidationError(
        "CONNECTOR_UNSUPPORTED_PROVIDER",
        "Unsupported connector provider: fake"
      )
    );

    await expect(
      startConnectorOAuthCommand.run({
        ctx: ctx({ admin: true, identity: xSetupIdentity }),
        deps: deps(),
        input: { provider: "x" },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "CONNECTOR_UNSUPPORTED_PROVIDER",
        kind: "validation",
      })
    );
  });

  it("rejects connector management mutations for non-admin members", async () => {
    await expect(
      refreshConnectorToolsCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { provider: "linear" },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "PERMISSION_REQUIRED",
        kind: "authz",
      })
    );

    expect(serviceMocks.refreshConnectorTools).not.toHaveBeenCalled();
  });

  it("requires bound organizations for connector management mutations", async () => {
    await expect(
      setConnectorAutomationEnabledCommand.run({
        ctx: ctx({ admin: true, identity: xSetupIdentity }),
        deps: deps(),
        input: { enabled: true, provider: "x" },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "ORG_SETUP_REQUIRED",
        kind: "authz",
      })
    );

    expect(serviceMocks.setConnectorAutomationEnabled).not.toHaveBeenCalled();
  });

  it("routes bound admin management mutations to connector services", async () => {
    await expect(
      refreshConnectorToolsCommand.run({
        ctx: ctx({ admin: true }),
        deps: deps(),
        input: { provider: "linear" },
      })
    ).resolves.toEqual({ refreshed: true, status: "ok" });
    await expect(
      setConnectorAutomationEnabledCommand.run({
        ctx: ctx({ admin: true }),
        deps: deps(),
        input: { enabled: true, provider: "linear" },
      })
    ).resolves.toEqual({ enabled: true });
    await expect(
      setConnectorAgentEnabledCommand.run({
        ctx: ctx({ admin: true }),
        deps: deps(),
        input: { enabled: true, provider: "linear" },
      })
    ).resolves.toEqual({ enabled: true });
    await expect(
      disconnectConnectorCommand.run({
        ctx: ctx({ admin: true }),
        deps: deps(),
        input: { provider: "linear" },
      })
    ).resolves.toEqual({ disconnected: true });
  });
});
