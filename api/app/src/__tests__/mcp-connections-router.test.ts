import type { Database, McpOauthGrant } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";

const getMcpOauthGrantByPublicIdMock = vi.fn();
const listMcpOauthGrantConnectionsForOrgMock = vi.fn();
const listMcpOauthGrantConnectionsForUserMock = vi.fn();
const revokeMcpOauthGrantMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("@db/app", () => ({
  getMcpOauthGrantByPublicId: getMcpOauthGrantByPublicIdMock,
  listMcpOauthGrantConnectionsForOrg: listMcpOauthGrantConnectionsForOrgMock,
  listMcpOauthGrantConnectionsForUser: listMcpOauthGrantConnectionsForUserMock,
  revokeMcpOauthGrant: revokeMcpOauthGrantMock,
}));

vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    ({ next }: { next: () => unknown }) =>
      next(),
}));

const { createCallerFactory, createTRPCRouter } = await import("../trpc");
const { accountMcpConnectionsRouter, orgMcpConnectionsRouter } = await import(
  "../router/(pending-not-allowed)/mcp-connections"
);

const testRouter = createTRPCRouter({
  accountMcpConnections: accountMcpConnectionsRouter,
  orgMcpConnections: orgMcpConnectionsRouter,
});
const createCaller = createCallerFactory(testRouter);

const activeIdentity: AuthIdentity = {
  type: "active",
  userId: "user_current",
  orgId: "org_acme",
  orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
};

function adminAccess() {
  return {
    kind: "clerk-session" as const,
    userId: "user_current",
    orgId: "org_acme",
    has: ({ role }: { role?: string }) => role === "org:admin",
  };
}

function adminAccessForOrg(orgId: string) {
  return {
    kind: "clerk-session" as const,
    userId: "user_current",
    orgId,
    has: ({ role }: { role?: string }) => role === "org:admin",
  };
}

function nonAdminAccess() {
  return {
    kind: "clerk-session" as const,
    userId: "user_current",
    orgId: "org_acme",
    has: () => false,
  };
}

type TestAccess =
  | ReturnType<typeof adminAccess>
  | ReturnType<typeof adminAccessForOrg>
  | ReturnType<typeof nonAdminAccess>;

function caller(access?: TestAccess) {
  return callerWithAuth({ access, identity: activeIdentity });
}

function callerWithAuth(input: {
  access?: TestAccess;
  identity: AuthIdentity;
}) {
  return createCaller({
    auth: input.access
      ? { access: input.access, identity: input.identity }
      : { identity: input.identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

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

function connection(overrides: Partial<ReturnType<typeof grant>> = {}) {
  return {
    client: {
      clientName: "Lightfield",
      clientUri: "https://lightfield.app",
      logoUri: null,
      metadata: { tokenEndpointAuthMethod: "none" },
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

beforeEach(() => {
  getMcpOauthGrantByPublicIdMock.mockReset();
  listMcpOauthGrantConnectionsForOrgMock.mockReset();
  listMcpOauthGrantConnectionsForUserMock.mockReset();
  revokeMcpOauthGrantMock.mockReset();

  getMcpOauthGrantByPublicIdMock.mockResolvedValue(grant());
  listMcpOauthGrantConnectionsForOrgMock.mockResolvedValue([connection()]);
  listMcpOauthGrantConnectionsForUserMock.mockResolvedValue([connection()]);
  revokeMcpOauthGrantMock.mockResolvedValue(true);
});

describe("MCP connection routers", () => {
  it("lists current user's MCP grants", async () => {
    await expect(caller().accountMcpConnections.list()).resolves.toEqual([
      expect.objectContaining({
        clientId: "mcp_client_test",
        clientName: "Lightfield",
        clientVerificationStatus: "verified",
        connectedUserId: "user_current",
        createdAt: "2026-06-01T00:00:00.000Z",
        grantId: "mcp_grant_test",
        redirectUris: [
          "https://backend.lightfield.app/connections/callback/MCP",
        ],
        resource: "https://mcp.lightfast.localhost/mcp",
        scopes: ["mcp:signals:read"],
        status: "active",
      }),
    ]);

    expect(listMcpOauthGrantConnectionsForUserMock).toHaveBeenCalledWith(
      {},
      { clerkUserId: "user_current" }
    );
  });

  it("lists org grants for org admins", async () => {
    await expect(
      caller(adminAccess()).orgMcpConnections.list()
    ).resolves.toEqual([
      expect.objectContaining({
        clientName: "Lightfield",
        connectedUserId: "user_current",
        grantId: "mcp_grant_test",
      }),
    ]);

    expect(listMcpOauthGrantConnectionsForOrgMock).toHaveBeenCalledWith(
      {},
      { clerkOrgId: "org_acme" }
    );
  });

  it("blocks org grant listing for non-admin members", async () => {
    await expect(
      caller(nonAdminAccess()).orgMcpConnections.list()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(listMcpOauthGrantConnectionsForOrgMock).not.toHaveBeenCalled();
  });

  it("revokes a user's own grant", async () => {
    await expect(
      caller().accountMcpConnections.revoke({ grantId: "mcp_grant_test" })
    ).resolves.toEqual({ success: true });

    expect(getMcpOauthGrantByPublicIdMock).toHaveBeenCalledWith(
      {},
      { publicId: "mcp_grant_test" }
    );
    expect(revokeMcpOauthGrantMock).toHaveBeenCalledWith(
      {},
      { publicId: "mcp_grant_test" }
    );
  });

  it("blocks unauthenticated account revokes before grant lookup", async () => {
    await expect(
      callerWithAuth({
        identity: { type: "unauthenticated" },
      }).accountMcpConnections.revoke({ grantId: "mcp_grant_test" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(getMcpOauthGrantByPublicIdMock).not.toHaveBeenCalled();
    expect(revokeMcpOauthGrantMock).not.toHaveBeenCalled();
  });

  it("does not revoke grants owned by another user", async () => {
    getMcpOauthGrantByPublicIdMock.mockResolvedValueOnce(
      grant({ clerkUserId: "user_other" })
    );

    await expect(
      caller().accountMcpConnections.revoke({ grantId: "mcp_grant_test" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(getMcpOauthGrantByPublicIdMock).toHaveBeenCalledWith(
      {},
      { publicId: "mcp_grant_test" }
    );
    expect(revokeMcpOauthGrantMock).not.toHaveBeenCalled();
  });

  it("allows org admins to revoke an org grant", async () => {
    await expect(
      caller(adminAccess()).orgMcpConnections.revoke({
        grantId: "mcp_grant_test",
      })
    ).resolves.toEqual({ success: true });

    expect(revokeMcpOauthGrantMock).toHaveBeenCalledWith(
      {},
      { publicId: "mcp_grant_test" }
    );
  });

  it("blocks unauthenticated org revokes before grant lookup", async () => {
    await expect(
      callerWithAuth({
        identity: { type: "unauthenticated" },
      }).orgMcpConnections.revoke({ grantId: "mcp_grant_test" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(getMcpOauthGrantByPublicIdMock).not.toHaveBeenCalled();
    expect(revokeMcpOauthGrantMock).not.toHaveBeenCalled();
  });

  it("blocks non-admin org revokes before grant lookup", async () => {
    await expect(
      caller(nonAdminAccess()).orgMcpConnections.revoke({
        grantId: "mcp_grant_test",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(getMcpOauthGrantByPublicIdMock).not.toHaveBeenCalled();
    expect(revokeMcpOauthGrantMock).not.toHaveBeenCalled();
  });

  it("blocks mismatched Clerk org sessions before grant lookup", async () => {
    await expect(
      caller(adminAccessForOrg("org_other")).orgMcpConnections.revoke({
        grantId: "mcp_grant_test",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(getMcpOauthGrantByPublicIdMock).not.toHaveBeenCalled();
    expect(revokeMcpOauthGrantMock).not.toHaveBeenCalled();
  });

  it("does not revoke grants owned by another org", async () => {
    getMcpOauthGrantByPublicIdMock.mockResolvedValueOnce(
      grant({ clerkOrgId: "org_other" })
    );

    await expect(
      caller(adminAccess()).orgMcpConnections.revoke({
        grantId: "mcp_grant_test",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(getMcpOauthGrantByPublicIdMock).toHaveBeenCalledWith(
      {},
      { publicId: "mcp_grant_test" }
    );
    expect(revokeMcpOauthGrantMock).not.toHaveBeenCalled();
  });
});
