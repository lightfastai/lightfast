import type { NextRequest } from "next/server";
import { withApiKeyAuth, createAuthErrorResponse } from "~/app/(api)/v1/lib/with-api-key-auth";
import { realtime } from "@repo/console-upstash-realtime";
import type { EventNotification } from "@repo/console-upstash-realtime";
import { db } from "@db/console/client";
import { orgWorkspaces, workspaceEvents } from "@db/console/schema";
import { eq, and, gt } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel streaming limit (5 min)

/**
 * GET /api/gateway/stream
 *
 * SSE endpoint for real-time transformed event streaming.
 * Authenticates via org API key (Authorization: Bearer sk-lf-...).
 * Streams PostTransformEvent objects — not raw webhook payloads.
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
      const channel = realtime.channel(`org-${orgId}`);

      // 3a. Subscribe to Realtime FIRST (before catch-up)
      // Realtime uses Redis Streams with exactly-once delivery.
      // Subscribe first, buffer during catch-up, then flush — same pattern
      // as before but with stronger delivery guarantees.
      const buffered: EventNotification[] = [];
      let catchUpComplete = false;

      const unsubscribe = await channel.subscribe({
        events: ["workspace.event"],
        onData({ data }: { data: EventNotification }) {
          try {
            const notification = data;
            if (!catchUpComplete) {
              buffered.push(notification);
              return;
            }
            controller.enqueue(
              encoder.encode(
                `id: ${notification.eventId}\nevent: event\ndata: ${JSON.stringify(notification)}\n\n`,
              ),
            );
          } catch {
            // Malformed message or closed stream — skip
          }
        },
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
                id: workspaceEvents.id,
                workspaceId: workspaceEvents.workspaceId,
                sourceEvent: workspaceEvents.sourceEvent,
              })
              .from(workspaceEvents)
              .where(
                and(
                  eq(workspaceEvents.workspaceId, row.id),
                  gt(workspaceEvents.id, lastId),
                ),
              )
              .orderBy(workspaceEvents.id)
              .limit(1000);

            for (const missed_row of missed) {
              lastCatchUpId = missed_row.id;
              const notification: EventNotification = {
                eventId: missed_row.id,
                workspaceId: missed_row.workspaceId,
                sourceEvent: missed_row.sourceEvent,
              };
              controller.enqueue(
                encoder.encode(`id: ${missed_row.id}\nevent: event\ndata: ${JSON.stringify(notification)}\n\n`),
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
        if (notification.eventId > lastCatchUpId) {
          controller.enqueue(
            encoder.encode(
              `id: ${notification.eventId}\nevent: event\ndata: ${JSON.stringify(notification)}\n\n`,
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
        unsubscribe();
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
