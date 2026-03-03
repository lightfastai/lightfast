import type { NextRequest } from "next/server";
import { withApiKeyAuth, createAuthErrorResponse } from "~/app/(api)/v1/lib/with-api-key-auth";
import { redis } from "@vendor/upstash";
import { db } from "@db/console/client";
import { orgWorkspaces, workspaceIngestionPayloads } from "@db/console/schema";
import { eq, and, gt } from "drizzle-orm";
import type { EventNotification } from "~/app/api/webhooks/ingress/_lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel streaming limit (5 min)

/**
 * GET /api/events/stream
 *
 * SSE endpoint for real-time transformed event streaming.
 * Authenticates via org API key (Authorization: Bearer sk-lf-...).
 * Streams SourceEvent objects — not raw webhook payloads.
 * Supports Last-Event-ID for catch-up on reconnect.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const requestId = crypto.randomUUID();

  // 1. Authenticate via org API key
  const authResult = await withApiKeyAuth(request, requestId);
  if (!authResult.success) {
    return createAuthErrorResponse(authResult, requestId);
  }

  const { orgId } = authResult.auth;

  // 2. Resolve workspace for catch-up queries
  const row = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.clerkOrgId, orgId),
    columns: { id: true },
  });

  if (!row) {
    return Response.json(
      { error: "WORKSPACE_NOT_FOUND", message: "No workspace found for this org", requestId },
      { status: 404 },
    );
  }

  // 3. Build SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // 3a. Subscribe to Redis Pub/Sub FIRST (before catch-up)
      // This prevents a race where events published between the catch-up
      // query completing and the subscription starting are silently lost.
      const channel = `events:org:${orgId}`;
      const buffered: EventNotification[] = [];
      let catchUpComplete = false;

      const subscription = redis.subscribe<EventNotification>(channel);

      subscription.on("message", ({ message: notification }) => {
        try {
          if (!catchUpComplete) {
            // Buffer real-time events until catch-up is done
            buffered.push(notification);
            return;
          }
          controller.enqueue(
            encoder.encode(
              `id: ${notification.payloadId}\nevent: event\ndata: ${JSON.stringify(notification)}\n\n`,
            ),
          );
        } catch {
          // Malformed message or closed stream — skip
        }
      });

      subscription.on("error", (error) => {
        console.error("[events/stream] Redis subscription error", { orgId, error });
        controller.error(error);
      });

      // 3b. Catch-up from DB if Last-Event-ID is present
      let lastCatchUpId = 0;
      const lastEventId = request.headers.get("Last-Event-ID");

      try {
        if (lastEventId) {
          const lastId = parseInt(lastEventId, 10);
          if (!Number.isNaN(lastId)) {
            const missed = await db
              .select({
                id: workspaceIngestionPayloads.id,
                deliveryId: workspaceIngestionPayloads.deliveryId,
                source: workspaceIngestionPayloads.source,
                eventType: workspaceIngestionPayloads.eventType,
                receivedAt: workspaceIngestionPayloads.receivedAt,
              })
              .from(workspaceIngestionPayloads)
              .where(
                and(
                  eq(workspaceIngestionPayloads.workspaceId, row.id),
                  gt(workspaceIngestionPayloads.id, lastId),
                ),
              )
              .orderBy(workspaceIngestionPayloads.id)
              .limit(1000);

            for (const row of missed) {
              lastCatchUpId = row.id;
              const catchUpEvent = {
                payloadId: row.id,
                deliveryId: row.deliveryId,
                source: row.source,
                eventType: row.eventType,
                receivedAt: new Date(row.receivedAt).getTime(),
                catchUp: true,
              };
              controller.enqueue(
                encoder.encode(`id: ${row.id}\nevent: event\ndata: ${JSON.stringify(catchUpEvent)}\n\n`),
              );
            }
          }
        }
      } catch (err) {
        console.error("[events/stream] Catch-up query failed", { orgId, error: err });
        controller.error(err);
        return;
      }

      // 3c. Flush buffered real-time events (dedup against catch-up)
      catchUpComplete = true;
      for (const notification of buffered) {
        if (notification.payloadId > lastCatchUpId) {
          controller.enqueue(
            encoder.encode(
              `id: ${notification.payloadId}\nevent: event\ndata: ${JSON.stringify(notification)}\n\n`,
            ),
          );
        }
      }

      // 3d. Send connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ orgId })}\n\n`),
      );

      // 3e. Heartbeat to keep connection alive (every 30s)
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      // 3f. Cleanup on disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        void subscription.unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  // 4. Return SSE response
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Request-Id": requestId,
    },
  });
}
