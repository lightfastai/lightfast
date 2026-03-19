import { backfillDepthSchema } from "@repo/console-providers/client";
import { backfillTriggerPayload } from "@repo/console-providers/contracts";
import { postTransformEventSchema } from "@repo/console-providers/contracts";
import { ingestionSourceSchema } from "@repo/console-validation";
import { z } from "zod";

export const memoryEvents = {
  // ── Backfill orchestration events ──
  "memory/backfill.run.requested": backfillTriggerPayload,
  "memory/backfill.run.cancelled": z.object({
    installationId: z.string(),
    correlationId: z.string().max(128).optional(),
  }),
  "memory/backfill.entity.requested": z.object({
    installationId: z.string(),
    provider: z.string(),
    orgId: z.string(),
    entityType: z.string(),
    resource: z.object({
      providerResourceId: z.string(),
      resourceName: z.string(),
    }),
    since: z.string().datetime(),
    depth: backfillDepthSchema,
    holdForReplay: z.boolean().optional(),
    correlationId: z.string().max(128).optional(),
  }),
  // ── Health check signal ──
  "memory/health.check.requested": z.object({
    /** Installation ID of the connection whose token was revoked */
    installationId: z.string(),
    /** Provider name (e.g. "github", "linear") */
    provider: z.string(),
    /** Why the health check is being requested */
    reason: z.enum(["401_unauthorized"]),
    /** Cross-service correlation ID for distributed tracing */
    correlationId: z.string().max(128).optional(),
  }),
  // ── Connection lifecycle (teardown) ──
  "memory/connection.lifecycle": z.object({
    installationId: z.string(),
    orgId: z.string(),
    provider: z.string(),
    reason: z.string(),
    triggeredBy: z.enum(["health_check", "user", "system"]),
    correlationId: z.string().optional(),
  }),
  // ── Ingest + neural pipeline events ──
  "memory/webhook.received": z.object({
    provider: z.string(),
    deliveryId: z.string(),
    eventType: z.string(),
    resourceId: z.string().nullable(),
    payload: z.unknown(),
    receivedAt: z.number(),
    serviceAuth: z.boolean().optional(),
    preResolved: z
      .object({
        connectionId: z.string(),
        orgId: z.string(),
      })
      .optional(),
    correlationId: z.string().optional(),
  }),
  "memory/event.capture": z.object({
    workspaceId: z.string(),
    clerkOrgId: z.string().optional(),
    sourceEvent: postTransformEventSchema,
    ingestionSource: ingestionSourceSchema.optional(),
    ingestLogId: z.number().optional(),
    correlationId: z.string().optional(),
  }),
  "memory/event.stored": z.object({
    workspaceId: z.string(),
    clerkOrgId: z.string(),
    eventExternalId: z.string(),
    sourceType: z.string(),
    significanceScore: z.number(),
  }),
  "memory/entity.upserted": z.object({
    workspaceId: z.string(),
    entityExternalId: z.string(),
    entityType: z.string(),
    provider: z.string(),
    internalEventId: z.number(),
    entityRefs: z.array(
      z.object({
        type: z.string(),
        key: z.string(),
        label: z.string().nullable(),
      })
    ),
    occurredAt: z.string(),
    correlationId: z.string().optional(),
  }),
  "memory/entity.graphed": z.object({
    workspaceId: z.string(),
    entityExternalId: z.string(),
    entityType: z.string(),
    provider: z.string(),
    occurredAt: z.string(),
    correlationId: z.string().optional(),
  }),
};
