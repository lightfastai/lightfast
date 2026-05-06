/**
 * POST /api/ingest/:provider
 *
 * Webhook ingestion endpoint for external provider webhooks.
 * Validates HMAC signatures and dispatches to the Inngest pipeline.
 *
 * NOT tRPC — external providers send raw HTTP with HMAC signatures.
 * All business logic lives in platform.webhooks.ingest().
 */

import { TRPCError } from "@trpc/server";
import type { NextRequest } from "next/server";
import { platform } from "~/lib/internal-caller";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const receivedAt = Date.now();
  const rawBody = await req.text();

  // Collect headers as a plain Record for the tRPC procedure
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  try {
    const result = await platform.webhooks.ingest({
      provider,
      rawBody,
      headers,
      receivedAt,
    });

    return Response.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof TRPCError) {
      const statusMap: Record<string, number> = {
        NOT_FOUND: 404,
        BAD_REQUEST: 400,
        UNAUTHORIZED: 401,
        INTERNAL_SERVER_ERROR: 500,
      };
      const status = statusMap[err.code] ?? 500;
      return Response.json({ error: err.message }, { status });
    }
    throw err;
  }
}
