import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const exchangeMcpAuthorizationCodeMock = vi.fn();
const getMcpOAuthJwksMock = vi.fn();
const getRegisteredMcpOAuthClientMock = vi.fn();
const refreshMcpAccessTokenWithRefreshTokenMock = vi.fn();
const registerMcpOAuthClientMock = vi.fn();
const rotateMcpRefreshTokenSecretMock = vi.fn();
const revokeMcpRefreshTokenSecretMock = vi.fn();

vi.mock("../mcp-oauth/index", () => ({
  exchangeMcpAuthorizationCode: exchangeMcpAuthorizationCodeMock,
  getMcpOAuthJwks: getMcpOAuthJwksMock,
  getRegisteredMcpOAuthClient: getRegisteredMcpOAuthClientMock,
  refreshMcpAccessTokenWithRefreshToken:
    refreshMcpAccessTokenWithRefreshTokenMock,
  registerMcpOAuthClient: registerMcpOAuthClientMock,
  rotateMcpRefreshTokenSecret: rotateMcpRefreshTokenSecretMock,
  revokeMcpRefreshTokenSecret: revokeMcpRefreshTokenSecretMock,
}));

const { handleMcpOAuthRevokeRequest, handleMcpOAuthTokenRequest } =
  await import("../mcp-oauth/server-routes");
const { McpOAuthError } = await import("../mcp-oauth/types");

const authorizationCode = `mcp_code_${"c".repeat(43)}`;
const codeVerifier = "v".repeat(43);
const refreshToken = `mcp_refresh_${"r".repeat(43)}`;
const resource = "https://mcp.lightfast.localhost/mcp";

async function responseJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

describe("MCP OAuth server routes", () => {
  beforeEach(() => {
    vi.stubEnv("SERVICE_JWT_SECRET", "s".repeat(32));
    vi.stubEnv("VITE_LIGHTFAST_APP_URL", "https://app.lightfast.localhost");

    exchangeMcpAuthorizationCodeMock.mockReset();
    getMcpOAuthJwksMock.mockReset();
    getRegisteredMcpOAuthClientMock.mockReset();
    refreshMcpAccessTokenWithRefreshTokenMock.mockReset();
    registerMcpOAuthClientMock.mockReset();
    rotateMcpRefreshTokenSecretMock.mockReset();
    revokeMcpRefreshTokenSecretMock.mockReset();

    exchangeMcpAuthorizationCodeMock.mockResolvedValue({
      access_token: "access-token",
      expires_in: 900,
      grant_id: "mcp_grant_test",
      refresh_token: "refresh-token",
      scope: "mcp:system:read",
      token_type: "Bearer",
    });
    refreshMcpAccessTokenWithRefreshTokenMock.mockResolvedValue({
      access_token: "access-token",
      expires_in: 900,
      grant_id: "mcp_grant_test",
      scope: "mcp:system:read",
      token_type: "Bearer",
    });
    revokeMcpRefreshTokenSecretMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes token request resource through authorization code exchange", async () => {
    const response = await handleMcpOAuthTokenRequest(
      new Request("https://app.lightfast.localhost/oauth/token", {
        body: JSON.stringify({
          client_id: "mcp_client_test",
          code: authorizationCode,
          code_verifier: codeVerifier,
          grant_type: "authorization_code",
          redirect_uri: "https://client.example/callback",
          resource,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      })
    );

    expect(response.status).toBe(200);
    expect(exchangeMcpAuthorizationCodeMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        audience: resource,
        clientId: "mcp_client_test",
        code: authorizationCode,
        codeVerifier,
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "s".repeat(32),
        redirectUri: "https://client.example/callback",
      })
    );
  });

  it("returns invalid_request when authorization code resource mismatches the grant", async () => {
    exchangeMcpAuthorizationCodeMock.mockRejectedValueOnce(
      new McpOAuthError(
        "invalid_request",
        "Access token audience must match the authorized MCP resource."
      )
    );

    const response = await handleMcpOAuthTokenRequest(
      new Request("https://app.lightfast.localhost/oauth/token", {
        body: JSON.stringify({
          client_id: "mcp_client_test",
          code: authorizationCode,
          code_verifier: codeVerifier,
          grant_type: "authorization_code",
          redirect_uri: "https://client.example/callback",
          resource: "https://attacker.example/mcp",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      })
    );

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "invalid_request",
      error_description:
        "Access token audience must match the authorized MCP resource.",
    });
    expect(exchangeMcpAuthorizationCodeMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        audience: "https://attacker.example/mcp",
      })
    );
  });

  it("passes token request resource through refresh token exchange", async () => {
    const response = await handleMcpOAuthTokenRequest(
      new Request("https://app.lightfast.localhost/oauth/token", {
        body: JSON.stringify({
          client_id: "mcp_client_test",
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          resource,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      })
    );

    expect(response.status).toBe(200);
    const body = await responseJson(response);
    expect(body).toMatchObject({
      access_token: "access-token",
      expires_in: 900,
      grant_id: "mcp_grant_test",
      scope: "mcp:system:read",
      token_type: "Bearer",
    });
    expect(body).not.toHaveProperty("refresh_token");
    expect(body).not.toHaveProperty("reuseDetected");
    expect(refreshMcpAccessTokenWithRefreshTokenMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        audience: resource,
        clientId: "mcp_client_test",
        currentRefreshToken: refreshToken,
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "s".repeat(32),
      })
    );
    expect(rotateMcpRefreshTokenSecretMock).not.toHaveBeenCalled();
  });

  it("allows refresh token grants to reuse the same stable refresh token", async () => {
    const requestBody = {
      client_id: "mcp_client_test",
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      resource,
    };

    const firstResponse = await handleMcpOAuthTokenRequest(
      new Request("https://app.lightfast.localhost/oauth/token", {
        body: JSON.stringify(requestBody),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      })
    );
    const secondResponse = await handleMcpOAuthTokenRequest(
      new Request("https://app.lightfast.localhost/oauth/token", {
        body: JSON.stringify(requestBody),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      })
    );

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    await expect(responseJson(firstResponse)).resolves.not.toHaveProperty(
      "refresh_token"
    );
    await expect(responseJson(secondResponse)).resolves.not.toHaveProperty(
      "refresh_token"
    );
    expect(refreshMcpAccessTokenWithRefreshTokenMock).toHaveBeenCalledTimes(2);
    expect(refreshMcpAccessTokenWithRefreshTokenMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        currentRefreshToken: refreshToken,
      })
    );
    expect(refreshMcpAccessTokenWithRefreshTokenMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        currentRefreshToken: refreshToken,
      })
    );
    expect(rotateMcpRefreshTokenSecretMock).not.toHaveBeenCalled();
  });

  it("returns invalid_request when refresh token resource mismatches the grant", async () => {
    refreshMcpAccessTokenWithRefreshTokenMock.mockRejectedValueOnce(
      new McpOAuthError(
        "invalid_request",
        "Access token audience must match the authorized MCP resource."
      )
    );

    const response = await handleMcpOAuthTokenRequest(
      new Request("https://app.lightfast.localhost/oauth/token", {
        body: JSON.stringify({
          client_id: "mcp_client_test",
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          resource: "https://attacker.example/mcp",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      })
    );

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "invalid_request",
      error_description:
        "Access token audience must match the authorized MCP resource.",
    });
    expect(refreshMcpAccessTokenWithRefreshTokenMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        audience: "https://attacker.example/mcp",
      })
    );
    expect(rotateMcpRefreshTokenSecretMock).not.toHaveBeenCalled();
  });

  it("returns invalid_request for non-string token request resource", async () => {
    const response = await handleMcpOAuthTokenRequest(
      new Request("https://app.lightfast.localhost/oauth/token", {
        body: JSON.stringify({
          client_id: "mcp_client_test",
          code: authorizationCode,
          code_verifier: codeVerifier,
          grant_type: "authorization_code",
          redirect_uri: "https://client.example/callback",
          resource: [resource],
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      })
    );

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "invalid_request",
      error_description: "resource is invalid.",
    });
    expect(exchangeMcpAuthorizationCodeMock).not.toHaveBeenCalled();
  });

  it("returns invalid_request for duplicate token request resource parameters", async () => {
    const response = await handleMcpOAuthTokenRequest(
      new Request("https://app.lightfast.localhost/oauth/token", {
        body: new URLSearchParams([
          ["grant_type", "refresh_token"],
          ["client_id", "mcp_client_test"],
          ["refresh_token", refreshToken],
          ["resource", resource],
          ["resource", "https://attacker.example/mcp"],
        ]),
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      })
    );

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "invalid_request",
      error_description: "OAuth request body contains duplicate parameter.",
    });
    expect(refreshMcpAccessTokenWithRefreshTokenMock).not.toHaveBeenCalled();
    expect(rotateMcpRefreshTokenSecretMock).not.toHaveBeenCalled();
  });

  it("returns invalid_request for malformed JSON request bodies", async () => {
    const response = await handleMcpOAuthTokenRequest(
      new Request("https://app.lightfast.localhost/oauth/token", {
        body: "{",
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      })
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "invalid_request",
      error_description: "OAuth request body is invalid.",
    });
  });

  it("returns invalid_request for duplicate form parameters", async () => {
    const response = await handleMcpOAuthTokenRequest(
      new Request("https://app.lightfast.localhost/oauth/token", {
        body: new URLSearchParams([
          ["grant_type", "authorization_code"],
          ["grant_type", "refresh_token"],
        ]),
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      })
    );

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "invalid_request",
      error_description: "OAuth request body contains duplicate parameter.",
    });
  });

  it("returns invalid_request when grant_type is missing", async () => {
    const response = await handleMcpOAuthTokenRequest(
      new Request("https://app.lightfast.localhost/oauth/token", {
        body: JSON.stringify({ client_id: "mcp_client_test" }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      })
    );

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "invalid_request",
      error_description: "grant_type is required.",
    });
  });

  it("returns invalid_request when revocation token is missing", async () => {
    const response = await handleMcpOAuthRevokeRequest(
      new Request("https://app.lightfast.localhost/oauth/revoke", {
        body: JSON.stringify({ token_type_hint: "refresh_token" }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      })
    );

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      error: "invalid_request",
      error_description: "token is required.",
    });
  });
});
