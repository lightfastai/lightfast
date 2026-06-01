import { describe, expect, it, vi } from "vitest";
import type { Database } from "../client";
import type { OrgConnectorConnection } from "../schema";
import {
  currentOrgProviderKey,
  finalizeCurrentOrgConnectorConnection,
  markCurrentOrgConnectorConnectionError,
  markCurrentOrgConnectorConnectionRevoked,
  recordConnectorToolRefreshError,
  updateConnectorToolManifest,
} from "../utils/org-connector-connections";

const toolManifest = [
  {
    name: "create_issue",
    description: "Create a Linear issue",
    inputSchema: { type: "object" },
  },
];

function connection(
  overrides: Partial<OrgConnectorConnection> = {}
): OrgConnectorConnection {
  return {
    id: 1,
    clerkOrgId: "org_123",
    provider: "linear",
    status: "active",
    connectedByUserId: "user_123",
    connectedAt: new Date("2026-06-01T00:00:00.000Z"),
    revokedAt: null,
    providerWorkspaceId: "workspace_123",
    providerWorkspaceName: "Acme",
    providerActorId: "actor_123",
    providerActorName: "Jeevan",
    encryptedAccessToken: "encrypted_access",
    encryptedRefreshToken: "encrypted_refresh",
    accessTokenExpiresAt: new Date("2026-06-01T08:00:00.000Z"),
    refreshTokenExpiresAt: new Date("2026-12-01T00:00:00.000Z"),
    scopes: ["issues:write"],
    mcpEndpoint: "https://mcp.linear.app/sse",
    toolManifest,
    lastToolRefreshAt: new Date("2026-06-01T00:00:00.000Z"),
    lastToolRefreshErrorAt: null,
    lastToolRefreshErrorCode: null,
    enabledForAutomations: true,
    metadata: { teamId: "team_123" },
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

function finalizeInput(
  overrides: Partial<
    Parameters<typeof finalizeCurrentOrgConnectorConnection>[1]
  > = {}
): Parameters<typeof finalizeCurrentOrgConnectorConnection>[1] {
  return {
    accessTokenExpiresAt: new Date("2026-06-01T08:00:00.000Z"),
    clerkOrgId: "org_123",
    connectedByUserId: "user_123",
    encryptedAccessToken: "encrypted_access_next",
    encryptedRefreshToken: "encrypted_refresh_next",
    mcpEndpoint: "https://mcp.linear.app/sse",
    metadata: { teamId: "team_123" },
    provider: "linear",
    providerActorId: "actor_123",
    providerActorName: "Jeevan",
    providerWorkspaceId: "workspace_123",
    providerWorkspaceName: "Acme",
    refreshTokenExpiresAt: new Date("2026-12-01T00:00:00.000Z"),
    scopes: ["issues:write"],
    toolManifest,
    ...overrides,
  };
}

function selectRows<T>(rows: T[]) {
  return {
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(rows),
      }),
    }),
  };
}

function collectColumnNames(value: unknown, seen = new WeakSet<object>()) {
  if (value === null || typeof value !== "object") {
    return [];
  }
  if (seen.has(value)) {
    return [];
  }
  seen.add(value);

  const names: string[] = [];
  if ("name" in value && typeof value.name === "string") {
    names.push(value.name);
  }

  for (const [key, nested] of Object.entries(value)) {
    if (key === "table") {
      continue;
    }
    names.push(...collectColumnNames(nested, seen));
  }
  return names;
}

describe("org connector connection helpers", () => {
  it("builds current org/provider uniqueness keys", () => {
    expect(currentOrgProviderKey("org_123", "linear")).toBe("org_123:linear");
  });

  it("exports a table with nullable encrypted tokens for revoked rows", async () => {
    const { orgConnectorConnections } = await import("../schema");
    expect(orgConnectorConnections.encryptedAccessToken.notNull).toBe(false);
    expect(orgConnectorConnections.encryptedRefreshToken.notNull).toBe(false);
    expect(orgConnectorConnections.toolManifest.notNull).toBe(true);
  });

  it("finalizes current org connector connections by revoking prior rows and inserting replacement rows", async () => {
    const previous = connection({ id: 1 });
    const inserted = connection({
      id: 2,
      encryptedAccessToken: "encrypted_access_next",
      encryptedRefreshToken: "encrypted_refresh_next",
    });
    const revokeSetMock = vi.fn(() => ({
      where: () => Promise.resolve({ affectedRows: 1 }),
    }));
    const valuesMock = vi.fn(() => ({
      $returningId: () => Promise.resolve([{ id: 2 }]),
    }));
    const tx = {
      insert: vi.fn(() => ({ values: valuesMock })),
      select: vi
        .fn()
        .mockReturnValueOnce(selectRows([previous]))
        .mockReturnValueOnce(selectRows([inserted])),
      update: vi.fn(() => ({ set: revokeSetMock })),
    };
    const db = {
      transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
        callback(tx)
      ),
    } as unknown as Database;

    await expect(
      finalizeCurrentOrgConnectorConnection(db, finalizeInput())
    ).resolves.toMatchObject({
      id: 2,
      encryptedAccessToken: "encrypted_access_next",
    });

    expect(db.transaction).toHaveBeenCalledOnce();
    expect(revokeSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        currentOrgProviderKey: null,
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        enabledForAutomations: false,
        revokedAt: expect.any(Date),
        status: "revoked",
        toolManifest: [],
        updatedAt: expect.any(Date),
      })
    );
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkOrgId: "org_123",
        currentOrgProviderKey: "org_123:linear",
        provider: "linear",
        status: "active",
      })
    );
  });

  it("revokes current org connector connections by clearing current key, tokens, automation, and manifest", async () => {
    const active = connection();
    const revoked = connection({
      encryptedAccessToken: null,
      encryptedRefreshToken: null,
      enabledForAutomations: false,
      revokedAt: new Date("2026-06-01T01:00:00.000Z"),
      status: "revoked",
      toolManifest: [],
    });
    const updateWhere = vi.fn((_condition: unknown) =>
      Promise.resolve({ affectedRows: 1 })
    );
    const set = vi.fn(() => ({ where: updateWhere }));
    const update = vi.fn(() => ({ set }));
    const select = vi
      .fn()
      .mockReturnValueOnce(selectRows([active]))
      .mockReturnValueOnce(selectRows([revoked]));
    const db = { select, update } as unknown as Database;

    await expect(
      markCurrentOrgConnectorConnectionRevoked(db, {
        clerkOrgId: "org_123",
        provider: "linear",
      })
    ).resolves.toMatchObject({ status: "revoked" });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        currentOrgProviderKey: null,
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        enabledForAutomations: false,
        revokedAt: expect.any(Date),
        status: "revoked",
        toolManifest: [],
        updatedAt: expect.any(Date),
      })
    );
    const columnNames = collectColumnNames(updateWhere.mock.calls[0]?.[0]);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("status");
  });

  it("marks current org connector connection errors without clearing tokens", async () => {
    const active = connection();
    const errored = connection({
      enabledForAutomations: false,
      status: "error",
    });
    const set = vi.fn(() => ({
      where: () => Promise.resolve({ affectedRows: 1 }),
    }));
    const update = vi.fn(() => ({ set }));
    const select = vi
      .fn()
      .mockReturnValueOnce(selectRows([active]))
      .mockReturnValueOnce(selectRows([errored]));
    const db = { select, update } as unknown as Database;

    await expect(
      markCurrentOrgConnectorConnectionError(db, {
        clerkOrgId: "org_123",
        provider: "linear",
      })
    ).resolves.toMatchObject({ status: "error" });

    expect(set).toHaveBeenCalledWith(
      expect.not.objectContaining({
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
      })
    );
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        enabledForAutomations: false,
        status: "error",
        updatedAt: expect.any(Date),
      })
    );
  });

  it("updates connector tool manifests and clears refresh error fields on success", async () => {
    const refreshedAt = new Date("2026-06-01T01:00:00.000Z");
    const nextManifest = [{ name: "search_issues" }];
    const set = vi.fn(() => ({
      where: () => Promise.resolve({ affectedRows: 1 }),
    }));
    const update = vi.fn(() => ({ set }));
    const db = { update } as unknown as Database;

    await expect(
      updateConnectorToolManifest(db, {
        clerkOrgId: "org_123",
        lastToolRefreshAt: refreshedAt,
        provider: "linear",
        toolManifest: nextManifest,
      })
    ).resolves.toBe(true);

    expect(set).toHaveBeenCalledWith({
      lastToolRefreshAt: refreshedAt,
      lastToolRefreshErrorAt: null,
      lastToolRefreshErrorCode: null,
      toolManifest: nextManifest,
      updatedAt: refreshedAt,
    });
  });

  it("records connector tool refresh errors without replacing the existing manifest", async () => {
    const erroredAt = new Date("2026-06-01T01:00:00.000Z");
    const set = vi.fn(() => ({
      where: () => Promise.resolve({ affectedRows: 1 }),
    }));
    const update = vi.fn(() => ({ set }));
    const db = { update } as unknown as Database;

    await expect(
      recordConnectorToolRefreshError(db, {
        clerkOrgId: "org_123",
        lastToolRefreshErrorAt: erroredAt,
        lastToolRefreshErrorCode: "MCP_UNAVAILABLE",
        provider: "linear",
      })
    ).resolves.toBe(true);

    expect(set).toHaveBeenCalledWith({
      lastToolRefreshErrorAt: erroredAt,
      lastToolRefreshErrorCode: "MCP_UNAVAILABLE",
      updatedAt: erroredAt,
    });
  });
});
