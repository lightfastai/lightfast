import { serve } from "@vendor/upstash-workflow/nextjs";
import type { WebhookEnvelope } from "@repo/gateway-types";
import { storeIngestionPayload } from "@repo/console-webhooks/storage";
import { resolveWorkspaceFromOrgId } from "./resolve-workspace";
import { dispatchToInngest } from "./dispatch";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/ingress
 *
 * Durable Console ingress endpoint for Gateway-delivered webhooks.
 * Receives QStash-signed payloads from the Gateway webhook-receipt workflow.
 *
 * QStash signature verification is handled automatically by serve().
 *
 * Steps:
 * 1. resolve-workspace — look up workspace from Clerk org ID (graceful skip if unknown)
 * 2. store-payload — persist raw payload to workspaceIngestionPayloads
 * 3. dispatch-to-inngest — transform payload and send to appropriate Inngest events
 */
export const { POST } = serve<WebhookEnvelope>(async (context) => {
  const envelope = context.requestPayload;

  // Step 1: Resolve workspace from Clerk org ID
  const workspace = await context.run("resolve-workspace", async () => {
    return resolveWorkspaceFromOrgId(envelope.orgId);
  });

  // Unknown org — graceful skip (org may have been deleted or not yet synced)
  if (!workspace) {
    console.warn(
      `[ingress] Unknown orgId: ${envelope.orgId}, deliveryId: ${envelope.deliveryId}`,
    );
    return;
  }

  // Step 2: Persist raw payload for audit trail and future reprocessing
  await context.run("store-payload", async () => {
    await storeIngestionPayload({
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

  // Step 3: Transform and dispatch to Inngest
  await context.run("dispatch-to-inngest", async () => {
    await dispatchToInngest(envelope, workspace);
  });
});
