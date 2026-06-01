import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeMcpAuthorizationCodeMock = vi.fn();
const getMcpOAuthJwksMock = vi.fn();
const getRegisteredMcpOAuthClientMock = vi.fn();
const registerMcpOAuthClientMock = vi.fn();
const revokeMcpRefreshTokenSecretMock = vi.fn();
const rotateMcpRefreshTokenSecretMock = vi.fn();

vi.mock("@api/app", () => ({
  MCP_SUPPORTED_SCOPES: [
    "mcp:system:read",
    "mcp:signals:read",
    "mcp:signals:write",
  ],
  exchangeMcpAuthorizationCode: exchangeMcpAuthorizationCodeMock,
  getMcpOAuthJwks: getMcpOAuthJwksMock,
  getRegisteredMcpOAuthClient: getRegisteredMcpOAuthClientMock,
  registerMcpOAuthClient: registerMcpOAuthClientMock,
  revokeMcpRefreshTokenSecret: revokeMcpRefreshTokenSecretMock,
  rotateMcpRefreshTokenSecret: rotateMcpRefreshTokenSecretMock,
}));

vi.mock("@db/app/client", () => ({
  db: { kind: "mock-db" },
}));

vi.mock("~/env", () => ({
  env: {
    NEXT_PUBLIC_APP_URL: "https://app.lightfast.localhost",
    SERVICE_JWT_SECRET: "test-service-jwt-secret-at-least-32-chars",
  },
}));

beforeEach(() => {
  exchangeMcpAuthorizationCodeMock.mockReset();
  getMcpOAuthJwksMock.mockReset();
  getRegisteredMcpOAuthClientMock.mockReset();
  registerMcpOAuthClientMock.mockReset();
  revokeMcpRefreshTokenSecretMock.mockReset();
  rotateMcpRefreshTokenSecretMock.mockReset();
});

describe("MCP OAuth route handlers", () => {
  it("serves authorization server metadata", async () => {
    const { GET } = await import(
      "~/app/(app)/(oauth)/.well-known/oauth-authorization-server/route"
    );

    const res = await GET();

    await expect(res.json()).resolves.toMatchObject({
      authorization_endpoint: "https://app.lightfast.localhost/oauth/authorize",
      code_challenge_methods_supported: ["S256"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      issuer: "https://app.lightfast.localhost",
      registration_endpoint: "https://app.lightfast.localhost/oauth/register",
      revocation_endpoint: "https://app.lightfast.localhost/oauth/revoke",
      token_endpoint: "https://app.lightfast.localhost/oauth/token",
      token_endpoint_auth_methods_supported: ["none"],
    });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("registers a public DCR client", async () => {
    registerMcpOAuthClientMock.mockResolvedValueOnce({
      client_id: "mcp_client_test",
      client_name: "Lightfield",
      redirect_uris: ["https://backend.lightfield.app/callback"],
      registration_access_token: "mcp_reg_secret",
      token_endpoint_auth_method: "none",
    });
    const { POST } = await import("~/app/(app)/(oauth)/oauth/register/route");

    const res = await POST(
      new Request("https://app.lightfast.localhost/oauth/register", {
        body: JSON.stringify({
          client_name: "Lightfield",
          redirect_uris: ["https://backend.lightfield.app/callback"],
          token_endpoint_auth_method: "none",
        }),
        method: "POST",
      })
    );

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({
      client_id: "mcp_client_test",
      registration_access_token: "mcp_reg_secret",
    });
    expect(registerMcpOAuthClientMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ client_name: "Lightfield" })
    );
  });

  it("returns DCR client metadata with a valid registration access token", async () => {
    getRegisteredMcpOAuthClientMock.mockResolvedValueOnce({
      client_id: "mcp_client_test",
      client_name: "Lightfield",
      redirect_uris: ["https://backend.lightfield.app/callback"],
      token_endpoint_auth_method: "none",
    });
    const { GET } = await import(
      "~/app/(app)/(oauth)/oauth/register/[clientId]/route"
    );

    const res = await GET(
      new Request(
        "https://app.lightfast.localhost/oauth/register/mcp_client_test",
        {
          headers: { authorization: "Bearer mcp_reg_secret" },
        }
      ),
      { params: Promise.resolve({ clientId: "mcp_client_test" }) }
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      client_id: "mcp_client_test",
      client_name: "Lightfield",
    });
    expect(getRegisteredMcpOAuthClientMock).toHaveBeenCalledWith(
      expect.anything(),
      { registrationAccessToken: "mcp_reg_secret" }
    );
  });

  it("exchanges an authorization code for MCP tokens", async () => {
    exchangeMcpAuthorizationCodeMock.mockResolvedValueOnce({
      access_token: "access.jwt",
      expires_in: 900,
      refresh_token: "mcp_refresh_secret",
      scope: "mcp:signals:write",
      token_type: "Bearer",
    });
    const { POST } = await import("~/app/(app)/(oauth)/oauth/token/route");

    const res = await POST(
      new Request("https://app.lightfast.localhost/oauth/token", {
        body: JSON.stringify({
          client_id: "mcp_client_test",
          code: "mcp_code_secret",
          code_verifier: "verifier_test",
          grant_type: "authorization_code",
          redirect_uri: "https://backend.lightfield.app/callback",
        }),
        method: "POST",
      })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      access_token: "access.jwt",
      token_type: "Bearer",
    });
    expect(exchangeMcpAuthorizationCodeMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        clientId: "mcp_client_test",
        code: "mcp_code_secret",
        jwtSecret: "test-service-jwt-secret-at-least-32-chars",
      })
    );
  });

  it("rotates a refresh token and returns a new access token", async () => {
    rotateMcpRefreshTokenSecretMock.mockResolvedValueOnce({
      access_token: "access.jwt",
      expires_in: 900,
      grant_id: "mcp_grant_test",
      refresh_token: "mcp_refresh_secret_new",
      scope: "mcp:signals:write",
      token_type: "Bearer",
    });
    const { POST } = await import("~/app/(app)/(oauth)/oauth/token/route");

    const res = await POST(
      new Request("https://app.lightfast.localhost/oauth/token", {
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: "mcp_refresh_secret_old",
        }),
        method: "POST",
      })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      access_token: "access.jwt",
      expires_in: 900,
      refresh_token: "mcp_refresh_secret_new",
      token_type: "Bearer",
    });
    expect(rotateMcpRefreshTokenSecretMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        currentRefreshToken: "mcp_refresh_secret_old",
        issuer: "https://app.lightfast.localhost",
        jwtSecret: "test-service-jwt-secret-at-least-32-chars",
      })
    );
  });

  it("revokes a refresh token", async () => {
    revokeMcpRefreshTokenSecretMock.mockResolvedValueOnce(true);
    const { POST } = await import("~/app/(app)/(oauth)/oauth/revoke/route");

    const res = await POST(
      new Request("https://app.lightfast.localhost/oauth/revoke", {
        body: JSON.stringify({ token: "mcp_refresh_secret" }),
        method: "POST",
      })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({});
    expect(revokeMcpRefreshTokenSecretMock).toHaveBeenCalledWith(
      expect.anything(),
      { refreshToken: "mcp_refresh_secret" }
    );
  });
});
