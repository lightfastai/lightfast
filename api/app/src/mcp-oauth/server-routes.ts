import { db } from "@db/app/client";

import {
  exchangeMcpAuthorizationCode,
  getMcpOAuthJwks,
  getRegisteredMcpOAuthClient,
  registerMcpOAuthClient,
  revokeMcpRefreshTokenSecret,
  rotateMcpRefreshTokenSecret,
} from ".";
import {
  MCP_REFRESH_TOKEN_TTL_SECONDS,
  MCP_SUPPORTED_SCOPES,
  McpOAuthError,
} from "./types";

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
    const grantType = requireField(body, "grant_type");
    if (grantType === "authorization_code") {
      const result = await exchangeMcpAuthorizationCode(db, {
        audience: optionalField(body, "resource"),
        clientId: requireField(body, "client_id"),
        code: requireField(body, "code"),
        codeVerifier: requireField(body, "code_verifier"),
        issuer: oauthIssuer(),
        jwtSecret: requireOAuthServiceJwtSecret(),
        redirectUri: requireField(body, "redirect_uri"),
      });
      return oauthJson(result);
    }
    if (grantType === "refresh_token") {
      const now = new Date();
      const result = await rotateMcpRefreshTokenSecret(db, {
        audience: optionalField(body, "resource"),
        clientId: requireField(body, "client_id"),
        currentRefreshToken: requireField(body, "refresh_token"),
        expiresAt: new Date(
          now.getTime() + MCP_REFRESH_TOKEN_TTL_SECONDS * 1000
        ),
        issuer: oauthIssuer(),
        jwtSecret: requireOAuthServiceJwtSecret(),
        now,
      });
      return oauthJson({
        access_token: result.access_token,
        expires_in: result.expires_in,
        grant_id: result.grant_id,
        refresh_token: result.refresh_token,
        scope: result.scope,
        token_type: result.token_type,
      });
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
      refreshToken: requireField(body, "token"),
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
  headers.set("pragma", "no-cache");
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
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const body: Record<string, unknown> = {};
    try {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        if (Object.hasOwn(body, key)) {
          throw new McpOAuthError(
            "invalid_request",
            "OAuth request body contains duplicate parameter."
          );
        }
        body[key] = value;
      });
      return body;
    } catch (error) {
      if (error instanceof McpOAuthError) {
        throw error;
      }
      throw new McpOAuthError(
        "invalid_request",
        "OAuth request body is invalid."
      );
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new McpOAuthError(
      "invalid_request",
      "OAuth request body is invalid."
    );
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new McpOAuthError(
      "invalid_request",
      "OAuth request body is invalid."
    );
  }
  return body as Record<string, unknown>;
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function requireOAuthServiceJwtSecret(): string {
  const secret = process.env.SERVICE_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("OAuth service signing secret is not securely configured.");
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

function optionalField(
  body: Record<string, unknown>,
  key: string
): string | undefined {
  const value = body[key];
  if (value === undefined || value === null || value === "") {
    return;
  }
  if (typeof value !== "string") {
    throw new McpOAuthError("invalid_request", `${key} is invalid.`);
  }
  return value;
}
