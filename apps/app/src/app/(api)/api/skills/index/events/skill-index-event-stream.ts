import "server-only";

import { redis } from "@vendor/upstash";

type UpstashSubscription = ReturnType<typeof redis.subscribe<string>>;

export function createSkillIndexEventStream(input: {
  clerkOrgId: string;
  signal?: AbortSignal;
}) {
  const channel = `lightfast:org:${input.clerkOrgId}:skills:index`;
  const encoder = new TextEncoder();
  const subscription = redis.subscribe<string>(channel);
  let cleanupPromise: Promise<void> | undefined;
  let closed = false;
  let keepalive: ReturnType<typeof setInterval> | undefined;
  let abortHandler: (() => void) | undefined;

  const cleanup = async () => {
    if (keepalive) {
      clearInterval(keepalive);
      keepalive = undefined;
    }
    if (abortHandler) {
      input.signal?.removeEventListener("abort", abortHandler);
      abortHandler = undefined;
    }
    cleanupPromise ??= cleanupSubscription(subscription, channel).catch(
      () => undefined
    );
    await cleanupPromise;
  };

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        if (!closed) {
          controller.enqueue(encoder.encode(chunk));
        }
      };
      const close = () => {
        if (closed) {
          return;
        }
        closed = true;
        void cleanup();
        try {
          controller.close();
        } catch {
          // The stream can already be closing when abort and cancel race.
        }
      };
      const onMessage = ({ message }: { message: string }) => {
        send(`event: skill-index\ndata: ${message}\n\n`);
      };

      keepalive = setInterval(() => {
        send(": keepalive\n\n");
      }, 25_000);
      subscription.on(`message:${channel}`, onMessage);

      abortHandler = close;
      if (input.signal?.aborted) {
        close();
        return;
      }
      input.signal?.addEventListener("abort", abortHandler, { once: true });
    },
    async cancel() {
      closed = true;
      await cleanup();
    },
  });
}

async function cleanupSubscription(
  subscription: UpstashSubscription,
  channel: string
) {
  try {
    await subscription.unsubscribe([channel]);
  } finally {
    subscription.removeAllListeners();
  }
}
