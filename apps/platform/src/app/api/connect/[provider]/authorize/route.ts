/**
 * GET /api/connect/:provider/authorize
 *
 * Initiate OAuth flow. Returns authorize URL + state for browser OAuth.
 * All business logic lives in platform.oauth.buildAuthorizeUrl().
 */

import { TRPCError } from "@trpc/server";
import { log } from "@vendor/observability/log/next";
import type { NextRequest } from "next/server";
import { platform } from "~/lib/internal-caller";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  const orgId = req.nextUrl.searchParams.get("org_id");
  const connectedBy =
    req.nextUrl.searchParams.get("connected_by") ??
    req.headers.get("X-User-Id") ??
    "unknown";
  const redirectTo = req.nextUrl.searchParams.get("redirect_to") ?? undefined;

  if (!orgId) {
    log.warn("[oauth/authorize] missing org_id", { provider });
    return Response.json({ error: "missing_org_id" }, { status: 400 });
  }

  try {
    const result = await platform.oauth.buildAuthorizeUrl({
      provider,
      orgId,
      connectedBy,
      redirectTo,
    });

    log.info("[oauth/authorize] authorize URL built", { provider });
    return Response.json(result);
  } catch (err) {
    if (err instanceof TRPCError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
