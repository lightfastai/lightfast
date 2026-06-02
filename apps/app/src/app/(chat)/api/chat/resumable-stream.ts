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

type SubscriberRecord = {
  callbacks: Set<(message: string) => void>;
  subscription: UpstashSubscription;
};

const subscribers = new Map<string, SubscriberRecord>();

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
    let record = subscribers.get(channel);
    if (!record) {
      const subscription = redis.subscribe<string>(channel);
      const callbacks = new Set<(message: string) => void>();
      subscription.on(`message:${channel}`, ({ message }) => {
        for (const next of callbacks) {
          next(message);
        }
      });
      record = { callbacks, subscription };
      subscribers.set(channel, record);
    }

    record.callbacks.add(callback);
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

  subscription.callbacks.clear();
  await subscription.subscription.unsubscribe([channel]);
  subscription.subscription.removeAllListeners();
  subscribers.delete(channel);
}
