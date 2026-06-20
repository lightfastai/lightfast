import type { Database, McpOauthGrant } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";
import { actorFromAuthIdentity } from "../domain";
import {
  createDefaultMcpConnectionCommandDeps,
  listAccountMcpConnectionsCommand,
  revokeAccountMcpConnectionCommand,
} from "../domain/mcp-connections";
import {
  disconnectUserConnectorCommand,
  startUserConnectorCommand,
  type UserConnectorCommandDeps,
} from "../domain/user-connectors";

const listMcpOauthGrantConnectionsForUserMock = vi.fn();
const getMcpOauthGrantByPublicIdMock = vi.fn();
const revokeMcpOauthGrantMock = vi.fn();
const startGranolaUserConnectorOAuthMock = vi.fn();
const disconnectGranolaUserConnectorMock = vi.fn();

const pendingIdentity: AuthIdentity = {
  type: "pending",
  userId: "user_current",
};

const activeIdentity: AuthIdentity = {
  type: "active",
  userId: "user_current",
  orgId: "org_acme",
  orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
};

const now = new Date("2026-06-01T00:00:00.000Z");

function grant(overrides: Partial<McpOauthGrant> = {}): McpOauthGrant {
  return {
    id: 1,
    clientPublicId: "mcp_client_test",
    clerkOrgId: "org_acme",
    clerkUserId: "user_current",
    createdAt: now,
    lastUsedAt: null,
    metadata: null,
    publicId: "mcp_grant_test",
    resource: "https://mcp.lightfast.localhost/mcp",
    resourceHash: "resource_hash",
    revokedAt: null,
    scopes: ["mcp:signals:read"],
    status: "active",
    updatedAt: now,
    ...overrides,
  };
}

function connection(overrides: Partial<McpOauthGrant> = {}) {
  return {
    client: {
      clientName: "Lightfield",
      clientUri: "https://lightfield.app",
      logoUri: null,
      metadata: { policyUri: "https://lightfield.app/policy" },
      publicClientId: "mcp_client_test",
      status: "active",
    },
    grant: grant(overrides),
    redirectUris: ["https://backend.lightfield.app/connections/callback/MCP"],
    refreshTokenStatusSummary: {
      active: 1,
      reuseDetected: 0,
      revoked: 0,
      rotated: 0,
    },
  };
}

function ctx(identity: AuthIdentity = pendingIdentity) {
  return {
    actor: actorFromAuthIdentity(identity, "web"),
    request: { id: "req_test", source: "tanstack" as const },
  };
}

function mcpDeps() {
  return createDefaultMcpConnectionCommandDeps({
    db: {} as Database,
    getMcpOauthGrantByPublicId: getMcpOauthGrantByPublicIdMock,
    listMcpOauthGrantConnectionsForUser:
      listMcpOauthGrantConnectionsForUserMock,
    revokeMcpOauthGrant: revokeMcpOauthGrantMock,
  });
}

function userConnectorDeps(referer?: string | null) {
  return {
    db: {} as Database,
    disconnectGranolaUserConnector: disconnectGranolaUserConnectorMock,
    request: { referer },
    startGranolaUserConnectorOAuth: startGranolaUserConnectorOAuthMock,
  } satisfies UserConnectorCommandDeps;
}

beforeEach(() => {
  listMcpOauthGrantConnectionsForUserMock.mockReset();
  getMcpOauthGrantByPublicIdMock.mockReset();
  revokeMcpOauthGrantMock.mockReset();
  startGranolaUserConnectorOAuthMock.mockReset();
  disconnectGranolaUserConnectorMock.mockReset();

  listMcpOauthGrantConnectionsForUserMock.mockResolvedValue([connection()]);
  getMcpOauthGrantByPublicIdMock.mockResolvedValue(grant());
  revokeMcpOauthGrantMock.mockResolvedValue(true);
  startGranolaUserConnectorOAuthMock.mockResolvedValue({
    authorizationUrl: "https://granola.test/oauth/authorize",
    mode: "connect",
  });
  disconnectGranolaUserConnectorMock.mockResolvedValue({ disconnected: true });
});

describe("account MCP connection domain commands", () => {
  it("lists MCP connections for the signed-in Clerk user without requiring an org", async () => {
    await expect(
      listAccountMcpConnectionsCommand.run({
        ctx: ctx(),
        deps: mcpDeps(),
        input: {},
      })
    ).resolves.toEqual([
      expect.objectContaining({
        clientId: "mcp_client_test",
        clientName: "Lightfield",
        clientPolicyUri: "https://lightfield.app/policy",
        connectedUserId: "user_current",
        grantId: "mcp_grant_test",
        scopes: ["mcp:signals:read"],
        status: "active",
      }),
    ]);

    expect(listMcpOauthGrantConnectionsForUserMock).toHaveBeenCalledWith(
      expect.anything(),
      { clerkUserId: "user_current" }
    );
  });

  it("revokes only the signed-in user's MCP grant", async () => {
    await expect(
      revokeAccountMcpConnectionCommand.run({
        ctx: ctx(activeIdentity),
        deps: mcpDeps(),
        input: { grantId: "mcp_grant_test" },
      })
    ).resolves.toEqual({ success: true });

    expect(getMcpOauthGrantByPublicIdMock).toHaveBeenCalledWith(
      expect.anything(),
      { publicId: "mcp_grant_test" }
    );
    expect(revokeMcpOauthGrantMock).toHaveBeenCalledWith(expect.anything(), {
      publicId: "mcp_grant_test",
    });
  });

  it("hides MCP grants owned by another user as not found", async () => {
    getMcpOauthGrantByPublicIdMock.mockResolvedValueOnce(
      grant({ clerkUserId: "user_other" })
    );

    await expect(
      revokeAccountMcpConnectionCommand.run({
        ctx: ctx(),
        deps: mcpDeps(),
        input: { grantId: "mcp_grant_test" },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "MCP_CONNECTION_NOT_FOUND",
        kind: "not_found",
      })
    );

    expect(revokeMcpOauthGrantMock).not.toHaveBeenCalled();
  });
});

describe("user connector domain commands", () => {
  it("starts a user connector OAuth flow for pending Clerk users", async () => {
    const referer = "https://app.lightfast.localhost/connectors?scope=personal";

    await expect(
      startUserConnectorCommand.run({
        ctx: ctx(),
        deps: userConnectorDeps(referer),
        input: { provider: "granola" },
      })
    ).resolves.toEqual({
      authorizationUrl: "https://granola.test/oauth/authorize",
      mode: "connect",
    });

    expect(startGranolaUserConnectorOAuthMock).toHaveBeenCalledWith({
      db: expect.anything(),
      request: { referer },
      viewer: { userId: "user_current" },
    });
  });

  it("disconnects a user connector with the same credential-blind viewer identity shape", async () => {
    await expect(
      disconnectUserConnectorCommand.run({
        ctx: ctx(activeIdentity),
        deps: userConnectorDeps(),
        input: { provider: "granola" },
      })
    ).resolves.toEqual({ disconnected: true });

    expect(disconnectGranolaUserConnectorMock).toHaveBeenCalledWith({
      db: expect.anything(),
      request: {},
      viewer: { userId: "user_current" },
    });
  });

  it("rejects non-Clerk actors before user connector services run", async () => {
    await expect(
      startUserConnectorCommand.run({
        ctx: {
          actor: { kind: "service", service: "system" },
          request: { id: "req_test", source: "tanstack" },
        },
        deps: userConnectorDeps(),
        input: { provider: "granola" },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "CLERK_USER_REQUIRED",
        kind: "authz",
      })
    );

    expect(startGranolaUserConnectorOAuthMock).not.toHaveBeenCalled();
    expect(disconnectGranolaUserConnectorMock).not.toHaveBeenCalled();
  });
});
