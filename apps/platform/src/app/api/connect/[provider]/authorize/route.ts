/**
 * GET /api/connect/:provider/authorize
 *
 * Initiate OAuth flow. Ported from apps/gateway/src/routes/connections.ts (lines 79-141).
 *
 * NOT tRPC — returns authorize URL + state for browser OAuth.
 * The main flow uses tRPC `connections.getAuthorizeUrl` instead;
 * this route supports direct browser navigation as a fallback.
 */

import { buildAuthorizeUrl } from "@api/platform/lib/oauth/authorize";
import type { SourceType } from "@repo/app-providers";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const providerName = provider as SourceType;

  const orgId = req.nextUrl.searchParams.get("org_id");
  const connectedBy =
    req.nextUrl.searchParams.get("connected_by") ??
    req.headers.get("X-User-Id") ??
    "unknown";
  const redirectTo = req.nextUrl.searchParams.get("redirect_to") ?? undefined;

  if (!orgId) {
    return Response.json({ error: "missing_org_id" }, { status: 400 });
  }

  const result = await buildAuthorizeUrl({
    provider: providerName,
    orgId,
    connectedBy,
    redirectTo,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ url: result.url, state: result.state });
}
