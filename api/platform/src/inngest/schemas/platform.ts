import { backfillDepthSchema } from "@repo/app-providers/client";
import {
  backfillTriggerPayload,
  postTransformEventSchema,
} from "@repo/app-providers/contracts";
import { ingestionSourceSchema } from "@repo/app-validation";
import { z } from "zod";

export const platformEvents = {
  // ── Backfill orchestration events ──
  "platform/backfill.run.requested": backfillTriggerPayload,
  "platform/backfill.run.cancelled": z.object({
    installationId: z.string(),
    correlationId: z.string().max(128).optional(),
  }),
  "platform/backfill.entity.requested": z.object({
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
  "platform/health.check.requested": z.object({
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
  "platform/connection.lifecycle": z.object({
    installationId: z.string(),
    orgId: z.string(),
    provider: z.string(),
    reason: z.string(),
    triggeredBy: z.enum(["health_check", "user", "system"]),
    correlationId: z.string().optional(),
  }),
  // ── Ingest + neural pipeline events ──
  "platform/webhook.received": z.object({
    provider: z.string(),
    deliveryId: z.string(),
    eventType: z.string(),
    resourceId: z.string().nullable(),
    payload: z.unknown(),
    receivedAt: z.number(),
    preResolved: z
      .object({
        connectionId: z.string(),
        orgId: z.string(),
      })
      .optional(),
    correlationId: z.string().optional(),
  }),
  "platform/event.capture": z.object({
    clerkOrgId: z.string(),
    sourceEvent: postTransformEventSchema,
    ingestionSource: ingestionSourceSchema.optional(),
    ingestLogId: z.number().optional(),
    correlationId: z.string().optional(),
  }),
  "platform/event.stored": z.object({
    clerkOrgId: z.string(),
    eventExternalId: z.string(),
    sourceType: z.string(),
    significanceScore: z.number(),
  }),
  "platform/entity.upserted": z.object({
    clerkOrgId: z.string(),
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
  "platform/entity.graphed": z.object({
    clerkOrgId: z.string(),
    entityExternalId: z.string(),
    entityType: z.string(),
    provider: z.string(),
    occurredAt: z.string(),
    correlationId: z.string().optional(),
  }),
};
