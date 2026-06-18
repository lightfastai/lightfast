import { db } from "@db/app/client";
import { redis } from "@vendor/upstash";

import { resolveAuthContextFromClerk } from "../../auth/identity";

type UpstashSubscription = ReturnType<typeof redis.subscribe<string>>;

interface SubscriberRecord {
  callbacks: Set<(message: unknown) => void>;
  subscription: UpstashSubscription;
}

const subscribers = new Map<string, SubscriberRecord>();

export async function handleSkillIndexEventsRequest(
  request: Request
): Promise<Response> {
  const authContext = await resolveAuthContextFromClerk({
    db,
    headers: request.headers,
  });
  const identity = authContext.identity;

  if (identity.type === "unauthenticated") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (identity.type !== "active") {
    return Response.json({ error: "Organization required" }, { status: 403 });
  }
  if (identity.orgGate.bindingStatus !== "bound") {
    return Response.json(
      { error: "Organization setup required" },
      { status: 403 }
    );
  }

  return new Response(
    createSkillIndexEventStream({
      clerkOrgId: identity.orgId,
      signal: request.signal,
    }),
    {
      headers: {
        "cache-control": "no-store, no-cache, no-transform",
        connection: "keep-alive",
        "content-type": "text/event-stream",
        "x-accel-buffering": "no",
      },
    }
  );
}

function createSkillIndexEventStream(input: {
  clerkOrgId: string;
  signal?: AbortSignal;
}) {
  const channel = `lightfast:org:${input.clerkOrgId}:skills:index`;
  const encoder = new TextEncoder();
  let cleanupPromise: Promise<void> | undefined;
  let closed = false;
  let keepalive: ReturnType<typeof setInterval> | undefined;
  let abortHandler: (() => void) | undefined;
  let onMessage: ((message: unknown) => void) | undefined;

  const cleanup = async () => {
    if (keepalive) {
      clearInterval(keepalive);
      keepalive = undefined;
    }
    if (abortHandler) {
      input.signal?.removeEventListener("abort", abortHandler);
      abortHandler = undefined;
    }
    if (onMessage) {
      cleanupPromise ??= unsubscribeChannel(channel, onMessage).catch(
        () => undefined
      );
      await cleanupPromise;
      onMessage = undefined;
    }
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
      onMessage = (message: unknown) => {
        send(`event: skill-index\ndata: ${serializeMessage(message)}\n\n`);
      };

      keepalive = setInterval(() => {
        send(": keepalive\n\n");
      }, 25_000);
      subscribeChannel(channel, onMessage);

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

function subscribeChannel(
  channel: string,
  callback: (message: unknown) => void
) {
  let record = subscribers.get(channel);
  if (!record) {
    const subscription = redis.subscribe<string>(channel);
    const callbacks = new Set<(message: unknown) => void>();
    subscription.on(
      `message:${channel}`,
      ({ message }: { message: unknown }) => {
        for (const next of callbacks) {
          next(message);
        }
      }
    );
    record = { callbacks, subscription };
    subscribers.set(channel, record);
  }

  record.callbacks.add(callback);
}

async function unsubscribeChannel(
  channel: string,
  callback: (message: unknown) => void
) {
  const record = subscribers.get(channel);
  if (!record) {
    return;
  }

  record.callbacks.delete(callback);
  if (record.callbacks.size > 0) {
    return;
  }

  subscribers.delete(channel);
  try {
    await record.subscription.unsubscribe([channel]);
  } finally {
    record.subscription.removeAllListeners();
  }
}

function serializeMessage(message: unknown) {
  if (typeof message === "string") {
    return message;
  }

  try {
    return JSON.stringify(message) ?? String(message);
  } catch {
    return String(message);
  }
}
