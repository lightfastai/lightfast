import type { Database, McpOauthAuthorizationCode } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getMcpOauthClientByClientIdMock = vi.fn();
const getActiveMcpOauthGrantMock = vi.fn();
const createMcpOauthGrantMock = vi.fn();
const createMcpAuthorizationCodeMock = vi.fn();
const consumeMcpAuthorizationCodeMock = vi.fn();
const createMcpRefreshTokenMock = vi.fn();

vi.mock("@db/app", () => ({
  consumeMcpAuthorizationCode: consumeMcpAuthorizationCodeMock,
  createMcpAuthorizationCode: createMcpAuthorizationCodeMock,
  createMcpOauthGrant: createMcpOauthGrantMock,
  createMcpRefreshToken: createMcpRefreshTokenMock,
  getActiveMcpOauthGrant: getActiveMcpOauthGrantMock,
  getMcpOauthClientByClientId: getMcpOauthClientByClientIdMock,
}));

const { McpOAuthError } = await import("../types");
const { createCodeChallenge, exchangeMcpAuthorizationCode } = await import(
  "../tokens"
);
const { issueMcpAuthorizationCode } = await import("../authorization");

const db = { kind: "mock-db" } as unknown as Database;
const now = new Date("2026-06-01T00:00:00.000Z");
const redirectUri = "https://backend.lightfield.app/connections/callback/MCP";
const resource = "https://mcp.lightfast.localhost/mcp";

function authorizationCode(
  overrides: Partial<McpOauthAuthorizationCode> = {}
): McpOauthAuthorizationCode {
  return {
    id: 1,
    clientPublicId: "mcp_client_test",
    clerkOrgId: "org_test",
    clerkUserId: "user_test",
    codeChallenge: createCodeChallenge("verifier_test"),
    codeChallengeMethod: "S256",
    codeHash: "code_hash",
    consumedAt: null,
    expiresAt: new Date("2026-06-01T00:10:00.000Z"),
    redirectUri,
    resource,
    resourceHash: "resource_hash",
    scopes: ["mcp:signals:write"],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  getMcpOauthClientByClientIdMock.mockReset();
  getActiveMcpOauthGrantMock.mockReset();
  createMcpOauthGrantMock.mockReset();
  createMcpAuthorizationCodeMock.mockReset();
  consumeMcpAuthorizationCodeMock.mockReset();
  createMcpRefreshTokenMock.mockReset();

  getMcpOauthClientByClientIdMock.mockResolvedValue({
    publicClientId: "mcp_client_test",
    redirectUris: [redirectUri],
  });
  getActiveMcpOauthGrantMock.mockResolvedValue(undefined);
  createMcpOauthGrantMock.mockResolvedValue({
    clientPublicId: "mcp_client_test",
    clerkOrgId: "org_test",
    clerkUserId: "user_test",
    publicId: "mcp_grant_test",
    resource,
    scopes: ["mcp:signals:write"],
  });
  createMcpAuthorizationCodeMock.mockResolvedValue(authorizationCode());
  consumeMcpAuthorizationCodeMock.mockResolvedValue(authorizationCode());
  createMcpRefreshTokenMock.mockResolvedValue({
    tokenHash: "refresh_hash",
  });
});

describe("issueMcpAuthorizationCode", () => {
  it("stores only a code hash and expires in ten minutes", async () => {
    const result = await issueMcpAuthorizationCode(db, {
      clientId: "mcp_client_test",
      clerkOrgId: "org_test",
      clerkUserId: "user_test",
      codeChallenge: createCodeChallenge("verifier_test"),
      codeChallengeMethod: "S256",
      redirectUri,
      resource,
      scope: "mcp:signals:write",
      now,
    });

    expect(result.code).toMatch(/^mcp_code_/);
    expect(createMcpAuthorizationCodeMock).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        clientPublicId: "mcp_client_test",
        codeHash: expect.any(String),
        expiresAt: new Date("2026-06-01T00:10:00.000Z"),
        scopes: ["mcp:signals:write"],
      })
    );
    const persisted = createMcpAuthorizationCodeMock.mock.calls[0]?.[1];
    expect(persisted).not.toHaveProperty("code");
  });

  it("requires a registered redirect uri", async () => {
    getMcpOauthClientByClientIdMock.mockResolvedValueOnce({
      publicClientId: "mcp_client_test",
      redirectUris: ["https://backend.lightfield.app/other"],
    });

    await expect(
      issueMcpAuthorizationCode(db, {
        clientId: "mcp_client_test",
        clerkOrgId: "org_test",
        clerkUserId: "user_test",
        codeChallenge: createCodeChallenge("verifier_test"),
        codeChallengeMethod: "S256",
        redirectUri,
        resource,
        scope: "mcp:signals:write",
        now,
      })
    ).rejects.toEqual(
      new McpOAuthError("invalid_request", "Redirect URI is not registered.")
    );

    expect(createMcpAuthorizationCodeMock).not.toHaveBeenCalled();
  });

  it("rejects malformed S256 code challenges before persisting", async () => {
    await expect(
      issueMcpAuthorizationCode(db, {
        clientId: "mcp_client_test",
        clerkOrgId: "org_test",
        clerkUserId: "user_test",
        codeChallenge: "not-valid+pkce-challenge",
        codeChallengeMethod: "S256",
        redirectUri,
        resource,
        scope: "mcp:signals:write",
        now,
      })
    ).rejects.toEqual(
      new McpOAuthError("invalid_request", "Invalid PKCE code challenge.")
    );

    expect(createMcpAuthorizationCodeMock).not.toHaveBeenCalled();
  });
});

describe("exchangeMcpAuthorizationCode", () => {
  it("validates PKCE and consumes the code once", async () => {
    await expect(
      exchangeMcpAuthorizationCode(db, {
        audience: resource,
        clientId: "mcp_client_test",
        code: "mcp_code_raw",
        codeVerifier: "verifier_test",
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "test-secret",
        redirectUri,
      })
    ).resolves.toMatchObject({
      scope: "mcp:signals:write",
      token_type: "Bearer",
    });

    expect(consumeMcpAuthorizationCodeMock).toHaveBeenCalledWith(db, {
      codeHash: expect.any(String),
    });
    expect(createMcpRefreshTokenMock).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        grantPublicId: "mcp_grant_test",
        tokenHash: expect.any(String),
      })
    );
  });

  it("rejects invalid, reused, or expired codes before creating refresh tokens", async () => {
    consumeMcpAuthorizationCodeMock.mockResolvedValueOnce(undefined);

    await expect(
      exchangeMcpAuthorizationCode(db, {
        audience: resource,
        clientId: "mcp_client_test",
        code: "mcp_code_raw",
        codeVerifier: "verifier_test",
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "test-secret",
        redirectUri,
      })
    ).rejects.toEqual(
      new McpOAuthError("invalid_grant", "Authorization code is invalid.")
    );

    expect(createMcpRefreshTokenMock).not.toHaveBeenCalled();
  });

  it("rejects authorization codes issued to another client", async () => {
    consumeMcpAuthorizationCodeMock.mockResolvedValueOnce(
      authorizationCode({ clientPublicId: "mcp_client_other" })
    );

    await expect(
      exchangeMcpAuthorizationCode(db, {
        audience: resource,
        clientId: "mcp_client_test",
        code: "mcp_code_raw",
        codeVerifier: "verifier_test",
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "test-secret",
        redirectUri,
      })
    ).rejects.toEqual(
      new McpOAuthError("invalid_grant", "Authorization code is invalid.")
    );

    expect(getActiveMcpOauthGrantMock).not.toHaveBeenCalled();
    expect(createMcpOauthGrantMock).not.toHaveBeenCalled();
    expect(createMcpRefreshTokenMock).not.toHaveBeenCalled();
  });

  it("rejects authorization codes issued to another redirect uri", async () => {
    consumeMcpAuthorizationCodeMock.mockResolvedValueOnce(
      authorizationCode({
        redirectUri: "https://backend.lightfield.app/other-callback",
      })
    );

    await expect(
      exchangeMcpAuthorizationCode(db, {
        audience: resource,
        clientId: "mcp_client_test",
        code: "mcp_code_raw",
        codeVerifier: "verifier_test",
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "test-secret",
        redirectUri,
      })
    ).rejects.toEqual(
      new McpOAuthError("invalid_grant", "Authorization code is invalid.")
    );

    expect(getActiveMcpOauthGrantMock).not.toHaveBeenCalled();
    expect(createMcpOauthGrantMock).not.toHaveBeenCalled();
    expect(createMcpRefreshTokenMock).not.toHaveBeenCalled();
  });

  it("rejects PKCE mismatches before creating refresh tokens", async () => {
    consumeMcpAuthorizationCodeMock.mockResolvedValueOnce(
      authorizationCode({
        codeChallenge: createCodeChallenge("other_verifier"),
      })
    );

    await expect(
      exchangeMcpAuthorizationCode(db, {
        audience: resource,
        clientId: "mcp_client_test",
        code: "mcp_code_raw",
        codeVerifier: "verifier_test",
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "test-secret",
        redirectUri,
      })
    ).rejects.toEqual(
      new McpOAuthError("invalid_grant", "PKCE verification failed.")
    );

    expect(getActiveMcpOauthGrantMock).not.toHaveBeenCalled();
    expect(createMcpOauthGrantMock).not.toHaveBeenCalled();
    expect(createMcpRefreshTokenMock).not.toHaveBeenCalled();
  });

  it.each([
    { clerkOrgId: "org_other", clerkUserId: "user_test" },
    { clerkOrgId: "org_test", clerkUserId: "user_other" },
  ])("rejects grants that do not match the consumed authorization code", async (grantOverride) => {
    getActiveMcpOauthGrantMock.mockResolvedValueOnce({
      clientPublicId: "mcp_client_test",
      publicId: "mcp_grant_test",
      resource,
      scopes: ["mcp:signals:write"],
      ...grantOverride,
    });

    await expect(
      exchangeMcpAuthorizationCode(db, {
        audience: resource,
        clientId: "mcp_client_test",
        code: "mcp_code_raw",
        codeVerifier: "verifier_test",
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "test-secret",
        redirectUri,
      })
    ).rejects.toEqual(
      new McpOAuthError("invalid_grant", "Authorization grant is invalid.")
    );

    expect(createMcpOauthGrantMock).not.toHaveBeenCalled();
    expect(createMcpRefreshTokenMock).not.toHaveBeenCalled();
  });
});
