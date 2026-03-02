import { and, eq } from "drizzle-orm";
import { gwInstallations, gwResources, gwWebhookDeliveries } from "@db/console/schema";
import { serve } from "@vendor/upstash-workflow/hono";
import { getQStashClient } from "@vendor/qstash";
import { relayBaseUrl, consoleUrl } from "../lib/urls.js";
import { db } from "@db/console/client";
import { webhookSeenKey, resourceKey, RESOURCE_CACHE_TTL } from "../lib/cache.js";
import { redis } from "@vendor/upstash";
import type { WebhookReceiptPayload } from "@repo/gateway-types";
import type { WorkflowContext } from "@vendor/upstash-workflow/types";
import { isConsoleFanOutEnabled } from "../lib/flags.js";

const qstash = getQStashClient();

interface ConnectionInfo {
  connectionId: string;
  orgId: string;
}

/**
 * Durable webhook delivery workflow.
 *
 * Processes verified webhook payloads with step-level durability:
 * - Step 1: Dedup — skip duplicate deliveries (idempotent, NX set)
 * - Step 2: Resolve connection from resource ID via Redis cache
 * - Step 3: Publish to Console ingress (QStash) or DLQ if unresolvable
 *
 * If step 3 fails, only step 3 retries — dedup/resolve are already done.
 * QStash handles the retry schedule with exponential backoff.
 */
export const webhookDeliveryWorkflow = serve<WebhookReceiptPayload>(
  async (context: WorkflowContext<WebhookReceiptPayload>) => {
    const data = context.requestPayload;

    // Step 1: Deduplication — SET NX (only if not exists), TTL 24h
    // Returns true if this is a duplicate (key already existed).
    const isDuplicate = await context.run("dedup", async () => {
      const result = await redis.set(
        webhookSeenKey(data.provider, data.deliveryId),
        "1",
        { nx: true, ex: 86400 },
      );
      return result === null; // null = key already existed = duplicate
    });

    if (isDuplicate) {
      // Workflow ends gracefully — duplicate delivery, no further action.
      return;
    }

    // Step 2: Persist — store webhook for long-term replayability
    await context.run("persist-delivery", async () => {
      await db
        .insert(gwWebhookDeliveries)
        .values({
          provider: data.provider,
          deliveryId: data.deliveryId,
          eventType: data.eventType,
          status: "received",
          payload: JSON.stringify(data.payload),
          receivedAt: new Date(data.receivedAt).toISOString(),
        })
        .onConflictDoNothing();
    });

    // Step 3: Resolve connection from resource ID (Redis cache → PlanetScale fallthrough)
    const connectionInfo = await context.run<ConnectionInfo | null>(
      "resolve-connection",
      async () => {
        if (!data.resourceId) return null;

        // Try Redis cache first
        const cached = await redis.hgetall<Record<string, string>>(
          resourceKey(data.provider, data.resourceId),
        );
        if (cached?.connectionId && cached.orgId) {
          return { connectionId: cached.connectionId, orgId: cached.orgId };
        }

        // Fallthrough to PlanetScale
        const rows = await db
          .select({
            installationId: gwResources.installationId,
            orgId: gwInstallations.orgId,
          })
          .from(gwResources)
          .innerJoin(gwInstallations, eq(gwResources.installationId, gwInstallations.id))
          .where(
            and(
              eq(gwResources.providerResourceId, data.resourceId),
              eq(gwResources.status, "active"),
            ),
          )
          .limit(1);

        const row = rows[0];
        if (!row) return null;

        // Populate Redis cache for next time (with TTL to prevent stale mappings)
        const key = resourceKey(data.provider, data.resourceId);
        const pipeline = redis.pipeline();
        pipeline.hset(key, { connectionId: row.installationId, orgId: row.orgId });
        pipeline.expire(key, RESOURCE_CACHE_TTL);
        await pipeline.exec();

        return { connectionId: row.installationId, orgId: row.orgId };
      },
    );

    // Step 3a: Update persisted record with installationId when connection is found
    if (connectionInfo) {
      await context.run("update-connection", async () => {
        await db
          .update(gwWebhookDeliveries)
          .set({ installationId: connectionInfo.connectionId })
          .where(
            and(
              eq(gwWebhookDeliveries.provider, data.provider),
              eq(gwWebhookDeliveries.deliveryId, data.deliveryId),
            ),
          );
      });
    }

    // Step 3b: No connection found — route to DLQ for manual replay
    if (!connectionInfo) {
      await context.run("publish-to-dlq", async () => {
        await qstash.publishToTopic({
          topic: "webhook-dlq",
          headers: data.correlationId ? { "X-Correlation-Id": data.correlationId } : undefined,
          body: {
            provider: data.provider,
            deliveryId: data.deliveryId,
            eventType: data.eventType,
            resourceId: data.resourceId,
            payload: data.payload,
            receivedAt: data.receivedAt,
            correlationId: data.correlationId,
          },
        });
      });

      // Step 3b-ii: Update persisted status to dlq — separate step for idempotent retries
      await context.run("update-status-dlq", async () => {
        await db
          .update(gwWebhookDeliveries)
          .set({ status: "dlq" })
          .where(
            and(
              eq(gwWebhookDeliveries.provider, data.provider),
              eq(gwWebhookDeliveries.deliveryId, data.deliveryId),
            ),
          );
      });
      return;
    }

    // Step 4: Connection found — check feature flag before console delivery
    const fanOutEnabled = await context.run("check-fan-out-flag", async () => {
      return isConsoleFanOutEnabled(data.provider);
    });

    if (!fanOutEnabled) {
      // Fan-out disabled — webhook is already persisted (step 2).
      // Skip console delivery. Data is available for future replay.
      return;
    }

    // Step 4b: Publish to Console ingress via QStash
    // QStash guarantees at-least-once delivery with 5 retries.
    // The delivery-status callback is called on final success or failure.
    await context.run("publish-to-console", async () => {
      await qstash.publishJSON({
        url: `${consoleUrl}/api/webhooks/ingress`,
        headers: data.correlationId ? { "X-Correlation-Id": data.correlationId } : undefined,
        body: {
          deliveryId: data.deliveryId,
          connectionId: connectionInfo.connectionId,
          orgId: connectionInfo.orgId,
          provider: data.provider,
          eventType: data.eventType,
          payload: data.payload,
          receivedAt: data.receivedAt,
          correlationId: data.correlationId,
        },
        retries: 5,
        deduplicationId: `${data.provider}:${data.deliveryId}`,
        callback: `${relayBaseUrl}/admin/delivery-status`,
      });
    });

    // Step 4b-ii: Mark webhook as delivered in persistence store
    await context.run("update-status-delivered", async () => {
      await db
        .update(gwWebhookDeliveries)
        .set({ status: "delivered" })
        .where(
          and(
            eq(gwWebhookDeliveries.provider, data.provider),
            eq(gwWebhookDeliveries.deliveryId, data.deliveryId),
          ),
        );
    });
  },
  {
    failureFunction: ({ context, failStatus, failResponse }) => {
      console.error("[webhook-delivery] workflow failed", {
        failStatus,
        failResponse,
        context,
      });
      return Promise.resolve();
    },
  },
);
