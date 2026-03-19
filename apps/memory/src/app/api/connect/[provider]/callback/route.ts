/**
 * GET /api/connect/:provider/callback
 *
 * OAuth callback. Port from apps/gateway/src/routes/connections.ts
 *
 * NOT tRPC — OAuth provider redirects here directly (browser).
 */
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  // TODO: Port OAuth callback logic from gateway connections.ts
  return Response.json(
    {
      status: "not_implemented",
      provider,
      message: "OAuth callback not yet ported from gateway service",
    },
    { status: 501 }
  );
}
