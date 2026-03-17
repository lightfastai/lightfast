import { db } from "@db/console/client";
import type { GatewayWebhookDelivery } from "@db/console/schema";
import { gatewayWebhookDeliveries } from "@db/console/schema";
import type {
  SourceType,
  WebhookReceiptPayload,
} from "@repo/console-providers";
import { getProvider } from "@repo/console-providers";
import { and, eq } from "@vendor/db";
import { log } from "@vendor/observability/log/edge";
import { workflowClient } from "@vendor/upstash-workflow/client";
import { relayBaseUrl } from "./urls.js";

interface ReplayResult {
  failed: string[];
  replayed: string[];
  skipped: string[];
}

/**
 * Replay a batch of persisted webhook deliveries by re-triggering the
 * webhook delivery workflow with the stored payload.
 *
 * For each delivery:
 * 1. Parses stored payload, extracts resourceId via provider
 * 2. Triggers webhook-delivery workflow
 * 3. Updates status to "received" (workflow will advance to delivered/dlq)
 */
export async function replayDeliveries(
  deliveries: GatewayWebhookDelivery[]
): Promise<ReplayResult> {
  const replayed: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const delivery of deliveries) {
    if (!delivery.payload) {
      skipped.push(delivery.deliveryId);
      continue;
    }

    try {
      const parsedPayload = JSON.parse(delivery.payload) as unknown;

      const providerName = delivery.provider as SourceType;

      // Re-extract resourceId from stored payload via provider
      let resourceId: string | null = null;
      try {
        const providerDef = getProvider(providerName);
        resourceId =
          providerDef?.webhook.extractResourceId(parsedPayload) ?? null;
      } catch {
        // If extraction fails, proceed with null — workflow handles it
      }

      // Re-trigger the full workflow — it handles resolution, delivery, and status updates
      await workflowClient.trigger({
        url: `${relayBaseUrl}/workflows/webhook-delivery`,
        body: JSON.stringify({
          provider: providerName,
          deliveryId: delivery.deliveryId,
          eventType: delivery.eventType,
          resourceId,
          payload: parsedPayload,
          receivedAt: new Date(delivery.receivedAt).getTime(),
        } satisfies WebhookReceiptPayload),
        headers: { "Content-Type": "application/json" },
      });

      // Trigger succeeded — mark as replayed regardless of DB update outcome
      replayed.push(delivery.deliveryId);

      // Reset status — workflow will advance to delivered or dlq
      try {
        await db
          .update(gatewayWebhookDeliveries)
          .set({ status: "received" })
          .where(
            and(
              eq(gatewayWebhookDeliveries.provider, delivery.provider),
              eq(gatewayWebhookDeliveries.deliveryId, delivery.deliveryId)
            )
          );
      } catch (err) {
        log.error("[replay] DB status update failed", {
          deliveryId: delivery.deliveryId,
          error: err,
        });
      }
    } catch {
      failed.push(delivery.deliveryId);
    }
  }

  return { replayed, skipped, failed };
}
