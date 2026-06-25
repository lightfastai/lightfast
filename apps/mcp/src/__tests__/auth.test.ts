import { SignJWT } from "@vendor/jose";
import { afterEach, describe, expect, it, vi } from "vitest";

const audience = "https://mcp.lightfast.localhost/mcp";
const issuer = "https://app.lightfast.localhost";
const jwtSecret = "test-mcp-jwt-secret-test-mcp-jwt-secret";

async function importVerifier() {
  vi.stubEnv("MCP_AUTH_ISSUER", issuer);
  vi.stubEnv("APP_INTERNAL_URL", "https://app.lightfast.localhost");
  vi.stubEnv("MCP_RESOURCE_URL", audience);
  vi.stubEnv("SERVICE_JWT_SECRET", jwtSecret);

  return await import("../auth/verify-token");
}

function stubGrantValidation(
  response: Response = Response.json({ active: true })
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response)
  );
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
    algorithm?: "HS256" | "HS512";
    audience?: string;
    expiresIn?: number | string;
    includeExpiration?: boolean;
    includeOrg?: boolean;
    includeTokenUse?: boolean;
    scope?: string;
    subject?: string;
  } = {}
): Promise<string> {
  const token = new SignJWT({
    client_id: "mcp_client_test",
    grant_id: "mcp_grant_test",
    ...(input.includeOrg === false ? {} : { org_id: "org_test" }),
    scope: input.scope ?? "mcp:system:read",
    ...(input.includeTokenUse === false ? {} : { token_use: "mcp_access" }),
    user_id: "user_test",
  })
    .setProtectedHeader({ alg: input.algorithm ?? "HS256", typ: "JWT" })
    .setIssuer(issuer)
    .setAudience(input.audience ?? audience)
    .setSubject(input.subject ?? "user_test")
    .setIssuedAt();

  if (input.includeExpiration !== false) {
    token.setExpirationTime(input.expiresIn ?? "15m");
  }

  return await token.sign(jwtSecretKey());
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

  it("rejects whitespace-only bearer tokens as missing", async () => {
    const { verifyMcpBearerToken } = await importVerifier();

    await expect(
      verifyMcpBearerToken(
        new Request(audience, { headers: { authorization: "Bearer   " } })
      )
    ).rejects.toMatchObject({
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

  it("rejects JWTs signed with an unexpected algorithm", async () => {
    const { verifyMcpBearerToken } = await importVerifier();
    const token = await validAccessToken({ algorithm: "HS512" });

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

  it("rejects JWTs without an expiration", async () => {
    const { verifyMcpBearerToken } = await importVerifier();
    const token = await validAccessToken({ includeExpiration: false });

    await expect(
      verifyMcpBearerToken(bearerRequest(token))
    ).rejects.toMatchObject({
      code: "invalid_token",
      status: 401,
    });
  });

  it("rejects JWTs whose subject differs from the user claim", async () => {
    const { verifyMcpBearerToken } = await importVerifier();
    const token = await validAccessToken({ subject: "user_other" });

    await expect(
      verifyMcpBearerToken(bearerRequest(token))
    ).rejects.toMatchObject({
      code: "invalid_token",
      status: 401,
    });
  });

  it("rejects JWTs with an excessive lifetime", async () => {
    const { verifyMcpBearerToken } = await importVerifier();
    const token = await validAccessToken({ expiresIn: "1h" });

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
    stubGrantValidation();
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
    expect(fetch).toHaveBeenCalledWith(
      "https://app.lightfast.localhost/api/internal/mcp/auth/validate",
      expect.objectContaining({
        body: JSON.stringify({
          clientId: "mcp_client_test",
          grantId: "mcp_grant_test",
          orgId: "org_test",
          resource: audience,
          userId: "user_test",
        }),
        method: "POST",
      })
    );
  });

  it("accepts provider routine MCP scopes", async () => {
    stubGrantValidation();
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

  it("rejects JWTs with a blank scope claim", async () => {
    const { verifyMcpBearerToken } = await importVerifier();
    const token = await validAccessToken({ scope: "   " });

    await expect(
      verifyMcpBearerToken(bearerRequest(token))
    ).rejects.toMatchObject({
      code: "invalid_token",
      status: 401,
    });
  });

  it("rejects locally valid JWTs when the app grant is inactive", async () => {
    stubGrantValidation(
      Response.json(
        {
          error: "mcp_grant_invalid",
          message: "MCP authorization grant is invalid.",
        },
        { status: 403 }
      )
    );
    const { verifyMcpBearerToken } = await importVerifier();
    const token = await validAccessToken();

    await expect(
      verifyMcpBearerToken(bearerRequest(token))
    ).rejects.toMatchObject({
      code: "invalid_token",
      status: 401,
    });
  });

  it("rejects locally valid JWTs when app grant validation returns malformed success", async () => {
    stubGrantValidation(Response.json({ ok: true }));
    const { verifyMcpBearerToken } = await importVerifier();
    const token = await validAccessToken();

    await expect(
      verifyMcpBearerToken(bearerRequest(token))
    ).rejects.toMatchObject({
      code: "invalid_token",
      status: 401,
    });
  });

  it("temporarily rejects locally valid JWTs when app grant validation cannot authenticate MCP", async () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    stubGrantValidation(
      Response.json(
        {
          error: "invalid_token",
          message: "Service token is invalid.",
        },
        { status: 401 }
      )
    );
    const { verifyMcpBearerToken } = await importVerifier();
    const token = await validAccessToken();

    await expect(
      verifyMcpBearerToken(bearerRequest(token))
    ).rejects.toMatchObject({
      code: "service_unavailable",
      status: 503,
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[mcp-auth] Grant liveness validation unavailable",
      expect.objectContaining({ message: "unexpected_status_401" })
    );
    consoleWarnSpy.mockRestore();
  });

  it("temporarily rejects locally valid JWTs when app grant validation route is missing", async () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    stubGrantValidation(
      Response.json(
        {
          error: "not_found",
          message: "Grant validation route is missing.",
        },
        { status: 404 }
      )
    );
    const { verifyMcpBearerToken } = await importVerifier();
    const token = await validAccessToken();

    await expect(
      verifyMcpBearerToken(bearerRequest(token))
    ).rejects.toMatchObject({
      code: "service_unavailable",
      status: 503,
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[mcp-auth] Grant liveness validation unavailable",
      expect.objectContaining({ message: "unexpected_status_404" })
    );
    consoleWarnSpy.mockRestore();
  });

  it("temporarily rejects locally valid JWTs when app grant validation is unavailable", async () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    stubGrantValidation(
      Response.json(
        {
          error: "service_unavailable",
          message: "Grant validation is unavailable.",
        },
        { status: 503 }
      )
    );
    const { verifyMcpBearerToken } = await importVerifier();
    const token = await validAccessToken();

    await expect(
      verifyMcpBearerToken(bearerRequest(token))
    ).rejects.toMatchObject({
      code: "service_unavailable",
      status: 503,
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[mcp-auth] Grant liveness validation unavailable",
      expect.objectContaining({ message: "unexpected_status_503" })
    );
    consoleWarnSpy.mockRestore();
  });

  it("temporarily rejects locally valid JWTs when app grant validation times out", async () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("Grant validation timed out.", "TimeoutError");
      })
    );
    const { verifyMcpBearerToken } = await importVerifier();
    const token = await validAccessToken();

    await expect(
      verifyMcpBearerToken(bearerRequest(token))
    ).rejects.toMatchObject({
      code: "service_unavailable",
      status: 503,
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://app.lightfast.localhost/api/internal/mcp/auth/validate",
      expect.objectContaining({
        method: "POST",
        signal: expect.any(AbortSignal),
      })
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[mcp-auth] Grant liveness validation unavailable",
      expect.objectContaining({ message: "request_failed" })
    );
    consoleWarnSpy.mockRestore();
  });

  it("accepts decision MCP scope", async () => {
    stubGrantValidation();
    const { verifyMcpBearerToken } = await importVerifier();
    const token = await validAccessToken({
      scope: "mcp:decisions:read",
    });

    await expect(
      verifyMcpBearerToken(bearerRequest(token))
    ).resolves.toMatchObject({
      scopes: new Set(["mcp:decisions:read"]),
    });
  });
});
