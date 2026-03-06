import { Realtime } from "@vendor/upstash-realtime";
import type { InferRealtimeEvents } from "@vendor/upstash-realtime";
import { z } from "zod";
import { redis } from "@vendor/upstash";
import { postTransformEventSchema } from "@repo/console-providers";

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

export const realtime = new Realtime({ schema, redis });
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>;
export type EventNotification = z.infer<typeof schema.workspace.event>;
