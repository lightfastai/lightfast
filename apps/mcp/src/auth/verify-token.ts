import type { McpScope } from "@repo/api-contract";
import { type JWTPayload, jwtVerify } from "@vendor/jose";
import { z } from "zod";

import { env } from "../env";

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
    grant_id: z.string().min(1),
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
  grant_id: string;
  iss: string;
  org_id: string;
  scope: string;
  sub: string;
  token_use: "mcp_access";
  user_id: string;
}

export type McpTokenVerificationErrorCode = "invalid_token" | "missing_token";

export class McpTokenVerificationError extends Error {
  readonly status = 401;

  constructor(
    public readonly code: McpTokenVerificationErrorCode,
    message: string,
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
        audience: env.MCP_RESOURCE_URL,
        issuer: env.MCP_AUTH_ISSUER,
      }
    );
    const parsedPayload = mcpAccessTokenPayloadSchema.parse(payload);
    const scopes = parseScopes(parsedPayload.scope);

    return {
      payload: parsedPayload as McpAccessTokenPayload,
      scopes,
      token,
    };
  } catch (error) {
    if (error instanceof McpTokenVerificationError) {
      throw error;
    }
    throw new McpTokenVerificationError(
      "invalid_token",
      "Bearer token is invalid.",
      { cause: error }
    );
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
          { cause: error }
        );

  return Response.json(
    {
      error: authError.code,
      error_description: authError.message,
    },
    {
      headers: {
        "WWW-Authenticate": `Bearer error="${authError.code}"`,
      },
      status: authError.status,
    }
  );
}

function readBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    throw new McpTokenVerificationError(
      "missing_token",
      "Bearer token is required."
    );
  }
  return match[1].trim();
}

function parseScopes(scope: string): Set<McpScope> {
  const scopes = new Set<McpScope>();
  for (const value of scope.split(/\s+/).filter(Boolean)) {
    scopes.add(mcpScopeSchema.parse(value));
  }
  return scopes;
}
