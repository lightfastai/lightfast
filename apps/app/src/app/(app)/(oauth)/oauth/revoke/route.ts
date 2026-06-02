import { revokeMcpRefreshTokenSecret } from "@api/app";
import { db } from "@db/app/client";

import { oauthError, oauthJson, readOAuthBody } from "../_server/mcp-response";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await readOAuthBody(req);
    await revokeMcpRefreshTokenSecret(db, {
      refreshToken: typeof body.token === "string" ? body.token : "",
    });
    return oauthJson({});
  } catch (error) {
    return oauthError(error);
  }
}
