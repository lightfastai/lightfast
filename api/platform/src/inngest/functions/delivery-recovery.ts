/**
 * Delivery recovery cron function
 *
 * Replaces QStash-scheduled POST /admin/recovery/cron in the relay service.
 * Source logic: apps/relay/src/lib/replay.ts + apps/relay/src/routes/admin.ts (lines 224-249)
 *
 * Sweeps all deliveries stuck in status='received' for more than 5 minutes
 * across all providers and installations, then sends memory/webhook.received
 * events for each one instead of re-triggering Upstash Workflows.
 */

import { db } from "@db/app/client";
import {
  gatewayInstallations,
  gatewayResources,
  gatewayWebhookDeliveries,
} from "@db/app/schema";
import type { SourceType } from "@repo/app-providers";
import { getProvider, isWebhookProvider } from "@repo/app-providers";
import { and, eq, lt } from "@vendor/db";
import { log } from "@vendor/observability/log/next";
import { inngest } from "../client";

export const deliveryRecovery = inngest.createFunction(
  {
    id: "memory/delivery.recovery",
    name: "Delivery Recovery (5m cron)",
    retries: 1,
    concurrency: [{ limit: 1 }],
  },
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    const BATCH_SIZE = 100;
    const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

    // -- Step 1: Find stuck deliveries --------------------------------------
    const deliveries = await step.run("find-stuck-deliveries", async () => {
      const staleBeforeIso = new Date(
        Date.now() - STALE_THRESHOLD_MS
      ).toISOString();

      return db
        .select()
        .from(gatewayWebhookDeliveries)
        .where(
          and(
            eq(gatewayWebhookDeliveries.status, "received"),
            lt(gatewayWebhookDeliveries.receivedAt, staleBeforeIso)
          )
        )
        .orderBy(gatewayWebhookDeliveries.receivedAt)
        .limit(BATCH_SIZE);
    });

    if (deliveries.length === 0) {
      return { replayed: 0, skipped: 0, failed: 0 };
    }

    log.info("[delivery-recovery] found stuck deliveries", {
      count: deliveries.length,
    });

    // -- Step 2: Re-send each as memory/webhook.received --------------------
    const result = await step.run("replay-deliveries", async () => {
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
            if (providerDef && isWebhookProvider(providerDef)) {
              resourceId =
                providerDef.webhook.extractResourceId(parsedPayload) ?? null;
            }
          } catch {
            // If extraction fails, proceed with null — ingest delivery handles it
          }

          // Resolve connection info for preResolved if installationId is available
          let preResolved:
            | { connectionId: string; orgId: string }
            | undefined;
          if (delivery.installationId) {
            preResolved = {
              connectionId: delivery.installationId,
              orgId: "", // will be resolved below
            };

            // Look up orgId from installation
            const installationRows = await db
              .select({ orgId: gatewayInstallations.orgId })
              .from(gatewayInstallations)
              .where(eq(gatewayInstallations.id, delivery.installationId))
              .limit(1);

            if (installationRows[0]) {
              preResolved.orgId = installationRows[0].orgId;
            }
          }

          // Send as Inngest event instead of Upstash Workflow trigger
          await inngest.send({
            name: "memory/webhook.received",
            data: {
              provider: providerName,
              deliveryId: delivery.deliveryId,
              eventType: delivery.eventType,
              resourceId,
              payload: parsedPayload,
              receivedAt: new Date(delivery.receivedAt).getTime(),
              ...(preResolved ? { preResolved } : {}),
            },
          });

          replayed.push(delivery.deliveryId);

          // Reset status — ingest delivery will advance to processed
          try {
            await db
              .update(gatewayWebhookDeliveries)
              .set({ status: "received" })
              .where(
                and(
                  eq(gatewayWebhookDeliveries.provider, delivery.provider),
                  eq(
                    gatewayWebhookDeliveries.deliveryId,
                    delivery.deliveryId
                  )
                )
              );
          } catch (err) {
            log.error("[delivery-recovery] DB status update failed", {
              deliveryId: delivery.deliveryId,
              error: err,
            });
          }
        } catch {
          failed.push(delivery.deliveryId);
        }
      }

      return { replayed, skipped, failed };
    });

    log.info("[delivery-recovery] complete", {
      replayed: result.replayed.length,
      skipped: result.skipped.length,
      failed: result.failed.length,
    });

    return {
      replayed: result.replayed.length,
      skipped: result.skipped.length,
      failed: result.failed.length,
    };
  }
);
