import type { Database } from "@db/app";
import { describe, expect, it, vi } from "vitest";

import type {
  McpAuditEvent,
  McpOauthAuthorizationCode,
  McpOauthClient,
  McpOauthGrant,
  McpOauthRefreshToken,
} from "../schema";
import {
  consumeMcpAuthorizationCode,
  createMcpAuthorizationCode,
  createMcpOauthClient,
  createMcpOauthGrant,
  createMcpRefreshToken,
  getActiveMcpOauthGrant,
  getActiveMcpRefreshTokenByHash,
  getMcpOauthClientByClientId,
  recordMcpAuditEvent,
  rotateMcpRefreshToken,
} from "../utils/mcp-oauth";

const clientId = "mcp_client_test_123";
const grantId = "mcp_grant_test_123";
const userId = "user_test";
const orgId = "org_test";
const resource = "https://mcp.lightfast.localhost/mcp";
const createdAt = new Date("2026-06-01T00:00:00.000Z");

function makeClient(overrides: Partial<McpOauthClient> = {}): McpOauthClient {
  return {
    id: 1,
    publicClientId: clientId,
    clientName: "Lightfield",
    clientUri: "https://lightfield.app",
    contacts: ["ops@lightfield.app"],
    logoUri: null,
    metadata: null,
    status: "active",
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function makeGrant(overrides: Partial<McpOauthGrant> = {}): McpOauthGrant {
  return {
    id: 2,
    publicId: grantId,
    clientPublicId: clientId,
    clerkOrgId: orgId,
    clerkUserId: userId,
    metadata: null,
    resource,
    resourceHash:
      "b5e0ec15f4160dc3b1c546bbf100d5a0667dcbe6c552958738e2f3ad2a14ac4f",
    scopes: ["mcp:signals:read"],
    status: "active",
    lastUsedAt: null,
    revokedAt: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function makeAuthorizationCode(
  overrides: Partial<McpOauthAuthorizationCode> = {}
): McpOauthAuthorizationCode {
  return {
    id: 3,
    clientPublicId: clientId,
    clerkOrgId: orgId,
    clerkUserId: userId,
    codeChallenge: "challenge",
    codeChallengeMethod: "S256",
    codeHash: "auth_code_hash",
    consumedAt: null,
    expiresAt: new Date("2026-06-01T00:10:00.000Z"),
    redirectUri: "https://backend.lightfield.app/connections/callback/MCP",
    resource,
    resourceHash:
      "b5e0ec15f4160dc3b1c546bbf100d5a0667dcbe6c552958738e2f3ad2a14ac4f",
    scopes: ["mcp:signals:write"],
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function makeRefreshToken(
  overrides: Partial<McpOauthRefreshToken> = {}
): McpOauthRefreshToken {
  return {
    id: 4,
    clientPublicId: clientId,
    clerkOrgId: orgId,
    clerkUserId: userId,
    expiresAt: new Date("2026-07-01T00:00:00.000Z"),
    grantPublicId: grantId,
    parentTokenHash: null,
    reuseDetectedAt: null,
    rotatedToTokenHash: null,
    status: "active",
    tokenHash: "refresh_hash_old",
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function makeAuditEvent(overrides: Partial<McpAuditEvent> = {}): McpAuditEvent {
  return {
    id: 5,
    clientPublicId: clientId,
    clerkOrgId: orgId,
    clerkUserId: userId,
    eventName: "mcp.signals.create",
    grantPublicId: grantId,
    metadata: null,
    outcome: "success",
    createdAt,
    ...overrides,
  };
}

function makeQueuedDb(
  results: unknown[][] = [],
  updateResults: Array<{ rowsAffected: number }> = []
) {
  const insertedValues: unknown[] = [];
  const updateWhereConditions: unknown[] = [];
  const updateValues: unknown[] = [];
  const orderBy = vi.fn(() => Promise.resolve(results.shift() ?? []));
  const limit = vi.fn(() => Promise.resolve(results.shift() ?? []));
  const where = vi.fn(() => ({ limit, orderBy }));
  const from = vi.fn(() => ({ where }));
  const values = vi.fn(async (value: unknown) => {
    insertedValues.push(value);
  });
  const set = vi.fn((value: unknown) => {
    updateValues.push(value);
    return {
      where: vi.fn((condition: unknown) => {
        updateWhereConditions.push(condition);
        return updateResults.shift() ?? { rowsAffected: 1 };
      }),
    };
  });
  const tx = {
    insert: vi.fn(() => ({ values })),
    select: vi.fn(() => ({ from })),
    update: vi.fn(() => ({ set })),
  };
  const db = {
    ...tx,
    transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
      callback(tx)
    ),
  };
  return {
    db: db as unknown as Database,
    insertedValues,
    spies: { from, limit, orderBy, set, transaction: db.transaction, values },
    updateWhereConditions,
    updateValues,
  };
}

describe("mcp oauth repositories", () => {
  it("creates and reads an oauth client by public client id", async () => {
    const redirectUri =
      "https://backend.lightfield.app/connections/callback/MCP";
    const { db, insertedValues } = makeQueuedDb([
      [makeClient()],
      [{ redirectUri }],
      [makeClient()],
      [{ redirectUri }],
    ]);

    await expect(
      createMcpOauthClient(db, {
        clientName: "Lightfield",
        clientUri: "https://lightfield.app",
        contacts: ["ops@lightfield.app"],
        logoUri: null,
        publicClientId: clientId,
        redirectUris: [redirectUri],
      })
    ).resolves.toMatchObject({
      publicClientId: clientId,
      redirectUris: [redirectUri],
    });

    await expect(
      getMcpOauthClientByClientId(db, { publicClientId: clientId })
    ).resolves.toMatchObject({
      publicClientId: clientId,
      redirectUris: [redirectUri],
    });

    expect(insertedValues[0]).toMatchObject({
      clientName: "Lightfield",
      publicClientId: clientId,
      status: "active",
    });
  });

  it("stores redirect uris exactly", async () => {
    const redirectUris = [
      "https://backend.lightfield.app/connections/callback/MCP",
      "lightfield://connections/callback/MCP?workspace=abc",
    ];
    const { db, insertedValues } = makeQueuedDb([
      [makeClient()],
      redirectUris.map((redirectUri) => ({ redirectUri })),
    ]);

    await createMcpOauthClient(db, {
      clientName: "Lightfield",
      publicClientId: clientId,
      redirectUris,
    });

    expect(insertedValues[1]).toEqual([
      { clientPublicId: clientId, redirectUri: redirectUris[0] },
      { clientPublicId: clientId, redirectUri: redirectUris[1] },
    ]);
  });

  it("creates an org-bound user grant", async () => {
    const { db, insertedValues } = makeQueuedDb([[makeGrant()]]);

    await expect(
      createMcpOauthGrant(db, {
        clientPublicId: clientId,
        clerkOrgId: orgId,
        clerkUserId: userId,
        publicId: grantId,
        resource,
        scopes: ["mcp:signals:read"],
      })
    ).resolves.toMatchObject({
      clerkOrgId: orgId,
      clerkUserId: userId,
      clientPublicId: clientId,
      publicId: grantId,
    });

    expect(insertedValues[0]).toMatchObject({
      clerkOrgId: orgId,
      clerkUserId: userId,
      clientPublicId: clientId,
      publicId: grantId,
    });
  });

  it("finds active grants by exact scope set when scopes are provided", async () => {
    const { db } = makeQueuedDb([
      [
        makeGrant({
          publicId: "mcp_grant_write",
          scopes: ["mcp:signals:write"],
        }),
        makeGrant({
          publicId: "mcp_grant_read",
          scopes: ["mcp:signals:read"],
        }),
      ],
    ]);

    await expect(
      getActiveMcpOauthGrant(db, {
        clientPublicId: clientId,
        clerkOrgId: orgId,
        clerkUserId: userId,
        resource,
        scopes: ["mcp:signals:read"],
      })
    ).resolves.toMatchObject({
      publicId: "mcp_grant_read",
      scopes: ["mcp:signals:read"],
    });
  });

  it("returns undefined when no active grant has the exact requested scope set", async () => {
    const { db } = makeQueuedDb([
      [
        makeGrant({
          publicId: "mcp_grant_write",
          scopes: ["mcp:signals:write"],
        }),
      ],
    ]);

    await expect(
      getActiveMcpOauthGrant(db, {
        clientPublicId: clientId,
        clerkOrgId: orgId,
        clerkUserId: userId,
        resource,
        scopes: ["mcp:signals:read"],
      })
    ).resolves.toBeUndefined();
  });

  it("stores only authorization code hashes", async () => {
    const { db, insertedValues } = makeQueuedDb([[makeAuthorizationCode()]]);

    await createMcpAuthorizationCode(db, {
      clientPublicId: clientId,
      clerkOrgId: orgId,
      clerkUserId: userId,
      codeChallenge: "challenge",
      codeChallengeMethod: "S256",
      codeHash: "auth_code_hash",
      expiresAt: new Date("2026-06-01T00:10:00.000Z"),
      redirectUri: "https://backend.lightfield.app/connections/callback/MCP",
      resource,
      scopes: ["mcp:signals:write"],
    });

    expect(insertedValues[0]).toMatchObject({
      codeHash: "auth_code_hash",
    });
    expect(insertedValues[0]).not.toHaveProperty("code");
    expect(insertedValues[0]).not.toHaveProperty("authorizationCode");
  });

  it("does not consume expired authorization codes", async () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const { db, updateValues } = makeQueuedDb([
      [
        makeAuthorizationCode({
          expiresAt: new Date("2026-05-31T23:59:59.000Z"),
        }),
      ],
    ]);

    await expect(
      consumeMcpAuthorizationCode(db, {
        codeHash: "auth_code_hash",
        now,
      })
    ).resolves.toBeUndefined();

    expect(updateValues).toHaveLength(0);
  });

  it("consumes unexpired authorization codes", async () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const { db, updateValues } = makeQueuedDb([
      [
        makeAuthorizationCode({
          expiresAt: new Date("2026-06-01T00:10:00.000Z"),
        }),
      ],
    ]);

    await expect(
      consumeMcpAuthorizationCode(db, {
        codeHash: "auth_code_hash",
        now,
      })
    ).resolves.toMatchObject({ codeHash: "auth_code_hash", consumedAt: now });

    expect(updateValues).toEqual([
      expect.objectContaining({ consumedAt: now }),
    ]);
  });

  it("rotates refresh token hashes and marks reuse detection", async () => {
    const { db, insertedValues, updateValues } = makeQueuedDb([
      [makeRefreshToken()],
      [makeRefreshToken()],
      [makeRefreshToken({ tokenHash: "refresh_hash_new" })],
      [makeRefreshToken({ status: "rotated" })],
    ]);

    await expect(
      createMcpRefreshToken(db, {
        clientPublicId: clientId,
        clerkOrgId: orgId,
        clerkUserId: userId,
        expiresAt: new Date("2026-07-01T00:00:00.000Z"),
        grantPublicId: grantId,
        tokenHash: "refresh_hash_old",
      })
    ).resolves.toMatchObject({ tokenHash: "refresh_hash_old" });

    await expect(
      rotateMcpRefreshToken(db, {
        currentTokenHash: "refresh_hash_old",
        expiresAt: new Date("2026-08-01T00:00:00.000Z"),
        nextTokenHash: "refresh_hash_new",
      })
    ).resolves.toMatchObject({ reuseDetected: false });

    await expect(
      rotateMcpRefreshToken(db, {
        currentTokenHash: "refresh_hash_old",
        expiresAt: new Date("2026-09-01T00:00:00.000Z"),
        nextTokenHash: "refresh_hash_reuse",
      })
    ).resolves.toMatchObject({ reuseDetected: true });

    expect(insertedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tokenHash: "refresh_hash_old" }),
        expect.objectContaining({
          parentTokenHash: "refresh_hash_old",
          tokenHash: "refresh_hash_new",
        }),
      ])
    );
    expect(updateValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rotatedToTokenHash: "refresh_hash_new",
          status: "rotated",
        }),
        expect.objectContaining({
          reuseDetectedAt: expect.any(Date),
          status: "reuse_detected",
        }),
      ])
    );
  });

  it("reads active refresh token hashes for access-token refresh", async () => {
    const { db } = makeQueuedDb([[makeRefreshToken()]]);

    await expect(
      getActiveMcpRefreshTokenByHash(db, {
        now: new Date("2026-06-01T00:00:00.000Z"),
        tokenHash: "refresh_hash_old",
      })
    ).resolves.toMatchObject({
      status: "active",
      tokenHash: "refresh_hash_old",
    });
  });

  it("returns undefined when no active refresh token hash matches", async () => {
    const { db } = makeQueuedDb([[]]);

    await expect(
      getActiveMcpRefreshTokenByHash(db, {
        now: new Date("2026-06-01T00:00:00.000Z"),
        tokenHash: "refresh_hash_missing",
      })
    ).resolves.toBeUndefined();
  });

  it("returns undefined when revoked refresh token hashes are filtered out", async () => {
    const { db } = makeQueuedDb([[]]);

    await expect(
      getActiveMcpRefreshTokenByHash(db, {
        now: new Date("2026-06-01T00:00:00.000Z"),
        tokenHash: "refresh_hash_old",
      })
    ).resolves.toBeUndefined();
  });

  it("returns undefined when expired refresh token hashes are filtered out", async () => {
    const { db } = makeQueuedDb([[]]);

    await expect(
      getActiveMcpRefreshTokenByHash(db, {
        now: new Date("2026-06-01T00:00:00.000Z"),
        tokenHash: "refresh_hash_old",
      })
    ).resolves.toBeUndefined();
  });

  it("does not rotate expired active refresh tokens", async () => {
    const { db, insertedValues, updateValues } = makeQueuedDb([
      [
        makeRefreshToken({
          expiresAt: new Date("2026-05-31T23:59:59.000Z"),
          status: "active",
        }),
      ],
    ]);

    await expect(
      rotateMcpRefreshToken(db, {
        currentTokenHash: "refresh_hash_old",
        expiresAt: new Date("2026-08-01T00:00:00.000Z"),
        nextTokenHash: "refresh_hash_new",
        now: new Date("2026-06-01T00:00:00.000Z"),
      })
    ).resolves.toEqual({ refreshToken: undefined, reuseDetected: false });

    expect(insertedValues).toHaveLength(0);
    expect(updateValues).toHaveLength(0);
  });

  it("marks reuse when a guarded rotation loses a race", async () => {
    const { db, insertedValues, updateValues } = makeQueuedDb(
      [
        [makeRefreshToken({ status: "active" })],
        [makeRefreshToken({ status: "rotated" })],
      ],
      [{ rowsAffected: 0 }, { rowsAffected: 1 }]
    );

    await expect(
      rotateMcpRefreshToken(db, {
        currentTokenHash: "refresh_hash_old",
        expiresAt: new Date("2026-08-01T00:00:00.000Z"),
        nextTokenHash: "refresh_hash_new",
        now: new Date("2026-06-01T00:00:00.000Z"),
      })
    ).resolves.toMatchObject({ reuseDetected: true });

    expect(insertedValues).toHaveLength(0);
    expect(updateValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rotatedToTokenHash: "refresh_hash_new",
          status: "rotated",
        }),
        expect.objectContaining({
          reuseDetectedAt: new Date("2026-06-01T00:00:00.000Z"),
          status: "reuse_detected",
        }),
      ])
    );
  });

  it("records redacted audit events", async () => {
    const { db, insertedValues } = makeQueuedDb([[makeAuditEvent()]]);

    await recordMcpAuditEvent(db, {
      clientPublicId: clientId,
      clerkOrgId: orgId,
      clerkUserId: userId,
      eventName: "mcp.signals.create",
      grantPublicId: grantId,
      metadata: {
        code: "raw-code",
        nested: {
          refreshToken: "raw-refresh-token",
          retained: "value",
        },
        redirectUri: "https://backend.lightfield.app/connections/callback/MCP",
      },
      outcome: "success",
    });

    expect(insertedValues[0]).toMatchObject({
      metadata: {
        code: "[redacted]",
        nested: {
          refreshToken: "[redacted]",
          retained: "value",
        },
        redirectUri: "https://backend.lightfield.app/connections/callback/MCP",
      },
    });
  });
});
