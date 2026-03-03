import { serve } from "@vendor/upstash-workflow/nextjs";
import type { WebhookEnvelope } from "@repo/gateway-types";
import { storeIngestionPayload } from "@repo/console-webhooks/storage";
import { db } from "@db/console/client";
import { eq } from "drizzle-orm";
import { orgWorkspaces } from "@db/console/schema";
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
 * 2. store-payload — persist raw payload to workspaceIngestionPayloads
 * 3. transform-and-fan-out — transform envelope into SourceEvent, fan out to Inngest + Redis Pub/Sub
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

  // Step 2: Persist raw payload (capture payloadId for SSE cursor)
  const payloadId = await context.run("store-payload", async () => {
    return storeIngestionPayload({
      workspaceId: workspace.workspaceId,
      deliveryId: envelope.deliveryId,
      source: envelope.provider,
      eventType: envelope.eventType,
      payload: JSON.stringify(envelope.payload),
      headers: {},
      receivedAt: new Date(envelope.receivedAt),
      ingestionSource: "webhook",
    });
  });

  // Step 3: Transform + fan out to all consumers
  await context.run("transform-and-fan-out", async () => {
    const sourceEvent = transformEnvelope(envelope);
    if (!sourceEvent) {
      console.log(
        `[ingress] No transformer for ${envelope.provider}:${envelope.eventType}, skipping fan-out`,
      );
      return;
    }

    await Promise.all([
      // Consumer 1: Inngest observation pipeline
      publishInngestNotification(sourceEvent, workspace),
      // Consumer 2: Redis Pub/Sub for real-time SSE subscribers
      publishEventNotification({
        orgId: envelope.orgId,
        payloadId,
        sourceEvent,
      }),
    ]);
  });
});
