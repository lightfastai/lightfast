import { SignJWT } from "@vendor/jose";
import { afterEach, describe, expect, it, vi } from "vitest";

const audience = "https://mcp.lightfast.localhost/mcp";
const issuer = "https://app.lightfast.localhost";
const jwtSecret = "test-mcp-jwt-secret-test-mcp-jwt-secret";

async function importVerifier() {
  vi.stubEnv("MCP_AUTH_ISSUER", issuer);
  vi.stubEnv("MCP_RESOURCE_URL", audience);
  vi.stubEnv("SERVICE_JWT_SECRET", jwtSecret);

  return await import("../auth/verify-token");
}

function bearerRequest(token?: string): Request {
  return new Request(audience, {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
}

function jwtSecretKey(): Uint8Array {
  return new TextEncoder().encode(jwtSecret);
}

async function validAccessToken(
  input: {
    audience?: string;
    expiresIn?: number | string;
    includeOrg?: boolean;
    includeTokenUse?: boolean;
    scope?: string;
  } = {}
): Promise<string> {
  return await new SignJWT({
    client_id: "mcp_client_test",
    grant_id: "mcp_grant_test",
    ...(input.includeOrg === false ? {} : { org_id: "org_test" }),
    scope: input.scope ?? "mcp:system:read",
    ...(input.includeTokenUse === false ? {} : { token_use: "mcp_access" }),
    user_id: "user_test",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(issuer)
    .setAudience(input.audience ?? audience)
    .setSubject("user_test")
    .setIssuedAt()
    .setExpirationTime(input.expiresIn ?? "15m")
    .sign(jwtSecretKey());
}

describe("verifyMcpBearerToken", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("rejects missing bearer tokens", async () => {
    const { verifyMcpBearerToken } = await importVerifier();

    await expect(verifyMcpBearerToken(bearerRequest())).rejects.toMatchObject({
      code: "missing_token",
      status: 401,
    });
  });

  it("rejects JWTs with the wrong audience", async () => {
    const { verifyMcpBearerToken } = await importVerifier();
    const token = await validAccessToken({
      audience: "https://other.lightfast.localhost/mcp",
    });

    await expect(
      verifyMcpBearerToken(bearerRequest(token))
    ).rejects.toMatchObject({
      code: "invalid_token",
      status: 401,
    });
  });

  it("rejects JWTs without token_use=mcp_access", async () => {
    const { verifyMcpBearerToken } = await importVerifier();
    const token = await validAccessToken({ includeTokenUse: false });

    await expect(
      verifyMcpBearerToken(bearerRequest(token))
    ).rejects.toMatchObject({
      code: "invalid_token",
      status: 401,
    });
  });

  it("rejects expired JWTs", async () => {
    const { verifyMcpBearerToken } = await importVerifier();
    const token = await validAccessToken({
      expiresIn: Math.floor(Date.now() / 1000) - 60,
    });

    await expect(
      verifyMcpBearerToken(bearerRequest(token))
    ).rejects.toMatchObject({
      code: "invalid_token",
      status: 401,
    });
  });

  it("rejects JWTs without an organization claim", async () => {
    const { verifyMcpBearerToken } = await importVerifier();
    const token = await validAccessToken({ includeOrg: false });

    await expect(
      verifyMcpBearerToken(bearerRequest(token))
    ).rejects.toMatchObject({
      code: "invalid_token",
      status: 401,
    });
  });

  it("accepts a valid MCP access JWT", async () => {
    const { verifyMcpBearerToken } = await importVerifier();
    const token = await validAccessToken();

    await expect(
      verifyMcpBearerToken(bearerRequest(token))
    ).resolves.toMatchObject({
      payload: {
        aud: audience,
        client_id: "mcp_client_test",
        grant_id: "mcp_grant_test",
        iss: issuer,
        org_id: "org_test",
        sub: "user_test",
        token_use: "mcp_access",
        user_id: "user_test",
      },
      scopes: new Set(["mcp:system:read"]),
      token,
    });
  });

  it("accepts provider routine MCP scopes", async () => {
    const { verifyMcpBearerToken } = await importVerifier();
    const token = await validAccessToken({
      scope: "mcp:provider_routines:read mcp:provider_routines:write",
    });

    await expect(
      verifyMcpBearerToken(bearerRequest(token))
    ).resolves.toMatchObject({
      scopes: new Set([
        "mcp:provider_routines:read",
        "mcp:provider_routines:write",
      ]),
    });
  });
});
