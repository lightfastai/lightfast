/**
 * Ingest delivery workflow
 *
 * Replaces the relay Upstash Workflow (5 steps) + QStash dispatch +
 * console ingress Upstash Workflow (2 steps) with a single Inngest function.
 *
 * Steps:
 * 1. resolve-connection — DB JOIN gatewayResources <-> gatewayInstallations, or use preResolved
 * 2. resolve-workspace — lookup workspace from Clerk org ID
 * 3. transform-and-store — call transformEnvelope, insert ingest log
 * 4. emit-event-capture — step.sendEvent("memory/event.capture")
 * 5. publish-realtime — Upstash Realtime SSE for console UI
 */

import { db } from "@db/console/client";
import {
  gatewayInstallations,
  gatewayResources,
  gatewayWebhookDeliveries,
  orgWorkspaces,
  workspaceIngestLogs,
} from "@db/console/schema";
import type { ProviderSlug } from "@repo/console-providers";
import { sanitizePostTransformEvent } from "@repo/console-providers";
import { NonRetriableError } from "@repo/inngest";
import type { EventNotification } from "@repo/console-upstash-realtime";
import { log } from "@vendor/observability/log/next";
import { and, eq } from "drizzle-orm";
import { inngest } from "../client";
import { transformEnvelope } from "../../lib/transform";

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

      return { connectionId: row.installationId, orgId: row.orgId };
    });

    if (!connectionInfo) {
      throw new NonRetriableError("no_connection");
    }

    // Step 2: Resolve workspace from Clerk org ID
    const workspace = await step.run("resolve-workspace", async () => {
      const row = await db.query.orgWorkspaces.findFirst({
        where: eq(orgWorkspaces.clerkOrgId, connectionInfo.orgId),
        columns: { id: true, name: true, clerkOrgId: true },
      });

      if (!row) {
        return null;
      }

      return {
        workspaceId: row.id,
        workspaceName: row.name,
        clerkOrgId: row.clerkOrgId,
      };
    });

    if (!workspace) {
      throw new NonRetriableError("unknown_org");
    }

    log.info("[ingest-delivery] workspace resolved", {
      workspaceId: workspace.workspaceId,
      workspaceName: workspace.workspaceName,
      provider: data.provider,
      deliveryId: data.deliveryId,
      correlationId: data.correlationId,
    });

    // Step 3: Transform envelope and store ingest log
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
        .insert(workspaceIngestLogs)
        .values({
          workspaceId: workspace.workspaceId,
          deliveryId: data.deliveryId,
          sourceEvent,
          receivedAt: new Date(data.receivedAt).toISOString(),
          ingestionSource: "webhook",
        })
        .returning({ id: workspaceIngestLogs.id });

      if (!record) {
        throw new Error("Failed to insert ingest log");
      }

      log.info("[ingest-delivery] event stored", {
        ingestLogId: record.id,
        workspaceId: workspace.workspaceId,
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
      return { status: "unsupported", provider: data.provider, eventType: data.eventType };
    }

    // Step 4: Emit memory/event.capture to trigger the neural pipeline
    await step.sendEvent("emit-event-capture", {
      name: "memory/event.capture" as const,
      data: {
        workspaceId: workspace.workspaceId,
        clerkOrgId: workspace.clerkOrgId,
        sourceEvent: result.sourceEvent,
        ingestionSource: "webhook",
        ingestLogId: result.ingestLogId,
        correlationId: data.correlationId,
      },
    });

    // Step 5: Publish to Upstash Realtime for console SSE
    await step.run("publish-realtime", async () => {
      const { realtime } = await import("@repo/console-upstash-realtime");
      const channel = realtime.channel(`org-${connectionInfo.orgId}`);
      await channel.emit("workspace.event", {
        eventId: result.ingestLogId,
        workspaceId: workspace.workspaceId,
        sourceEvent: result.sourceEvent,
      } satisfies EventNotification);

      log.info("[ingest-delivery] realtime notification published", {
        orgId: connectionInfo.orgId,
        workspaceId: workspace.workspaceId,
        ingestLogId: result.ingestLogId,
        correlationId: data.correlationId,
      });
    });

    // Step 6: Mark delivery as processed
    await step.run("mark-delivery-processed", async () => {
      await db
        .update(gatewayWebhookDeliveries)
        .set({ status: "processed" })
        .where(eq(gatewayWebhookDeliveries.deliveryId, data.deliveryId));
    });

    return {
      status: "delivered",
      workspaceId: workspace.workspaceId,
      ingestLogId: result.ingestLogId,
    };
  }
);
