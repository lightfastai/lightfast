import { redis } from "@vendor/upstash";
import type { InferRealtimeEvents } from "@vendor/upstash-realtime";
import { Realtime } from "@vendor/upstash-realtime";

export { handle } from "@vendor/upstash-realtime";

const schema = {};

export const realtime = new Realtime({ schema, redis: redis as never });
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>;
