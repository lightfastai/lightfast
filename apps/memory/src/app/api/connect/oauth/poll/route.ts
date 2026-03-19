/**
 * GET /api/connect/oauth/poll
 *
 * Poll for OAuth completion. Port from gateway connections.ts
 *
 * NOT tRPC — CLI polling with state token as auth.
 */
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  // TODO: Port from gateway connections.ts
  return Response.json(
    {
      status: "not_implemented",
      message: "OAuth poll not yet ported from gateway service",
    },
    { status: 501 }
  );
}
