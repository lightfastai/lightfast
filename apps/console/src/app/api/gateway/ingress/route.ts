import { db } from "@db/console/client";
import { orgWorkspaces, workspaceIngestLogs } from "@db/console/schema";
import type { WebhookEnvelope } from "@repo/console-providers";
import { sanitizePostTransformEvent } from "@repo/console-providers";
import { log } from "@vendor/observability/log";
import { serve } from "@vendor/upstash-workflow/nextjs";
import { eq } from "drizzle-orm";
import {
  publishEventNotification,
  publishInngestNotification,
} from "./_lib/notify";
import { transformEnvelope } from "./_lib/transform";

export const runtime = "nodejs";

/**
 * POST /api/gateway/ingress
 *
 * Durable Console ingress endpoint for Relay-delivered webhooks.
 * Receives QStash-signed payloads from the Relay webhook-delivery workflow.
 *
 * QStash signature verification is handled automatically by serve().
 *
 * Steps:
 * 1. resolve-workspace — look up workspace from Clerk org ID (graceful skip if unknown)
 * 2. transform-store-and-fan-out — transform envelope into PostTransformEvent, store in DB,
 *    fan out to Inngest + Upstash Realtime. Unsupported event types are skipped entirely.
 */
export const { POST } = serve<WebhookEnvelope>(async (context) => {
  const envelope = context.requestPayload;

  // Step 1: Resolve workspace from Clerk org ID
  const workspace = await context.run("resolve-workspace", async () => {
    const row = await db.query.orgWorkspaces.findFirst({
      where: eq(orgWorkspaces.clerkOrgId, envelope.orgId),
      columns: { id: true, name: true, clerkOrgId: true },
    });

    if (!row) {
      return null;
    }

    return {
      workspaceId: row.id,
      workspaceName: row.name,
      clerkOrgId: row.clerkOrgId,
    };
  });

  // Unknown org — graceful skip (org may have been deleted or not yet synced)
  if (!workspace) {
    log.warn("[ingress] Unknown orgId", {
      orgId: envelope.orgId,
      deliveryId: envelope.deliveryId,
      correlationId: envelope.correlationId,
    });
    return;
  }

  log.info("[ingress] workspace resolved", {
    workspaceId: workspace.workspaceId,
    workspaceName: workspace.workspaceName,
    provider: envelope.provider,
    deliveryId: envelope.deliveryId,
    correlationId: envelope.correlationId,
  });

  // Step 2: Transform, store, and fan out to all consumers
  await context.run("transform-store-and-fan-out", async () => {
    const rawEvent = transformEnvelope(envelope);
    if (!rawEvent) {
      log.info("[ingress] No transformer, skipping", {
        provider: envelope.provider,
        eventType: envelope.eventType,
        deliveryId: envelope.deliveryId,
        correlationId: envelope.correlationId,
      });
      return;
    }

    log.info("[ingress] event transformed", {
      provider: envelope.provider,
      eventType: envelope.eventType,
      deliveryId: envelope.deliveryId,
      correlationId: envelope.correlationId,
    });

    // Strip any invalid URL fields (e.g. from AI-generated test payloads)
    const sourceEvent = sanitizePostTransformEvent(rawEvent);

    // Store transformed event — returns monotonic cursor for SSE
    const [record] = await db
      .insert(workspaceIngestLogs)
      .values({
        workspaceId: workspace.workspaceId,
        deliveryId: envelope.deliveryId,
        sourceEvent,
        receivedAt: new Date(envelope.receivedAt).toISOString(),
        ingestionSource: "webhook",
      })
      .returning({ id: workspaceIngestLogs.id });

    if (!record) {
      throw new Error("Failed to insert workspace event record");
    }

    log.info("[ingress] event stored", {
      ingestLogId: record.id,
      workspaceId: workspace.workspaceId,
      deliveryId: envelope.deliveryId,
      correlationId: envelope.correlationId,
    });

    // Fan out to consumers in parallel
    await Promise.all([
      publishInngestNotification(
        sourceEvent,
        workspace,
        record.id,
        envelope.correlationId
      ),
      publishEventNotification({
        orgId: envelope.orgId,
        workspaceId: workspace.workspaceId,
        eventId: record.id,
        sourceEvent,
      }),
    ]);

    log.info("[ingress] fan-out complete", {
      ingestLogId: record.id,
      workspaceId: workspace.workspaceId,
      correlationId: envelope.correlationId,
    });
  });
});
