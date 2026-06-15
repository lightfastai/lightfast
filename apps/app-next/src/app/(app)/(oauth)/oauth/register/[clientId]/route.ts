import { getRegisteredMcpOAuthClient, McpOAuthError } from "@api/app";
import { db } from "@db/app/client";

import { bearerToken, oauthError, oauthJson } from "../../_server/mcp-response";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const registrationAccessToken = bearerToken(req);
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
    if (client.client_id !== (await params).clientId) {
      throw new McpOAuthError("invalid_client", "Client id mismatch.", 401);
    }
    return oauthJson(client);
  } catch (error) {
    return oauthError(error);
  }
}
