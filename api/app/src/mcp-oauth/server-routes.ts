import { db } from "@db/app/client";

import {
  exchangeMcpAuthorizationCode,
  getMcpOAuthJwks,
  getRegisteredMcpOAuthClient,
  registerMcpOAuthClient,
  revokeMcpRefreshTokenSecret,
  rotateMcpRefreshTokenSecret,
} from ".";
import { MCP_SUPPORTED_SCOPES, McpOAuthError } from "./types";

export function handleMcpOAuthAuthorizationServerMetadataRequest(): Response {
  try {
    const issuer = oauthUrl("");
    return oauthJson({
      authorization_endpoint: oauthUrl("/oauth/authorize"),
      code_challenge_methods_supported: ["S256"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      issuer,
      jwks_uri: oauthUrl("/oauth/jwks"),
      registration_endpoint: oauthUrl("/oauth/register"),
      response_types_supported: ["code"],
      revocation_endpoint: oauthUrl("/oauth/revoke"),
      scopes_supported: MCP_SUPPORTED_SCOPES,
      token_endpoint: oauthUrl("/oauth/token"),
      token_endpoint_auth_methods_supported: ["none"],
    });
  } catch (error) {
    return oauthError(error);
  }
}

export function handleMcpOAuthJwksRequest(): Response {
  return oauthJson(getMcpOAuthJwks());
}

export async function handleRegisterMcpOAuthClientRequest(
  request: Request
): Promise<Response> {
  try {
    const body = (await readOAuthBody(request)) as Parameters<
      typeof registerMcpOAuthClient
    >[1];
    const result = await registerMcpOAuthClient(db, body);
    return oauthJson(result, { status: 201 });
  } catch (error) {
    return oauthError(error);
  }
}

export async function handleGetRegisteredMcpOAuthClientRequest(
  request: Request,
  input: { clientId: string }
): Promise<Response> {
  try {
    const registrationAccessToken = bearerToken(request);
    if (!registrationAccessToken) {
      throw new McpOAuthError(
        "invalid_client",
        "Registration access token is required.",
        401
      );
    }

    const client = await getRegisteredMcpOAuthClient(db, {
      registrationAccessToken,
    });
    if (client.client_id !== input.clientId) {
      throw new McpOAuthError("invalid_client", "Client id mismatch.", 401);
    }
    return oauthJson(client);
  } catch (error) {
    return oauthError(error);
  }
}

export async function handleMcpOAuthTokenRequest(
  request: Request
): Promise<Response> {
  try {
    const body = await readOAuthBody(request);
    if (body.grant_type === "authorization_code") {
      const result = await exchangeMcpAuthorizationCode(db, {
        clientId: requireField(body, "client_id"),
        code: requireField(body, "code"),
        codeVerifier: requireField(body, "code_verifier"),
        issuer: oauthIssuer(),
        jwtSecret: requireOAuthServiceJwtSecret(),
        redirectUri: requireField(body, "redirect_uri"),
      });
      return oauthJson(result);
    }
    if (body.grant_type === "refresh_token") {
      const result = await rotateMcpRefreshTokenSecret(db, {
        currentRefreshToken: requireField(body, "refresh_token"),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        issuer: oauthIssuer(),
        jwtSecret: requireOAuthServiceJwtSecret(),
      });
      return oauthJson(result);
    }
    throw new McpOAuthError(
      "unsupported_grant_type",
      "Unsupported grant type."
    );
  } catch (error) {
    return oauthError(error);
  }
}

export async function handleMcpOAuthRevokeRequest(
  request: Request
): Promise<Response> {
  try {
    const body = await readOAuthBody(request);
    await revokeMcpRefreshTokenSecret(db, {
      refreshToken: typeof body.token === "string" ? body.token : "",
    });
    return oauthJson({});
  } catch (error) {
    return oauthError(error);
  }
}

function oauthIssuer(): string {
  const issuer = process.env.VITE_LIGHTFAST_APP_URL;
  if (!issuer) {
    throw new Error("MCP OAuth issuer is not configured.");
  }
  return issuer.replace(/\/$/, "");
}

function oauthUrl(path: string): string {
  return `${oauthIssuer()}${path}`;
}

function oauthJson(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  headers.set("content-type", "application/json");
  return Response.json(data, { ...init, headers });
}

function oauthError(error: unknown): Response {
  if (error instanceof McpOAuthError) {
    return oauthJson(
      {
        error: error.error,
        error_description: error.message,
      },
      { status: error.status }
    );
  }

  console.error("[mcp-oauth] Unexpected route error", error);
  return oauthJson(
    {
      error: "server_error",
      error_description: "Unexpected OAuth error.",
    },
    { status: 500 }
  );
}

async function readOAuthBody(
  request: Request
): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const body: Record<string, unknown> = {};
    const formData = await request.formData();
    formData.forEach((value, key) => {
      body[key] = value;
    });
    return body;
  }
  return (await request.json().catch(() => ({}))) as Record<string, unknown>;
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  return authorization.slice("Bearer ".length).trim() || null;
}

function requireOAuthServiceJwtSecret(): string {
  const secret = process.env.SERVICE_JWT_SECRET;
  if (!secret) {
    throw new Error("OAuth service signing secret is not configured.");
  }
  return secret;
}

function requireField(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || !value) {
    throw new McpOAuthError("invalid_request", `${key} is required.`);
  }
  return value;
}
