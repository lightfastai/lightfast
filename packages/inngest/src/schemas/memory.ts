import { postTransformEventSchema } from "@repo/console-providers/contracts";
import { ingestionSourceSchema } from "@repo/console-validation";
import { z } from "zod";

export const memoryEvents = {
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
