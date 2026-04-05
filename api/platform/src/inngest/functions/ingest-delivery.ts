/**
 * Ingest delivery workflow
 *
 * Replaces the relay Upstash Workflow (5 steps) + QStash dispatch +
 * console ingress Upstash Workflow (2 steps) with a single Inngest function.
 *
 * Steps:
 * 1. resolve-connection — query orgIntegrations, or use preResolved
 * 2. transform-and-store — call transformEnvelope, insert ingest log
 * 3. emit-event-capture — step.sendEvent("memory/event.capture")
 * 4. publish-realtime — Upstash Realtime SSE for console UI
 */

import { db } from "@db/app/client";
import {
  gatewayWebhookDeliveries,
  orgIngestLogs,
  orgIntegrations,
} from "@db/app/schema";
import type { ProviderSlug } from "@repo/app-providers";
import { sanitizePostTransformEvent } from "@repo/app-providers";
import type { EventNotification } from "@repo/app-upstash-realtime";
import { NonRetriableError } from "@vendor/inngest";
import { log } from "@vendor/observability/log/next";
import { and, eq } from "drizzle-orm";
import { transformEnvelope } from "../../lib/transform";
import { inngest } from "../client";

export const ingestDelivery = inngest.createFunction(
  {
    id: "memory/ingest.delivery",
    name: "Ingest Delivery",
    description:
      "Webhook delivery -> transform -> emit event.capture (replaces relay workflow + QStash + console ingress)",
    concurrency: {
      limit: 20,
      key: "event.data.provider",
    },
    retries: 3,
    timeouts: {
      start: "1m",
      finish: "3m",
    },
  },
  { event: "memory/webhook.received" },
  async ({ event, step }) => {
    const data = event.data;

    // Step 1: Resolve connection from resource ID or use preResolved
    const connectionInfo = await step.run("resolve-connection", async () => {
      if (data.preResolved) {
        return data.preResolved;
      }

      if (!data.resourceId) {
        return null;
      }

      const rows = await db
        .select({
          installationId: orgIntegrations.installationId,
          orgId: orgIntegrations.clerkOrgId,
        })
        .from(orgIntegrations)
        .where(
          and(
            eq(orgIntegrations.providerResourceId, data.resourceId),
            eq(orgIntegrations.status, "active")
          )
        )
        .limit(1);

      const row = rows[0];
      if (!row) {
        return null;
      }

      return { connectionId: row.installationId, orgId: row.orgId };
    });

    if (!connectionInfo?.orgId) {
      throw new NonRetriableError("no_connection");
    }

    // clerkOrgId IS the orgId
    const clerkOrgId = connectionInfo.orgId;

    log.info("[ingest-delivery] connection resolved", {
      clerkOrgId,
      provider: data.provider,
      deliveryId: data.deliveryId,
      correlationId: data.correlationId,
    });

    // Step 2: Transform envelope and store ingest log
    const result = await step.run("transform-and-store", async () => {
      const rawEvent = transformEnvelope({
        provider: data.provider as ProviderSlug,
        eventType: data.eventType,
        payload: data.payload,
        deliveryId: data.deliveryId,
        receivedAt: data.receivedAt,
        orgId: connectionInfo.orgId,
        connectionId: connectionInfo.connectionId,
      });

      if (!rawEvent) {
        log.info("[ingest-delivery] No transformer, skipping", {
          provider: data.provider,
          eventType: data.eventType,
          deliveryId: data.deliveryId,
          correlationId: data.correlationId,
        });
        return { status: "unsupported" as const };
      }

      const sourceEvent = sanitizePostTransformEvent(rawEvent);

      const [record] = await db
        .insert(orgIngestLogs)
        .values({
          clerkOrgId,
          deliveryId: data.deliveryId,
          sourceEvent,
          receivedAt: new Date(data.receivedAt).toISOString(),
          ingestionSource: "webhook",
        })
        .returning({ id: orgIngestLogs.id });

      if (!record) {
        throw new Error("Failed to insert ingest log");
      }

      log.info("[ingest-delivery] event stored", {
        ingestLogId: record.id,
        clerkOrgId,
        deliveryId: data.deliveryId,
        correlationId: data.correlationId,
      });

      return {
        status: "transformed" as const,
        sourceEvent,
        ingestLogId: record.id,
      };
    });

    // Unsupported event type — return early, no downstream events
    if (result.status === "unsupported") {
      await step.run("mark-delivery-skipped", async () => {
        await db
          .update(gatewayWebhookDeliveries)
          .set({ status: "skipped" })
          .where(eq(gatewayWebhookDeliveries.deliveryId, data.deliveryId));
      });
      return {
        status: "unsupported",
        provider: data.provider,
        eventType: data.eventType,
      };
    }

    // Step 3: Emit memory/event.capture to trigger the neural pipeline
    await step.sendEvent("emit-event-capture", {
      name: "memory/event.capture" as const,
      data: {
        clerkOrgId,
        sourceEvent: result.sourceEvent,
        ingestionSource: "webhook",
        ingestLogId: result.ingestLogId,
        correlationId: data.correlationId,
      },
    });

    // Step 4: Publish to Upstash Realtime for console SSE
    await step.run("publish-realtime", async () => {
      const { realtime } = await import("@repo/app-upstash-realtime");
      const channel = realtime.channel(`org-${clerkOrgId}`);
      await channel.emit("org.event", {
        eventId: result.ingestLogId,
        clerkOrgId,
        sourceEvent: result.sourceEvent,
      } satisfies EventNotification);

      log.info("[ingest-delivery] realtime notification published", {
        clerkOrgId,
        ingestLogId: result.ingestLogId,
        correlationId: data.correlationId,
      });
    });

    // Step 5: Mark delivery as processed
    await step.run("mark-delivery-processed", async () => {
      await db
        .update(gatewayWebhookDeliveries)
        .set({ status: "processed" })
        .where(eq(gatewayWebhookDeliveries.deliveryId, data.deliveryId));
    });

    return {
      status: "delivered",
      clerkOrgId,
      ingestLogId: result.ingestLogId,
    };
  }
);
