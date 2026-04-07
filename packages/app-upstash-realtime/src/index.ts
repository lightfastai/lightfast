import { postTransformEventSchema } from "@repo/app-providers/contracts";
import { entityCategorySchema } from "@repo/app-validation";
import { redis } from "@vendor/upstash";
import type { InferRealtimeEvents } from "@vendor/upstash-realtime";
import { Realtime } from "@vendor/upstash-realtime";
import { z } from "zod";

export { handle } from "@vendor/upstash-realtime";

const schema = {
  org: {
    event: z.object({
      eventId: z.number(),
      clerkOrgId: z.string(),
      sourceEvent: postTransformEventSchema,
    }),
    entity: z.object({
      entityExternalId: z.string(),
      clerkOrgId: z.string(),
      category: entityCategorySchema,
      key: z.string(),
      value: z.string().nullable(),
      state: z.string().nullable(),
      url: z.string().nullable(),
      occurrenceCount: z.number(),
      lastSeenAt: z.string(),
    }),
    entityEvent: z.object({
      entityExternalId: z.string(),
      clerkOrgId: z.string(),
      eventId: z.number(),
      eventExternalId: z.string(),
      observationType: z.string(),
      title: z.string(),
      source: z.string(),
      sourceType: z.string(),
      sourceId: z.string(),
      significanceScore: z.number().nullable(),
      occurredAt: z.string(),
      refLabel: z.string().nullable(),
    }),
  },
};

export const realtime = new Realtime({ schema, redis: redis as never });
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>;
export type EventNotification = z.infer<typeof schema.org.event>;
export type EntityNotification = z.infer<typeof schema.org.entity>;
export type EntityEventNotification = z.infer<typeof schema.org.entityEvent>;
