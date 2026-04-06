/**
 * GET /api/connect/oauth/poll
 *
 * Poll for OAuth completion. CLI polling with state token as auth.
 * All business logic lives in platform.oauth.pollResult().
 */

import { log } from "@vendor/observability/log/next";
import type { NextRequest } from "next/server";
import { platform } from "~/lib/internal-caller";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state");

  if (!state) {
    log.warn("[oauth/poll] missing state token");
    return Response.json({ error: "missing_state" }, { status: 400 });
  }

  const result = await platform.oauth.pollResult({ state });

  if (!result) {
    return Response.json({ status: "pending" });
  }

  log.info("[oauth/poll] result found", {
    state: `${state.slice(0, 8)}...`,
  });
  return Response.json(result);
}
