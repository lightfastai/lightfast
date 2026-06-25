import type { McpScope } from "@repo/api-contract";

export const MCP_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const MCP_AUTHORIZATION_CODE_TTL_SECONDS = 10 * 60;
export const MCP_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export const MCP_SUPPORTED_SCOPES = [
  "mcp:system:read",
  "mcp:decisions:read",
  "mcp:provider_routines:read",
  "mcp:provider_routines:write",
  "mcp:signals:read",
  "mcp:signals:write",
] as const satisfies readonly McpScope[];

export type McpOAuthErrorCode =
  | "access_denied"
  | "invalid_client"
  | "invalid_grant"
  | "invalid_request"
  | "unauthorized_client"
  | "unsupported_grant_type";

export class McpOAuthError extends Error {
  constructor(
    public readonly error: McpOAuthErrorCode,
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = "McpOAuthError";
  }
}

export function parseMcpScopes(scope: string | undefined): McpScope[] {
  const scopeValue = scope?.trim() ? scope : "mcp:system:read";
  const requested = scopeValue
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);

  const scopes = new Set<McpScope>();
  for (const value of requested) {
    if (!MCP_SUPPORTED_SCOPES.includes(value as McpScope)) {
      throw new McpOAuthError(
        "invalid_request",
        `Unsupported MCP OAuth scope: ${value}.`
      );
    }
    scopes.add(value as McpScope);
  }
  return [...scopes];
}
