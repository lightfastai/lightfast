import { registerMcpOAuthClient } from "@api/app";
import { db } from "@db/app/client";

import {
  oauthError,
  oauthJson,
  readOAuthBody,
} from "../_server/mcp-response";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await readOAuthBody(req)) as Parameters<
      typeof registerMcpOAuthClient
    >[1];
    const result = await registerMcpOAuthClient(db, body);
    return oauthJson(result, { status: 201 });
  } catch (error) {
    return oauthError(error);
  }
}
