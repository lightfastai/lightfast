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
import { log } from "@vendor/observability/log/next";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const providerName = provider as SourceType;

  // Build query dict from all URL search params (null-prototype to prevent prototype pollution)
  const query: Record<string, string> = Object.assign(
    Object.create(null) as Record<string, string>,
    Object.fromEntries(req.nextUrl.searchParams)
  );

  const state = query.state ?? "";

  const result: CallbackProcessResult = await processOAuthCallback({
    provider: providerName,
    state,
    query,
  });

  switch (result.kind) {
    case "redirect":
      log.info("[oauth/callback] redirecting", { provider: providerName });
      return NextResponse.redirect(result.url);

    case "inline_html":
      log.info("[oauth/callback] inline html response", {
        provider: providerName,
        status: result.status ?? 200,
      });
      return new Response(result.html, {
        status: result.status ?? 200,
        headers: { "Content-Type": "text/html" },
      });

    case "error":
      log.warn("[oauth/callback] error result", {
        provider: providerName,
        error: result.error,
        status: result.status,
      });
      return Response.json({ error: result.error }, { status: result.status });

    default: {
      const _exhaustive: never = result;
      return _exhaustive;
    }
  }
}
