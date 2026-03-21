/**
 * GET /api/connect/oauth/poll
 *
 * Poll for OAuth completion. Ported from gateway connections.ts (lines 180-196).
 *
 * NOT tRPC — CLI polling with state token as auth.
 * The state token itself is the secret (cryptographically random nanoid,
 * known only to the initiator).
 */

import { getOAuthResult } from "@api/platform/lib/oauth/state";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state");

  if (!state) {
    return Response.json({ error: "missing_state" }, { status: 400 });
  }

  const result = await getOAuthResult(state);

  if (!result) {
    return Response.json({ status: "pending" });
  }

  return Response.json(result);
}
