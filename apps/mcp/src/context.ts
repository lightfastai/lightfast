import type { McpScope } from "@repo/api-contract";

import {
  type McpAccessTokenPayload,
  verifyMcpBearerToken,
} from "./auth/verify-token";

export interface McpRequestContext {
  clientPublicId: string;
  grantPublicId: string;
  orgId: string;
  payload: McpAccessTokenPayload;
  scopes: Set<McpScope>;
  token: string;
  userId: string;
}

export async function createMcpContext(
  request: Request
): Promise<McpRequestContext> {
  const verified = await verifyMcpBearerToken(request);

  return {
    clientPublicId: verified.payload.client_id,
    grantPublicId: verified.payload.grant_id,
    orgId: verified.payload.org_id,
    payload: verified.payload,
    scopes: verified.scopes,
    token: verified.token,
    userId: verified.payload.user_id,
  };
}
