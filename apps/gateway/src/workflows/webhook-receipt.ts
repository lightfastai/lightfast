import { and, eq } from "drizzle-orm";
import { gwInstallations, gwResources } from "@db/console/schema";
import { serve } from "@vendor/upstash-workflow/hono";
import { gatewayBaseUrl } from "../lib/base-url";
import { db } from "../lib/db";
import { webhookSeenKey, resourceKey } from "../lib/keys";
import { qstash } from "../lib/qstash";
import { redis } from "../lib/redis";
import { consoleUrl } from "../lib/related-projects";
import type { WebhookReceiptPayload } from "./types";

interface ConnectionInfo {
  connectionId: string;
  orgId: string;
}

/**
 * Durable webhook receipt workflow.
 *
 * Processes verified webhook payloads with step-level durability:
 * - Step 1: Dedup — skip duplicate deliveries (idempotent, NX set)
 * - Step 2: Resolve connection from resource ID via Redis cache
 * - Step 3: Publish to Console ingress (QStash) or DLQ if unresolvable
 *
 * If step 3 fails, only step 3 retries — dedup/resolve are already done.
 * QStash handles the retry schedule with exponential backoff.
 */
export const webhookReceiptWorkflow = serve<WebhookReceiptPayload>(
  async (context) => {
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

    // Step 2: Resolve connection from resource ID (Redis cache → PlanetScale fallthrough)
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

        // Populate Redis cache for next time
        await redis.hset(resourceKey(data.provider, data.resourceId), {
          connectionId: row.installationId,
          orgId: row.orgId,
        });

        return { connectionId: row.installationId, orgId: row.orgId };
      },
    );

    // Step 3a: No connection found — route to DLQ for manual replay
    if (!connectionInfo) {
      await context.run("publish-to-dlq", async () => {
        await qstash.publishToTopic({
          topic: "webhook-dlq",
          body: {
            provider: data.provider,
            deliveryId: data.deliveryId,
            eventType: data.eventType,
            resourceId: data.resourceId,
            payload: data.payload,
            receivedAt: data.receivedAt,
          },
        });
      });
      return;
    }

    // Step 3b: Connection found — publish to Console ingress via QStash
    // QStash guarantees at-least-once delivery with 5 retries.
    // The delivery-status callback is called on final success or failure.
    await context.run("publish-to-console", async () => {
      await qstash.publishJSON({
        url: `${consoleUrl}/api/webhooks/ingress`,
        body: {
          deliveryId: data.deliveryId,
          connectionId: connectionInfo.connectionId,
          orgId: connectionInfo.orgId,
          provider: data.provider,
          eventType: data.eventType,
          payload: data.payload,
          receivedAt: data.receivedAt,
        },
        retries: 5,
        deduplicationId: `${data.provider}:${data.deliveryId}`,
        callback: `${gatewayBaseUrl}/admin/delivery-status`,
      });
    });
  },
  {
    failureFunction: ({ context, failStatus, failResponse }) => {
      console.error("[webhook-receipt] workflow failed", {
        failStatus,
        failResponse,
        context,
      });
      return Promise.resolve();
    },
  },
);
