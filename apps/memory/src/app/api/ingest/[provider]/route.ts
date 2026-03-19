/**
 * POST /api/ingest/:provider
 *
 * Webhook ingestion endpoint. Replaces relay's entire webhook pipeline.
 *
 * NOT tRPC — external providers send raw HTTP with HMAC signatures.
 */
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  // TODO: Port webhook ingestion logic from apps/relay/src/routes/webhooks.ts
  return Response.json(
    {
      status: "not_implemented",
      provider,
      message: "Webhook ingestion not yet ported from relay service",
    },
    { status: 501 }
  );
}
