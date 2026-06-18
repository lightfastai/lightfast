import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";
import { actorFromAuthIdentity } from "../domain";
import {
  completeSentryDeveloperConnectionAuthCommand,
  connectDeveloperConnectionCommand,
  createDefaultDeveloperConnectionCommandDeps,
  disconnectDeveloperConnectionCommand,
  listDeveloperConnectionsCommand,
  setDeveloperConnectionSandboxEnabledCommand,
  startSentryDeveloperConnectionAuthCommand,
} from "../domain/developer-connections";
import { ConflictError } from "../domain/errors";

const serviceMocks = vi.hoisted(() => ({
  completeSentryDeveloperConnectionAuth: vi.fn(),
  connectDeveloperConnection: vi.fn(),
  disconnectDeveloperConnection: vi.fn(),
  listDeveloperConnectionsForOrg: vi.fn(),
  setDeveloperConnectionSandboxEnabled: vi.fn(),
  startSentryDeveloperConnectionAuth: vi.fn(),
}));

vi.mock("../services/developer-connections", () => ({
  connectDeveloperConnection: serviceMocks.connectDeveloperConnection,
  completeSentryDeveloperConnectionAuth:
    serviceMocks.completeSentryDeveloperConnectionAuth,
  disconnectDeveloperConnection: serviceMocks.disconnectDeveloperConnection,
  listDeveloperConnectionsForOrg: serviceMocks.listDeveloperConnectionsForOrg,
  setDeveloperConnectionSandboxEnabled:
    serviceMocks.setDeveloperConnectionSandboxEnabled,
  startSentryDeveloperConnectionAuth:
    serviceMocks.startSentryDeveloperConnectionAuth,
}));

const activeIdentity = {
  orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
  orgId: "org_acme",
  type: "active",
  userId: "user_current",
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
  return createDefaultDeveloperConnectionCommandDeps({
    completeSentryDeveloperConnectionAuth:
      serviceMocks.completeSentryDeveloperConnectionAuth,
    connectDeveloperConnection: serviceMocks.connectDeveloperConnection,
    db: {} as Database,
    disconnectDeveloperConnection: serviceMocks.disconnectDeveloperConnection,
    headers: new Headers(),
    listDeveloperConnectionsForOrg: serviceMocks.listDeveloperConnectionsForOrg,
    setDeveloperConnectionSandboxEnabled:
      serviceMocks.setDeveloperConnectionSandboxEnabled,
    startSentryDeveloperConnectionAuth:
      serviceMocks.startSentryDeveloperConnectionAuth,
  });
}

describe("developer connection domain commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.listDeveloperConnectionsForOrg.mockResolvedValue([
      { provider: "sentry", canManage: false, connection: null },
    ]);
    serviceMocks.connectDeveloperConnection.mockResolvedValue({
      provider: "sentry",
      status: "connected",
    });
    serviceMocks.startSentryDeveloperConnectionAuth.mockResolvedValue({
      attemptId: "auth_attempt_1",
      expiresAt: new Date("2026-06-03T00:05:00.000Z"),
      userCode: "ABCD-EFGH",
      verificationUri: "https://sentry.io/account/settings/auth-tokens/",
    });
    serviceMocks.completeSentryDeveloperConnectionAuth.mockResolvedValue({
      provider: "sentry",
      status: "connected",
    });
    serviceMocks.setDeveloperConnectionSandboxEnabled.mockResolvedValue({
      enabled: false,
    });
    serviceMocks.disconnectDeveloperConnection.mockResolvedValue({
      disconnected: true,
    });
  });

  it("allows bound non-admin members to list developer connections", async () => {
    await expect(
      listDeveloperConnectionsCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: {},
      })
    ).resolves.toEqual([expect.objectContaining({ provider: "sentry" })]);

    expect(serviceMocks.listDeveloperConnectionsForOrg).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: expect.objectContaining({
          identity: expect.objectContaining({
            orgId: "org_acme",
            userId: "user_current",
          }),
        }),
      })
    );
  });

  it("requires bound organizations to list developer connections", async () => {
    await expect(
      listDeveloperConnectionsCommand.run({
        ctx: ctx({
          identity: {
            ...activeIdentity,
            orgGate: {
              bindingStatus: "unbound",
              nextSetupRequirement: "github_org",
            },
          },
        }),
        deps: deps(),
        input: {},
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "ORG_SETUP_REQUIRED",
        kind: "authz",
      })
    );
  });

  it("rejects management mutations for non-admin members", async () => {
    await expect(
      connectDeveloperConnectionCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: {
          provider: "sentry",
          providerAccountName: "lightfast/app",
          token: "token",
        },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "PERMISSION_REQUIRED",
        kind: "authz",
      })
    );
    expect(serviceMocks.connectDeveloperConnection).not.toHaveBeenCalled();
  });

  it("requires bound organizations for admin mutations", async () => {
    await expect(
      connectDeveloperConnectionCommand.run({
        ctx: ctx({
          admin: true,
          identity: {
            ...activeIdentity,
            orgGate: {
              bindingStatus: "unbound",
              nextSetupRequirement: "github_org",
            },
          },
        }),
        deps: deps(),
        input: {
          provider: "sentry",
          providerAccountName: "lightfast/app",
          token: "token",
        },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "ORG_SETUP_REQUIRED",
        kind: "authz",
      })
    );

    expect(serviceMocks.connectDeveloperConnection).not.toHaveBeenCalled();
  });

  it("routes admin mutations to services", async () => {
    await expect(
      connectDeveloperConnectionCommand.run({
        ctx: ctx({ admin: true }),
        deps: deps(),
        input: {
          provider: "sentry",
          providerAccountName: "lightfast/app",
          token: "token",
        },
      })
    ).resolves.toEqual({ provider: "sentry", status: "connected" });

    await expect(
      setDeveloperConnectionSandboxEnabledCommand.run({
        ctx: ctx({ admin: true }),
        deps: deps(),
        input: { provider: "sentry", enabled: false },
      })
    ).resolves.toEqual({ enabled: false });

    await expect(
      disconnectDeveloperConnectionCommand.run({
        ctx: ctx({ admin: true }),
        deps: deps(),
        input: { provider: "sentry" },
      })
    ).resolves.toEqual({ disconnected: true });

    await expect(
      startSentryDeveloperConnectionAuthCommand.run({
        ctx: ctx({ admin: true }),
        deps: deps(),
        input: {
          provider: "sentry",
          providerAccountName: "lightfast/app",
        },
      })
    ).resolves.toMatchObject({ attemptId: "auth_attempt_1" });

    await expect(
      completeSentryDeveloperConnectionAuthCommand.run({
        ctx: ctx({ admin: true }),
        deps: deps(),
        input: {
          provider: "sentry",
          attemptId: "auth_attempt_1",
        },
      })
    ).resolves.toEqual({ provider: "sentry", status: "connected" });
  });

  it("preserves domain errors raised by developer connection services", async () => {
    serviceMocks.connectDeveloperConnection.mockRejectedValueOnce(
      new ConflictError(
        "DEVELOPER_CONNECTION_RECONNECT_REQUIRED",
        "sentry needs reconnect"
      )
    );

    await expect(
      connectDeveloperConnectionCommand.run({
        ctx: ctx({ admin: true }),
        deps: deps(),
        input: {
          provider: "sentry",
          providerAccountName: "lightfast/app",
          token: "token",
        },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "DEVELOPER_CONNECTION_RECONNECT_REQUIRED",
        kind: "conflict",
      })
    );
  });
});
