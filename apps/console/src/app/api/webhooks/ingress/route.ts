import { serve } from "@vendor/upstash-workflow/nextjs";
import type { WebhookEnvelope } from "@repo/gateway-types";
import { db } from "@db/console/client";
import { eq } from "drizzle-orm";
import { orgWorkspaces, workspaceEvents } from "@db/console/schema";
import { transformEnvelope } from "./_lib/transform";
import { publishInngestNotification, publishEventNotification } from "./_lib/notify";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/ingress
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

    if (!row) return null;

    return {
      workspaceId: row.id,
      workspaceName: row.name,
      clerkOrgId: row.clerkOrgId,
    };
  });

  // Unknown org — graceful skip (org may have been deleted or not yet synced)
  if (!workspace) {
    console.warn(
      `[ingress] Unknown orgId: ${envelope.orgId}, deliveryId: ${envelope.deliveryId}`,
    );
    return;
  }

  // Step 2: Transform, store, and fan out to all consumers
  await context.run("transform-store-and-fan-out", async () => {
    const sourceEvent = transformEnvelope(envelope);
    if (!sourceEvent) {
      console.log(
        `[ingress] No transformer for ${envelope.provider}:${envelope.eventType}, skipping`,
      );
      return;
    }

    // Store transformed event — returns monotonic cursor for SSE
    const [record] = await db
      .insert(workspaceEvents)
      .values({
        workspaceId: workspace.workspaceId,
        deliveryId: envelope.deliveryId,
        source: envelope.provider,
        sourceType: sourceEvent.sourceType,
        sourceEvent,
        receivedAt: new Date(envelope.receivedAt).toISOString(),
        ingestionSource: "webhook",
      })
      .returning({ id: workspaceEvents.id });

    if (!record) {
      throw new Error("Failed to insert workspace event record");
    }

    // Fan out to consumers in parallel
    await Promise.all([
      publishInngestNotification(sourceEvent, workspace),
      publishEventNotification({
        orgId: envelope.orgId,
        eventId: record.id,
        sourceEvent,
      }),
    ]);
  });
});
