import type { McpScope } from "@repo/api-contract";
import { type JWTPayload, jwtVerify } from "@vendor/jose";
import { z } from "zod";

import { env } from "../env";
import {
  McpGrantValidationUnavailableError,
  validateMcpGrantViaApp,
} from "./validate-grant";

const MCP_ACCESS_TOKEN_MAX_TTL_SECONDS = 15 * 60;

const mcpScopeSchema = z.enum([
  "mcp:system:read",
  "mcp:provider_routines:read",
  "mcp:provider_routines:write",
  "mcp:signals:read",
  "mcp:signals:write",
]);

const mcpAccessTokenPayloadSchema = z
  .object({
    aud: z.union([z.string(), z.array(z.string())]),
    client_id: z.string().min(1),
    exp: z.number().int().positive(),
    grant_id: z.string().min(1),
    iat: z.number().int().positive(),
    iss: z.string().min(1),
    org_id: z.string().min(1),
    scope: z.string().min(1),
    sub: z.string().min(1),
    token_use: z.literal("mcp_access"),
    user_id: z.string().min(1),
  })
  .passthrough();

export interface McpAccessTokenPayload extends JWTPayload {
  aud: string | string[];
  client_id: string;
  exp: number;
  grant_id: string;
  iat: number;
  iss: string;
  org_id: string;
  scope: string;
  sub: string;
  token_use: "mcp_access";
  user_id: string;
}

export type McpTokenVerificationErrorCode =
  | "invalid_token"
  | "missing_token"
  | "service_unavailable";

export class McpTokenVerificationError extends Error {
  constructor(
    public readonly code: McpTokenVerificationErrorCode,
    message: string,
    public readonly status: 401 | 503 = 401,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "McpTokenVerificationError";
  }
}

export interface VerifiedMcpBearerToken {
  payload: McpAccessTokenPayload;
  scopes: Set<McpScope>;
  token: string;
}

export async function verifyMcpBearerToken(
  request: Request
): Promise<VerifiedMcpBearerToken> {
  const token = readBearerToken(request);
  return await verifyMcpAccessTokenValue(token);
}

export async function verifyMcpAccessTokenValue(
  token: string
): Promise<VerifiedMcpBearerToken> {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(env.SERVICE_JWT_SECRET),
      {
        algorithms: ["HS256"],
        audience: env.MCP_RESOURCE_URL,
        issuer: env.MCP_AUTH_ISSUER,
      }
    );
    const parsedPayload = mcpAccessTokenPayloadSchema.parse(payload);
    validateAccessTokenClaims(parsedPayload);
    const scopes = parseScopes(parsedPayload.scope);
    await validateMcpGrantViaApp({
      clientId: parsedPayload.client_id,
      grantId: parsedPayload.grant_id,
      orgId: parsedPayload.org_id,
      resource: env.MCP_RESOURCE_URL,
      userId: parsedPayload.user_id,
    });

    return {
      payload: parsedPayload as McpAccessTokenPayload,
      scopes,
      token,
    };
  } catch (error) {
    if (error instanceof McpTokenVerificationError) {
      throw error;
    }
    if (error instanceof McpGrantValidationUnavailableError) {
      throw new McpTokenVerificationError(
        "service_unavailable",
        error.message,
        503,
        { cause: error }
      );
    }
    throw new McpTokenVerificationError(
      "invalid_token",
      "Bearer token is invalid.",
      401,
      { cause: error }
    );
  }
}

function validateAccessTokenClaims(
  payload: z.output<typeof mcpAccessTokenPayloadSchema>
): void {
  if (payload.sub !== payload.user_id) {
    throw new Error("MCP access token subject does not match user.");
  }
  if (
    payload.exp <= payload.iat ||
    payload.exp - payload.iat > MCP_ACCESS_TOKEN_MAX_TTL_SECONDS
  ) {
    throw new Error("MCP access token lifetime is invalid.");
  }
}

export async function verifyMcpAuthInfo(
  _request: Request,
  bearerToken?: string
): Promise<
  | {
      clientId: string;
      expiresAt?: number;
      extra: Record<string, unknown>;
      resource: URL;
      scopes: string[];
      token: string;
    }
  | undefined
> {
  if (!bearerToken) {
    return;
  }

  const verified = await verifyMcpAccessTokenValue(bearerToken);
  return {
    clientId: verified.payload.client_id,
    expiresAt: verified.payload.exp,
    extra: {
      clientVerificationStatus: "verified",
      grantId: verified.payload.grant_id,
      orgId: verified.payload.org_id,
      userId: verified.payload.user_id,
    },
    resource: new URL(env.MCP_RESOURCE_URL),
    scopes: [...verified.scopes],
    token: verified.token,
  };
}

export function mcpUnauthorizedResponse(error: unknown): Response {
  const authError =
    error instanceof McpTokenVerificationError
      ? error
      : new McpTokenVerificationError(
          "invalid_token",
          "Bearer token is invalid.",
          401,
          { cause: error }
        );

  const headers: Record<string, string> =
    authError.status === 401
      ? { "WWW-Authenticate": `Bearer error="${authError.code}"` }
      : { "Retry-After": "2" };

  return Response.json(
    {
      error: authError.code,
      error_description: authError.message,
    },
    {
      headers,
      status: authError.status,
    }
  );
}

function readBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) {
    throw new McpTokenVerificationError(
      "missing_token",
      "Bearer token is required.",
      401
    );
  }
  return token;
}

function parseScopes(scope: string): Set<McpScope> {
  const scopes = new Set<McpScope>();
  for (const value of scope.split(/\s+/).filter(Boolean)) {
    scopes.add(mcpScopeSchema.parse(value));
  }
  if (scopes.size === 0) {
    throw new Error("MCP access token scope is invalid.");
  }
  return scopes;
}
