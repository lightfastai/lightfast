import { getMcpOAuthJwks } from "@api/app";

import { oauthJson } from "../_server/mcp-response";

export const runtime = "nodejs";

export async function GET() {
  return oauthJson(getMcpOAuthJwks());
}
