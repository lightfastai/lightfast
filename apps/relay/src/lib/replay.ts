import { and, eq } from "@vendor/db";
import { db } from "@db/console/client";
import { gwWebhookDeliveries } from "@db/console/schema";
import { workflowClient } from "@vendor/upstash-workflow/client";
import { redis } from "@vendor/upstash";
import { webhookSeenKey } from "./cache.js";
import { relayBaseUrl } from "./urls.js";
import { getProvider } from "@repo/console-providers";
import type { WebhookReceiptPayload } from "@repo/console-types";
import type { SourceType } from "@repo/console-providers";
import type { GwWebhookDelivery } from "@db/console/schema";

interface ReplayResult {
  replayed: string[];
  skipped: string[];
  failed: string[];
}

/**
 * Replay a batch of persisted webhook deliveries by re-triggering the
 * webhook delivery workflow with the stored payload.
 *
 * For each delivery:
 * 1. Parses stored payload, extracts resourceId via provider
 * 2. Clears Redis dedup key so workflow can re-process
 * 3. Triggers webhook-delivery workflow
 * 4. Updates status to "received" (workflow will advance to delivered/dlq)
 */
export async function replayDeliveries(
  deliveries: GwWebhookDelivery[],
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
        resourceId = providerDef?.webhook.extractResourceId(parsedPayload) ?? null;
      } catch {
        // If extraction fails, proceed with null — workflow handles it
      }

      // Clear Redis dedup key so workflow's Step 1 doesn't reject as duplicate
      await redis.del(webhookSeenKey(providerName, delivery.deliveryId));

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
          .update(gwWebhookDeliveries)
          .set({ status: "received" })
          .where(
            and(
              eq(gwWebhookDeliveries.provider, delivery.provider),
              eq(gwWebhookDeliveries.deliveryId, delivery.deliveryId),
            ),
          );
      } catch (err) {
        console.error("[replay] DB status update failed for", delivery.deliveryId, err);
      }
    } catch {
      failed.push(delivery.deliveryId);
    }
  }

  return { replayed, skipped, failed };
}
