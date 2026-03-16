import { db } from "@db/console/client";
import {
  gatewayInstallations,
  gatewayResources,
  gatewayWebhookDeliveries,
} from "@db/console/schema";
import type { WebhookReceiptPayload } from "@repo/console-providers";
import { and, eq } from "@vendor/db";
import { getQStashClient } from "@vendor/qstash";
import { redis } from "@vendor/upstash";
import type { WorkflowContext } from "@vendor/upstash-workflow";
import { serve } from "@vendor/upstash-workflow/hono";
import { Hono } from "hono";
import {
  RESOURCE_CACHE_TTL,
  resourceKey,
  webhookSeenKey,
} from "../lib/cache.js";
import { consoleUrl, relayBaseUrl } from "../lib/urls.js";
import { log } from "@vendor/observability/log/edge";

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
const webhookDeliveryWorkflow = serve<WebhookReceiptPayload>(
  async (context: WorkflowContext<WebhookReceiptPayload>) => {
    const data = context.requestPayload;

    // Step 1: Deduplication — SET NX (only if not exists), TTL 24h
    // Returns true if this is a duplicate (key already existed).
    const isDuplicate = await context.run("dedup", async () => {
      const result = await redis.set(
        webhookSeenKey(data.provider, data.deliveryId),
        "1",
        { nx: true, ex: 86_400 }
      );
      return result === null; // null = key already existed = duplicate
    });

    if (isDuplicate) {
      // Workflow ends gracefully — duplicate delivery, no further action.
      return;
    }

    log.info("[webhook-delivery] dedup passed", {
      provider: data.provider,
      deliveryId: data.deliveryId,
      correlationId: data.correlationId,
    });

    // Step 2: Persist — store webhook for long-term replayability
    await context.run("persist-delivery", async () => {
      await db
        .insert(gatewayWebhookDeliveries)
        .values({
          provider: data.provider,
          deliveryId: data.deliveryId,
          eventType: data.eventType,
          status: "received",
          payload: JSON.stringify(data.payload),
          receivedAt: new Date(
            data.receivedAt < 1e12 ? data.receivedAt * 1000 : data.receivedAt
          ).toISOString(),
        })
        .onConflictDoNothing();
    });

    // Step 3: Resolve connection from resource ID (Redis cache → PlanetScale fallthrough)
    const connectionInfo = await context.run<ConnectionInfo | null>(
      "resolve-connection",
      async () => {
        if (!data.resourceId) {
          return null;
        }

        // Try Redis cache first
        const cached = await redis.hgetall<Record<string, string>>(
          resourceKey(data.provider, data.resourceId)
        );
        if (cached?.connectionId && cached.orgId) {
          return { connectionId: cached.connectionId, orgId: cached.orgId };
        }

        // Fallthrough to PlanetScale
        const rows = await db
          .select({
            installationId: gatewayResources.installationId,
            orgId: gatewayInstallations.orgId,
          })
          .from(gatewayResources)
          .innerJoin(
            gatewayInstallations,
            eq(gatewayResources.installationId, gatewayInstallations.id)
          )
          .where(
            and(
              eq(gatewayResources.providerResourceId, data.resourceId),
              eq(gatewayResources.status, "active")
            )
          )
          .limit(1);

        const row = rows[0];
        if (!row) {
          return null;
        }

        // Populate Redis cache for next time (with TTL to prevent stale mappings)
        const key = resourceKey(data.provider, data.resourceId);
        const pipeline = redis.pipeline();
        pipeline.hset(key, {
          connectionId: row.installationId,
          orgId: row.orgId,
        });
        pipeline.expire(key, RESOURCE_CACHE_TTL);
        await pipeline.exec();

        return { connectionId: row.installationId, orgId: row.orgId };
      }
    );

    // Step 4: Route — update DB record and decide console vs DLQ path.
    // All branching logic is inside this single step so the workflow always
    // sees a flat, unconditional step sequence after this point.
    const route = await context.run<"console" | "dlq">("route", async () => {
      if (!connectionInfo) {
        await qstash.publishToTopic({
          topic: "webhook-dlq",
          headers: data.correlationId
            ? { "X-Correlation-Id": data.correlationId }
            : undefined,
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
        await db
          .update(gatewayWebhookDeliveries)
          .set({ status: "dlq" })
          .where(
            and(
              eq(gatewayWebhookDeliveries.provider, data.provider),
              eq(gatewayWebhookDeliveries.deliveryId, data.deliveryId)
            )
          );
        return "dlq";
      }

      log.info("[webhook-delivery] connection resolved", {
        provider: data.provider,
        deliveryId: data.deliveryId,
        connectionId: connectionInfo.connectionId,
        orgId: connectionInfo.orgId,
        correlationId: data.correlationId,
      });

      await db
        .update(gatewayWebhookDeliveries)
        .set({ installationId: connectionInfo.connectionId })
        .where(
          and(
            eq(gatewayWebhookDeliveries.provider, data.provider),
            eq(gatewayWebhookDeliveries.deliveryId, data.deliveryId)
          )
        );
      return "console";
    });

    if (route === "dlq") {
      return;
    }

    log.info("[webhook-delivery] about to publish to console", {
      provider: data.provider,
      deliveryId: data.deliveryId,
      correlationId: data.correlationId,
      route,
    });

    // Step 5: Publish to Console ingress via QStash.
    // QStash guarantees at-least-once delivery with 5 retries.
    await context.run("publish-to-console", async () => {
      try {
        const result = await qstash.publishJSON({
          url: `${consoleUrl}/api/gateway/ingress`,
          headers: data.correlationId
            ? { "X-Correlation-Id": data.correlationId }
            : undefined,
          body: {
            deliveryId: data.deliveryId,
            connectionId: connectionInfo!.connectionId,
            orgId: connectionInfo!.orgId,
            provider: data.provider,
            eventType: data.eventType,
            payload: data.payload,
            receivedAt: data.receivedAt,
            correlationId: data.correlationId,
          },
          retries: 5,
          deduplicationId: `${data.provider}:${data.deliveryId}`,
          callback: `${relayBaseUrl}/admin/delivery-status?provider=${data.provider}`,
        });
        log.info("[webhook-delivery] qstash publish accepted", {
          provider: data.provider,
          deliveryId: data.deliveryId,
          messageId: result.messageId,
          deduplicated: result.deduplicated,
        });
      } catch (err) {
        log.error("[webhook-delivery] qstash publish failed", {
          provider: data.provider,
          deliveryId: data.deliveryId,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    });

    log.info("[webhook-delivery] published to console ingress", {
      provider: data.provider,
      deliveryId: data.deliveryId,
      correlationId: data.correlationId,
    });

    // Step 6: Mark webhook as enqueued (QStash accepted, pending Console delivery)
    await context.run("update-status-enqueued", async () => {
      await db
        .update(gatewayWebhookDeliveries)
        .set({ status: "enqueued" })
        .where(
          and(
            eq(gatewayWebhookDeliveries.provider, data.provider),
            eq(gatewayWebhookDeliveries.deliveryId, data.deliveryId)
          )
        );
    });
  },
  {
    failureFunction: ({ context: _context, failStatus, failResponse }) => {
      log.error("[webhook-delivery] workflow failed", {
        failStatus,
        failResponse: String(failResponse),
      });
      return Promise.resolve();
    },
  }
);

const workflows = new Hono();

/**
 * POST /workflows/webhook-delivery
 *
 * Upstash Workflow calls back to this endpoint for each step execution.
 * The serve() handler manages QStash signature verification automatically.
 */
workflows.post("/webhook-delivery", webhookDeliveryWorkflow);

export { workflows };
