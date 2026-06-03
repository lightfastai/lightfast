import { randomUUID } from "node:crypto";
import type { McpScope } from "@repo/api-contract";
import type { McpAccessTokenPayload } from "./auth/verify-token";

export type McpClientVerificationStatus = "blocked" | "unverified" | "verified";

export interface HostedMcpContext {
  clientId: string;
  clientVerificationStatus: McpClientVerificationStatus;
  grantId: string;
  orgId: string;
  requestId: string;
  scopes: McpScope[];
  userId: string;
}

export async function createMcpContext(
  request: Request
): Promise<HostedMcpContext> {
  const { verifyMcpBearerToken } = await import("./auth/verify-token");
  const verified = await verifyMcpBearerToken(request);

  return {
    clientId: verified.payload.client_id,
    clientVerificationStatus: "verified",
    grantId: verified.payload.grant_id,
    orgId: verified.payload.org_id,
    requestId: request.headers.get("x-request-id") ?? randomUUID(),
    scopes: [...verified.scopes],
    userId: verified.payload.user_id,
  };
}

export interface HostedMcpAuthInfo {
  clientId: string;
  extra?: Record<string, unknown>;
  scopes: string[];
  token: string;
}

export function createMcpContextFromAuthInfo(
  authInfo: HostedMcpAuthInfo | undefined,
  input: { requestId?: string } = {}
): HostedMcpContext {
  if (!authInfo) {
    throw new Error("Authenticated MCP request context is required.");
  }

  const extra = authInfo.extra ?? {};
  const grantId = requireString(extra.grantId, "grantId");
  const orgId = requireString(extra.orgId, "orgId");
  const userId = requireString(extra.userId, "userId");
  const clientVerificationStatus = parseClientVerificationStatus(
    extra.clientVerificationStatus
  );

  return {
    clientId: authInfo.clientId,
    clientVerificationStatus,
    grantId,
    orgId,
    requestId: input.requestId ?? randomUUID(),
    scopes: authInfo.scopes.filter(isMcpScope),
    userId,
  };
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Authenticated MCP context is missing ${name}.`);
  }
  return value;
}

function parseClientVerificationStatus(
  value: unknown
): McpClientVerificationStatus {
  if (value === "blocked" || value === "unverified" || value === "verified") {
    return value;
  }
  return "unverified";
}

function isMcpScope(value: string): value is McpScope {
  return (
    value === "mcp:system:read" ||
    value === "mcp:provider_routines:read" ||
    value === "mcp:provider_routines:write" ||
    value === "mcp:signals:read" ||
    value === "mcp:signals:write"
  );
}

export type { McpAccessTokenPayload };
