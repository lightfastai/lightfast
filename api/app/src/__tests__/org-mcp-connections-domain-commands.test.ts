import type { Database, McpOauthGrant } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";
import { actorFromAuthIdentity } from "../domain";
import {
  createDefaultMcpConnectionCommandDeps,
  listOrgMcpConnectionsCommand,
  revokeOrgMcpConnectionCommand,
} from "../domain/mcp-connections";

const listMcpOauthGrantConnectionsForOrgMock = vi.fn();
const getMcpOauthGrantByPublicIdMock = vi.fn();
const revokeMcpOauthGrantMock = vi.fn();

const activeIdentity: AuthIdentity = {
  type: "active",
  userId: "user_current",
  orgId: "org_acme",
  orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
};

const pendingIdentity: AuthIdentity = {
  type: "pending",
  userId: "user_current",
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

function adminCtx(identity: AuthIdentity = activeIdentity) {
  return {
    actor: { ...actorFromAuthIdentity(identity, "web"), orgRole: "admin" },
    request: { id: "req_test", source: "tanstack" as const },
  };
}

function memberCtx(identity: AuthIdentity = activeIdentity) {
  return {
    actor: actorFromAuthIdentity(identity, "web"),
    request: { id: "req_test", source: "tanstack" as const },
  };
}

function deps() {
  return createDefaultMcpConnectionCommandDeps({
    db: {} as Database,
    getMcpOauthGrantByPublicId: getMcpOauthGrantByPublicIdMock,
    listMcpOauthGrantConnectionsForOrg: listMcpOauthGrantConnectionsForOrgMock,
    revokeMcpOauthGrant: revokeMcpOauthGrantMock,
  });
}

beforeEach(() => {
  listMcpOauthGrantConnectionsForOrgMock.mockReset();
  getMcpOauthGrantByPublicIdMock.mockReset();
  revokeMcpOauthGrantMock.mockReset();

  listMcpOauthGrantConnectionsForOrgMock.mockResolvedValue([connection()]);
  getMcpOauthGrantByPublicIdMock.mockResolvedValue(grant());
  revokeMcpOauthGrantMock.mockResolvedValue(true);
});

describe("org MCP connection domain commands", () => {
  it("lists MCP grants for the active org when the actor is an org admin", async () => {
    await expect(
      listOrgMcpConnectionsCommand.run({
        ctx: adminCtx(),
        deps: deps(),
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

    expect(listMcpOauthGrantConnectionsForOrgMock).toHaveBeenCalledWith(
      expect.anything(),
      { clerkOrgId: "org_acme" }
    );
  });

  it("blocks non-admin members before listing org MCP grants", async () => {
    await expect(
      listOrgMcpConnectionsCommand.run({
        ctx: memberCtx(),
        deps: deps(),
        input: {},
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "PERMISSION_REQUIRED",
        kind: "authz",
      })
    );

    expect(listMcpOauthGrantConnectionsForOrgMock).not.toHaveBeenCalled();
  });

  it("revokes only grants owned by the active org", async () => {
    await expect(
      revokeOrgMcpConnectionCommand.run({
        ctx: adminCtx(),
        deps: deps(),
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

  it("hides grants owned by another org as not found", async () => {
    getMcpOauthGrantByPublicIdMock.mockResolvedValueOnce(
      grant({ clerkOrgId: "org_other" })
    );

    await expect(
      revokeOrgMcpConnectionCommand.run({
        ctx: adminCtx(),
        deps: deps(),
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

  it("rejects pending users before org MCP grant lookup", async () => {
    await expect(
      revokeOrgMcpConnectionCommand.run({
        ctx: adminCtx(pendingIdentity),
        deps: deps(),
        input: { grantId: "mcp_grant_test" },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "ORG_REQUIRED",
        kind: "authz",
      })
    );

    expect(getMcpOauthGrantByPublicIdMock).not.toHaveBeenCalled();
  });
});
