/**
 * GET /api/connect/:provider/callback
 *
 * OAuth callback. Provider redirects here after authorization.
 * All business logic lives in platform.oauth.processCallback().
 * Maps CallbackProcessResult to HTTP responses.
 */

import { log } from "@vendor/observability/log/next";
import { type NextRequest, NextResponse } from "next/server";
import { platform } from "~/lib/internal-caller";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  const query: Record<string, string> = Object.assign(
    Object.create(null) as Record<string, string>,
    Object.fromEntries(req.nextUrl.searchParams)
  );

  const state = query.state ?? "";

  const result = await platform.oauth.processCallback({
    provider,
    state,
    query,
  });

  switch (result.kind) {
    case "redirect":
      log.info("[oauth/callback] redirecting", { provider });
      return NextResponse.redirect(result.url);

    case "inline_html":
      log.info("[oauth/callback] inline html response", {
        provider,
        status: result.status ?? 200,
      });
      return new Response(result.html, {
        status: result.status ?? 200,
        headers: { "Content-Type": "text/html" },
      });

    case "error":
      log.warn("[oauth/callback] error result", {
        provider,
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
