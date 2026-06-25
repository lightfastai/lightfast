import type { Database, McpOauthRefreshToken } from "@db/app";
import { SignJWT } from "@vendor/jose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rotateMcpRefreshTokenMock = vi.fn();
const revokeMcpOauthGrantMock = vi.fn();
const getMcpOauthGrantByPublicIdMock = vi.fn();

vi.mock("@db/app", () => ({
  getMcpOauthGrantByPublicId: getMcpOauthGrantByPublicIdMock,
  revokeMcpOauthGrant: revokeMcpOauthGrantMock,
  rotateMcpRefreshToken: rotateMcpRefreshTokenMock,
}));

const {
  createJwtSecretKey,
  hashOpaqueToken,
  rotateMcpRefreshTokenSecret,
  signMcpAccessToken,
  verifyMcpAccessToken,
} = await import("../mcp-oauth/tokens");
const { McpOAuthError } = await import("../mcp-oauth/types");

const db = { kind: "mock-db" } as unknown as Database;
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
  getMcpOauthGrantByPublicIdMock.mockReset();
  rotateMcpRefreshTokenMock.mockReset();
  revokeMcpOauthGrantMock.mockReset();
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
  it("rotates opaque refresh tokens", async () => {
    await expect(
      rotateMcpRefreshTokenSecret(db, {
        currentRefreshToken: "refresh_old",
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
        currentTokenHash: hashOpaqueToken("refresh_old"),
        nextTokenHash: expect.any(String),
      })
    );
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
        currentRefreshToken: "refresh_old",
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
});
