import { Realtime } from "@upstash/realtime";
import type { InferRealtimeEvents } from "@upstash/realtime";
import { z } from "zod/v4";
import { redis } from "@vendor/upstash";
import { postTransformEventSchema } from "@repo/console-validation";

const schema = {
  workspace: {
    event: z.object({
      eventId: z.number(),
      sourceEvent: postTransformEventSchema,
    }),
  },
};

export const realtime = new Realtime({ schema, redis });
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>;
export type EventNotification = z.infer<typeof schema.workspace.event>;
