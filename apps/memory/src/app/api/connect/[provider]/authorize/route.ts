/**
 * GET /api/connect/:provider/authorize
 *
 * Initiate OAuth flow. Port from apps/gateway/src/routes/connections.ts
 *
 * NOT tRPC — returns redirect URL for browser OAuth.
 */
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  // TODO: Port OAuth authorize logic from gateway connections.ts
  return Response.json(
    {
      status: "not_implemented",
      provider,
      message: "OAuth authorize not yet ported from gateway service",
    },
    { status: 501 }
  );
}
