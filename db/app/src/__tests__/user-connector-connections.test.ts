import { describe, expect, it, vi } from "vitest";
import type { Database } from "../client";
import type { UserConnectorConnection } from "../schema";
import {
  currentUserProviderKey,
  finalizeCurrentUserConnectorConnection,
  markCurrentUserConnectorConnectionError,
  markCurrentUserConnectorConnectionRevoked,
  recordUserConnectorToolRefreshError,
  updateUserConnectorToolManifest,
} from "../utils/user-connector-connections";

const toolManifest = [
  {
    name: "search_notes",
    description: "Search Granola meeting notes",
    inputSchema: { type: "object" },
  },
];

function connection(
  overrides: Partial<UserConnectorConnection> = {}
): UserConnectorConnection {
  return {
    id: 1,
    clerkUserId: "user_123",
    provider: "granola",
    status: "active",
    connectedAt: new Date("2026-06-01T00:00:00.000Z"),
    revokedAt: null,
    providerAccountId: "granola_account_123",
    providerAccountName: "Jeevan Pillay",
    encryptedAccessToken: "encrypted_access",
    encryptedRefreshToken: "encrypted_refresh",
    accessTokenExpiresAt: new Date("2026-06-01T08:00:00.000Z"),
    refreshTokenExpiresAt: new Date("2026-12-01T00:00:00.000Z"),
    scopes: ["notes:read"],
    mcpEndpoint: "https://mcp.granola.ai/sse",
    toolManifest,
    lastToolRefreshAt: new Date("2026-06-01T00:00:00.000Z"),
    lastToolRefreshErrorAt: null,
    lastToolRefreshErrorCode: null,
    metadata: { workspaceId: "workspace_123" },
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

function finalizeInput(
  overrides: Partial<
    Parameters<typeof finalizeCurrentUserConnectorConnection>[1]
  > = {}
): Parameters<typeof finalizeCurrentUserConnectorConnection>[1] {
  return {
    accessTokenExpiresAt: new Date("2026-06-01T08:00:00.000Z"),
    clerkUserId: "user_123",
    encryptedAccessToken: "encrypted_access_next",
    encryptedRefreshToken: "encrypted_refresh_next",
    mcpEndpoint: "https://mcp.granola.ai/sse",
    metadata: { workspaceId: "workspace_123" },
    provider: "granola",
    providerAccountId: "granola_account_123",
    providerAccountName: "Jeevan Pillay",
    refreshTokenExpiresAt: new Date("2026-12-01T00:00:00.000Z"),
    scopes: ["notes:read"],
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

describe("user connector connection helpers", () => {
  it("builds current user/provider uniqueness keys", () => {
    expect(currentUserProviderKey("user_123", "granola")).toBe(
      "user_123:granola"
    );
  });

  it("exports a table with nullable encrypted tokens for revoked rows", async () => {
    const { userConnectorConnections } = await import("../schema");
    expect(userConnectorConnections.encryptedAccessToken.notNull).toBe(false);
    expect(userConnectorConnections.encryptedRefreshToken.notNull).toBe(false);
    expect(userConnectorConnections.toolManifest.notNull).toBe(true);
    expect("enabledForAgents" in userConnectorConnections).toBe(false);
    expect("enabledForAutomations" in userConnectorConnections).toBe(false);
  });

  it("finalizes current user connector connections by revoking prior rows and inserting replacement rows", async () => {
    const previous = connection({ id: 1 });
    const inserted = connection({
      id: 2,
      encryptedAccessToken: "encrypted_access_next",
      encryptedRefreshToken: "encrypted_refresh_next",
    });
    const revokeWhereMock = vi.fn((_condition: unknown) =>
      Promise.resolve({ affectedRows: 1 })
    );
    const revokeSetMock = vi.fn(() => ({
      where: revokeWhereMock,
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
      finalizeCurrentUserConnectorConnection(
        db,
        finalizeInput({
          observedCurrentConnectionId: 1,
          observedEncryptedAccessToken: "encrypted_access",
          observedEncryptedRefreshToken: "encrypted_refresh",
        })
      )
    ).resolves.toMatchObject({
      id: 2,
      encryptedAccessToken: "encrypted_access_next",
    });

    expect(db.transaction).toHaveBeenCalledOnce();
    expect(revokeSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accessTokenExpiresAt: null,
        currentUserProviderKey: null,
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        refreshTokenExpiresAt: null,
        revokedAt: expect.any(Date),
        status: "revoked",
        toolManifest: [],
        updatedAt: expect.any(Date),
      })
    );
    expect(revokeSetMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        enabledForAgents: expect.anything(),
        enabledForAutomations: expect.anything(),
      })
    );
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkUserId: "user_123",
        currentUserProviderKey: "user_123:granola",
        provider: "granola",
        status: "active",
      })
    );
    const revokeWhereCondition = revokeWhereMock.mock.calls[0]?.[0];
    if (revokeWhereCondition === undefined) {
      throw new Error("Expected previous connection revoke condition.");
    }
    const columnNames = collectColumnNames(revokeWhereCondition);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("status");
    expect(columnNames).toContain("encrypted_access_token");
    expect(columnNames).toContain("encrypted_refresh_token");
  });

  it("rejects finalize when the observed current connection changed", async () => {
    const previous = connection({ id: 1 });
    const valuesMock = vi.fn(() => ({
      $returningId: () => Promise.resolve([{ id: 2 }]),
    }));
    const tx = {
      insert: vi.fn(() => ({ values: valuesMock })),
      select: vi.fn().mockReturnValueOnce(selectRows([previous])),
      update: vi.fn(() => ({
        set: () => ({ where: () => Promise.resolve({ affectedRows: 1 }) }),
      })),
    };
    const db = {
      transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
        callback(tx)
      ),
    } as unknown as Database;

    await expect(
      finalizeCurrentUserConnectorConnection(
        db,
        finalizeInput({ observedCurrentConnectionId: 99 })
      )
    ).rejects.toThrow("Current user connector connection changed");

    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("revokes current user connector connections by clearing current key, tokens, and manifest", async () => {
    const active = connection();
    const revoked = connection({
      accessTokenExpiresAt: null,
      encryptedAccessToken: null,
      encryptedRefreshToken: null,
      refreshTokenExpiresAt: null,
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
      markCurrentUserConnectorConnectionRevoked(db, {
        clerkUserId: "user_123",
        observedCurrentConnectionId: 1,
        observedEncryptedAccessToken: "encrypted_access",
        observedEncryptedRefreshToken: "encrypted_refresh",
        provider: "granola",
      })
    ).resolves.toMatchObject({ status: "revoked" });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        accessTokenExpiresAt: null,
        currentUserProviderKey: null,
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        refreshTokenExpiresAt: null,
        revokedAt: expect.any(Date),
        status: "revoked",
        toolManifest: [],
        updatedAt: expect.any(Date),
      })
    );
    const columnNames = collectColumnNames(updateWhere.mock.calls[0]?.[0]);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("status");
    expect(columnNames).toContain("encrypted_access_token");
    expect(columnNames).toContain("encrypted_refresh_token");
  });

  it("does not revoke current user connector connections when the observed row changed", async () => {
    const active = connection({ id: 1 });
    const update = vi.fn(() => ({
      set: () => ({ where: () => Promise.resolve({ affectedRows: 1 }) }),
    }));
    const select = vi.fn().mockReturnValueOnce(selectRows([active]));
    const db = { select, update } as unknown as Database;

    await expect(
      markCurrentUserConnectorConnectionRevoked(db, {
        clerkUserId: "user_123",
        observedCurrentConnectionId: 99,
        provider: "granola",
      })
    ).resolves.toBeUndefined();

    expect(update).not.toHaveBeenCalled();
  });

  it("marks current user connector connection errors without clearing tokens", async () => {
    const active = connection();
    const errored = connection({ status: "error" });
    const updateWhere = vi.fn((_condition: unknown) =>
      Promise.resolve({ affectedRows: 1 })
    );
    const set = vi.fn(() => ({ where: updateWhere }));
    const update = vi.fn(() => ({ set }));
    const select = vi
      .fn()
      .mockReturnValueOnce(selectRows([active]))
      .mockReturnValueOnce(selectRows([errored]));
    const db = { select, update } as unknown as Database;

    await expect(
      markCurrentUserConnectorConnectionError(db, {
        clerkUserId: "user_123",
        provider: "granola",
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
        status: "error",
        updatedAt: expect.any(Date),
      })
    );
    const columnNames = collectColumnNames(updateWhere.mock.calls[0]?.[0]);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("status");
  });

  it("updates user connector tool manifests and clears refresh error fields on success", async () => {
    const refreshedAt = new Date("2026-06-01T01:00:00.000Z");
    const nextManifest = [{ name: "summarize_notes" }];
    const updateWhere = vi.fn((_condition: unknown) =>
      Promise.resolve({ affectedRows: 1 })
    );
    const set = vi.fn(() => ({
      where: updateWhere,
    }));
    const update = vi.fn(() => ({ set }));
    const db = { update } as unknown as Database;

    await expect(
      updateUserConnectorToolManifest(db, {
        clerkUserId: "user_123",
        lastToolRefreshAt: refreshedAt,
        provider: "granola",
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
    const columnNames = collectColumnNames(updateWhere.mock.calls[0]?.[0]);
    expect(columnNames).toContain("current_user_provider_key");
    expect(columnNames).toContain("status");
  });

  it("records user connector tool refresh errors without replacing the existing manifest", async () => {
    const erroredAt = new Date("2026-06-01T01:00:00.000Z");
    const updateWhere = vi.fn((_condition: unknown) =>
      Promise.resolve({ affectedRows: 1 })
    );
    const set = vi.fn(() => ({
      where: updateWhere,
    }));
    const update = vi.fn(() => ({ set }));
    const db = { update } as unknown as Database;

    await expect(
      recordUserConnectorToolRefreshError(db, {
        clerkUserId: "user_123",
        lastToolRefreshErrorAt: erroredAt,
        lastToolRefreshErrorCode: "MCP_UNAVAILABLE",
        provider: "granola",
      })
    ).resolves.toBe(true);

    expect(set).toHaveBeenCalledWith({
      lastToolRefreshErrorAt: erroredAt,
      lastToolRefreshErrorCode: "MCP_UNAVAILABLE",
      updatedAt: erroredAt,
    });
    const columnNames = collectColumnNames(updateWhere.mock.calls[0]?.[0]);
    expect(columnNames).toContain("current_user_provider_key");
    expect(columnNames).toContain("status");
  });
});
