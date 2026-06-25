import type { Database, McpOauthRefreshToken } from "@db/app";
import { SignJWT } from "@vendor/jose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rotateMcpRefreshTokenMock = vi.fn();
const revokeMcpOauthGrantMock = vi.fn();
const getMcpOauthGrantByPublicIdMock = vi.fn();
const getActiveMcpRefreshTokenByHashMock = vi.fn();

vi.mock("@db/app", () => ({
  getActiveMcpRefreshTokenByHash: getActiveMcpRefreshTokenByHashMock,
  getMcpOauthGrantByPublicId: getMcpOauthGrantByPublicIdMock,
  revokeMcpOauthGrant: revokeMcpOauthGrantMock,
  rotateMcpRefreshToken: rotateMcpRefreshTokenMock,
}));

const {
  createJwtSecretKey,
  hashOpaqueToken,
  refreshMcpAccessTokenWithRefreshToken,
  rotateMcpRefreshTokenSecret,
  signMcpAccessToken,
  verifyMcpAccessToken,
} = await import("../tokens");
const { McpOAuthError } = await import("../types");

const db = { kind: "mock-db" } as unknown as Database;
const missingRefreshTokenSecret = `mcp_refresh_${"m".repeat(43)}`;
const refreshTokenSecret = `mcp_refresh_${"r".repeat(43)}`;
const resource = "https://mcp.lightfast.localhost/mcp";

function refreshToken(
  overrides: Partial<McpOauthRefreshToken> = {}
): McpOauthRefreshToken {
  return {
    id: 1,
    clientPublicId: "mcp_client_test",
    clerkOrgId: "org_test",
    clerkUserId: "user_test",
    expiresAt: new Date("2026-07-01T00:00:00.000Z"),
    grantPublicId: "mcp_grant_test",
    parentTokenHash: null,
    reuseDetectedAt: null,
    rotatedToTokenHash: null,
    status: "active",
    tokenHash: "refresh_hash",
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  getActiveMcpRefreshTokenByHashMock.mockReset();
  getMcpOauthGrantByPublicIdMock.mockReset();
  rotateMcpRefreshTokenMock.mockReset();
  revokeMcpOauthGrantMock.mockReset();
  getActiveMcpRefreshTokenByHashMock.mockResolvedValue(refreshToken());
  getMcpOauthGrantByPublicIdMock.mockResolvedValue({
    clientPublicId: "mcp_client_test",
    clerkOrgId: "org_test",
    clerkUserId: "user_test",
    publicId: "mcp_grant_test",
    resource,
    scopes: ["mcp:signals:read"],
    status: "active",
  });
  rotateMcpRefreshTokenMock.mockResolvedValue({
    refreshToken: refreshToken({ tokenHash: "refresh_hash_new" }),
    reuseDetected: false,
  });
  revokeMcpOauthGrantMock.mockResolvedValue(true);
});

describe("mcp access tokens", () => {
  it("signs an MCP-specific access JWT with audience and grant claims", async () => {
    const accessToken = await signMcpAccessToken({
      audience: resource,
      grant: {
        clientPublicId: "mcp_client_test",
        clerkOrgId: "org_test",
        clerkUserId: "user_test",
        publicId: "mcp_grant_test",
        scopes: ["mcp:signals:read"],
      },
      issuer: "https://app.lightfast.localhost",
      jwtSecret: "test-secret",
    });

    const payload = await verifyMcpAccessToken(accessToken, {
      audience: resource,
      issuer: "https://app.lightfast.localhost",
      jwtSecret: "test-secret",
    });

    expect(payload).toMatchObject({
      aud: resource,
      client_id: "mcp_client_test",
      grant_id: "mcp_grant_test",
      org_id: "org_test",
      scope: "mcp:signals:read",
      token_use: "mcp_access",
      user_id: "user_test",
    });
  });

  it("rejects tokens with the wrong token_use", async () => {
    const key = createJwtSecretKey("test-secret");
    const token = await new SignJWT({ token_use: "session" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer("https://app.lightfast.localhost")
      .setAudience(resource)
      .setExpirationTime("5m")
      .sign(key);

    await expect(
      verifyMcpAccessToken(token, {
        audience: resource,
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "test-secret",
      })
    ).rejects.toEqual(
      new McpOAuthError("invalid_grant", "Access token is not an MCP token.")
    );
  });

  it("rejects access tokens signed with an unexpected algorithm", async () => {
    const key = createJwtSecretKey("test-secret");
    const token = await new SignJWT({
      client_id: "mcp_client_test",
      grant_id: "mcp_grant_test",
      org_id: "org_test",
      scope: "mcp:signals:read",
      token_use: "mcp_access",
      user_id: "user_test",
    })
      .setProtectedHeader({ alg: "HS512", typ: "JWT" })
      .setIssuer("https://app.lightfast.localhost")
      .setAudience(resource)
      .setSubject("user_test")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(key);

    await expect(
      verifyMcpAccessToken(token, {
        audience: resource,
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "test-secret",
      })
    ).rejects.toMatchObject({
      code: "ERR_JOSE_ALG_NOT_ALLOWED",
    });
  });

  it("refuses to sign access tokens for grants without scopes", async () => {
    await expect(
      signMcpAccessToken({
        audience: resource,
        grant: {
          clientPublicId: "mcp_client_test",
          clerkOrgId: "org_test",
          clerkUserId: "user_test",
          publicId: "mcp_grant_test",
          scopes: [],
        },
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "test-secret",
      })
    ).rejects.toEqual(
      new McpOAuthError("invalid_grant", "Authorization grant is invalid.")
    );
  });

  it("rejects expired access tokens", async () => {
    const key = createJwtSecretKey("test-secret");
    const token = await new SignJWT({
      client_id: "mcp_client_test",
      grant_id: "mcp_grant_test",
      org_id: "org_test",
      scope: "mcp:signals:read",
      token_use: "mcp_access",
      user_id: "user_test",
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer("https://app.lightfast.localhost")
      .setAudience(resource)
      .setSubject("user_test")
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(key);

    await expect(
      verifyMcpAccessToken(token, {
        audience: resource,
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "test-secret",
      })
    ).rejects.toMatchObject({ code: "ERR_JWT_EXPIRED" });
  });
});

describe("mcp refresh tokens", () => {
  it("refreshes access tokens without rotating the refresh token", async () => {
    const result = await refreshMcpAccessTokenWithRefreshToken(db, {
      clientId: "mcp_client_test",
      currentRefreshToken: refreshTokenSecret,
      issuer: "https://app.lightfast.localhost",
      jwtSecret: "test-secret",
    });

    expect(result).toMatchObject({
      expires_in: 900,
      grant_id: "mcp_grant_test",
      scope: "mcp:signals:read",
      token_type: "Bearer",
    });
    expect(result).not.toHaveProperty("refresh_token");
    expect(getActiveMcpRefreshTokenByHashMock).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        tokenHash: hashOpaqueToken(refreshTokenSecret),
      })
    );
    expect(rotateMcpRefreshTokenMock).not.toHaveBeenCalled();

    await expect(
      verifyMcpAccessToken(result.access_token, {
        audience: resource,
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "test-secret",
      })
    ).resolves.toMatchObject({
      aud: resource,
      grant_id: "mcp_grant_test",
      token_use: "mcp_access",
    });
  });

  it("rejects refresh requests for alternate access token audiences", async () => {
    await expect(
      refreshMcpAccessTokenWithRefreshToken(db, {
        audience: "https://attacker.example/mcp",
        clientId: "mcp_client_test",
        currentRefreshToken: refreshTokenSecret,
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "test-secret",
      })
    ).rejects.toEqual(
      new McpOAuthError(
        "invalid_request",
        "Access token audience must match the authorized MCP resource."
      )
    );

    expect(rotateMcpRefreshTokenMock).not.toHaveBeenCalled();
  });

  it("rejects invalid refresh tokens without rotating", async () => {
    getActiveMcpRefreshTokenByHashMock.mockResolvedValueOnce(undefined);

    await expect(
      refreshMcpAccessTokenWithRefreshToken(db, {
        clientId: "mcp_client_test",
        currentRefreshToken: missingRefreshTokenSecret,
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "test-secret",
      })
    ).rejects.toEqual(
      new McpOAuthError("invalid_grant", "Refresh token is invalid.")
    );
    expect(rotateMcpRefreshTokenMock).not.toHaveBeenCalled();
  });

  it("rejects malformed refresh tokens before hashing or loading them", async () => {
    await expect(
      refreshMcpAccessTokenWithRefreshToken(db, {
        clientId: "mcp_client_test",
        currentRefreshToken: "not-a-refresh-token",
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "test-secret",
      })
    ).rejects.toEqual(
      new McpOAuthError("invalid_grant", "Refresh token is invalid.")
    );
    expect(getActiveMcpRefreshTokenByHashMock).not.toHaveBeenCalled();
    expect(rotateMcpRefreshTokenMock).not.toHaveBeenCalled();
  });

  it("rejects refresh tokens bound to another client", async () => {
    await expect(
      refreshMcpAccessTokenWithRefreshToken(db, {
        clientId: "mcp_client_other",
        currentRefreshToken: refreshTokenSecret,
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "test-secret",
      })
    ).rejects.toEqual(
      new McpOAuthError("invalid_grant", "Refresh token is invalid.")
    );
    expect(getMcpOauthGrantByPublicIdMock).not.toHaveBeenCalled();
    expect(rotateMcpRefreshTokenMock).not.toHaveBeenCalled();
  });

  it("rejects refresh tokens whose stored grant binding changed", async () => {
    getMcpOauthGrantByPublicIdMock.mockResolvedValueOnce({
      clientPublicId: "mcp_client_test",
      clerkOrgId: "org_other",
      clerkUserId: "user_test",
      publicId: "mcp_grant_test",
      resource,
      scopes: ["mcp:signals:read"],
      status: "active",
    });

    await expect(
      refreshMcpAccessTokenWithRefreshToken(db, {
        clientId: "mcp_client_test",
        currentRefreshToken: refreshTokenSecret,
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "test-secret",
      })
    ).rejects.toEqual(
      new McpOAuthError("invalid_grant", "Refresh token is invalid.")
    );
    expect(rotateMcpRefreshTokenMock).not.toHaveBeenCalled();
  });

  it("rejects refresh tokens whose loaded grant id differs", async () => {
    getMcpOauthGrantByPublicIdMock.mockResolvedValueOnce({
      clientPublicId: "mcp_client_test",
      clerkOrgId: "org_test",
      clerkUserId: "user_test",
      publicId: "mcp_grant_other",
      resource,
      scopes: ["mcp:signals:read"],
      status: "active",
    });

    await expect(
      refreshMcpAccessTokenWithRefreshToken(db, {
        clientId: "mcp_client_test",
        currentRefreshToken: refreshTokenSecret,
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "test-secret",
      })
    ).rejects.toEqual(
      new McpOAuthError("invalid_grant", "Refresh token is invalid.")
    );
    expect(rotateMcpRefreshTokenMock).not.toHaveBeenCalled();
  });

  it("rotates opaque refresh tokens", async () => {
    await expect(
      rotateMcpRefreshTokenSecret(db, {
        currentRefreshToken: refreshTokenSecret,
        expiresAt: new Date("2026-08-01T00:00:00.000Z"),
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "test-secret",
      })
    ).resolves.toMatchObject({
      access_token: expect.any(String),
      expires_in: 900,
      grant_id: "mcp_grant_test",
      refresh_token: expect.stringMatching(/^mcp_refresh_/),
      reuseDetected: false,
      scope: "mcp:signals:read",
      token_type: "Bearer",
    });

    expect(rotateMcpRefreshTokenMock).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        currentTokenHash: hashOpaqueToken(refreshTokenSecret),
        nextTokenHash: expect.any(String),
      })
    );
  });

  it("rejects malformed refresh tokens before rotating", async () => {
    await expect(
      rotateMcpRefreshTokenSecret(db, {
        currentRefreshToken: "not-a-refresh-token",
        expiresAt: new Date("2026-08-01T00:00:00.000Z"),
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "test-secret",
      })
    ).rejects.toEqual(
      new McpOAuthError("invalid_grant", "Refresh token is invalid.")
    );

    expect(rotateMcpRefreshTokenMock).not.toHaveBeenCalled();
  });

  it("revokes a token family on reuse", async () => {
    rotateMcpRefreshTokenMock.mockResolvedValueOnce({
      refreshToken: refreshToken({
        grantPublicId: "mcp_grant_test",
        status: "reuse_detected",
      }),
      reuseDetected: true,
    });

    await expect(
      rotateMcpRefreshTokenSecret(db, {
        currentRefreshToken: refreshTokenSecret,
        expiresAt: new Date("2026-08-01T00:00:00.000Z"),
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "test-secret",
      })
    ).rejects.toEqual(
      new McpOAuthError("invalid_grant", "Refresh token reuse detected.")
    );

    expect(revokeMcpOauthGrantMock).toHaveBeenCalledWith(db, {
      publicId: "mcp_grant_test",
    });
  });

  it("rejects rotated refresh tokens whose loaded grant binding differs", async () => {
    getMcpOauthGrantByPublicIdMock.mockResolvedValueOnce({
      clientPublicId: "mcp_client_test",
      clerkOrgId: "org_other",
      clerkUserId: "user_test",
      publicId: "mcp_grant_test",
      resource,
      scopes: ["mcp:signals:read"],
      status: "active",
    });

    await expect(
      rotateMcpRefreshTokenSecret(db, {
        currentRefreshToken: refreshTokenSecret,
        expiresAt: new Date("2026-08-01T00:00:00.000Z"),
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "test-secret",
      })
    ).rejects.toEqual(
      new McpOAuthError("invalid_grant", "Refresh token is invalid.")
    );
  });
});
