import { postTransformEventSchema } from "@repo/app-providers/contracts";
import { redis } from "@vendor/upstash";
import type { InferRealtimeEvents } from "@vendor/upstash-realtime";
import { Realtime } from "@vendor/upstash-realtime";
import { z } from "zod";

export { handle } from "@vendor/upstash-realtime";

const schema = {
  workspace: {
    event: z.object({
      eventId: z.number(),
      workspaceId: z.string(),
      sourceEvent: postTransformEventSchema,
    }),
  },
};

export const realtime = new Realtime({ schema, redis: redis as never });
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>;
export type EventNotification = z.infer<typeof schema.workspace.event>;
