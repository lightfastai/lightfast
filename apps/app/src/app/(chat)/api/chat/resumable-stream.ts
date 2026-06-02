import "server-only";

import {
  createResumableStreamContext,
  type ResumableStreamContext,
  type ResumableStreamPublisher,
  type ResumableStreamSubscriber,
} from "@vendor/ai";
import { redis } from "@vendor/upstash";
import { after } from "next/server";

type UpstashSubscription = ReturnType<typeof redis.subscribe<string>>;

const subscribers = new Map<string, UpstashSubscription>();

let streamContext: ResumableStreamContext | undefined;

const publisher: ResumableStreamPublisher = {
  connect: async () => undefined,
  get: (key) => redis.get<string | number>(key),
  incr: (key) => redis.incr(key),
  publish: (channel, message) => redis.publish(channel, message),
  set: (key, value, options) =>
    options?.EX
      ? redis.set(key, value, { ex: options.EX })
      : redis.set(key, value),
};

const subscriber: ResumableStreamSubscriber = {
  connect: async () => undefined,
  subscribe: async (channel, callback) => {
    await unsubscribeChannel(channel);

    const subscription = redis.subscribe<string>(channel);
    subscription.on(`message:${channel}`, ({ message }) => {
      callback(message);
    });
    subscribers.set(channel, subscription);
  },
  unsubscribe: unsubscribeChannel,
};

export function getLightfastResumableStreamContext() {
  streamContext ??= createResumableStreamContext({
    keyPrefix: "lightfast:workspace-assistant:stream",
    publisher,
    subscriber,
    waitUntil: (promise) => {
      after(() => promise);
    },
  });

  return streamContext;
}

async function unsubscribeChannel(channel: string) {
  const subscription = subscribers.get(channel);
  if (!subscription) {
    return;
  }

  await subscription.unsubscribe([channel]);
  subscription.removeAllListeners();
  subscribers.delete(channel);
}
