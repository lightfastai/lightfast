/**
 * GET /api/connect/:provider/callback
 *
 * OAuth callback. Ported from apps/gateway/src/routes/connections.ts (lines 208-489).
 *
 * NOT tRPC — OAuth provider redirects here directly (browser).
 * Maps CallbackProcessResult from the lib layer to HTTP responses.
 */

import {
  type CallbackProcessResult,
  processOAuthCallback,
} from "@api/platform/lib/oauth/callback";
import type { SourceType } from "@repo/app-providers";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const providerName = provider as SourceType;

  // Build query dict from all URL search params
  const query: Record<string, string> = {};
  for (const [k, v] of req.nextUrl.searchParams) {
    query[k] = v;
  }

  const state = query.state ?? "";

  const result: CallbackProcessResult = await processOAuthCallback({
    provider: providerName,
    state,
    query,
  });

  switch (result.kind) {
    case "redirect":
      return NextResponse.redirect(result.url);

    case "inline_html":
      return new Response(result.html, {
        status: result.status ?? 200,
        headers: { "Content-Type": "text/html" },
      });

    case "error":
      return Response.json({ error: result.error }, { status: result.status });
  }
}
