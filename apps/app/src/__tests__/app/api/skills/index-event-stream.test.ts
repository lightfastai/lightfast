import { beforeEach, describe, expect, it, vi } from "vitest";

type MessageListener = (payload: { message: unknown }) => void;

const redisMock = vi.hoisted(() => {
  const listeners = new Map<string, MessageListener>();
  const removeAllListenersMock = vi.fn();
  const unsubscribeMock = vi.fn(async () => undefined);
  const subscribeMock = vi.fn((channel: string) => {
    const subscription = {
      on: vi.fn((event: string, listener: MessageListener) => {
        listeners.set(event, listener);
        return subscription;
      }),
      removeAllListeners: removeAllListenersMock,
      unsubscribe: unsubscribeMock,
    };
    return subscription;
  });

  return {
    listeners,
    removeAllListenersMock,
    subscribeMock,
    unsubscribeMock,
  };
});

vi.mock("@vendor/upstash", () => ({
  redis: {
    subscribe: redisMock.subscribeMock,
  },
}));

const { createSkillIndexEventStream } = await import(
  "~/app/(api)/api/skills/index/events/skill-index-event-stream"
);

beforeEach(() => {
  redisMock.listeners.clear();
  redisMock.removeAllListenersMock.mockClear();
  redisMock.subscribeMock.mockClear();
  redisMock.unsubscribeMock.mockClear();
});

describe("skill index event stream", () => {
  it("frames string messages as skill index SSE events", async () => {
    const stream = createSkillIndexEventStream({ clerkOrgId: "org_123" });
    const reader = stream.getReader();
    const read = reader.read();

    emitSkillIndexMessage("org_123", '{"type":"skill_index.changed"}');

    await expect(read).resolves.toEqual({
      done: false,
      value: new TextEncoder().encode(
        'event: skill-index\ndata: {"type":"skill_index.changed"}\n\n'
      ),
    });

    await reader.cancel();
  });

  it("serializes object messages before framing SSE events", async () => {
    const stream = createSkillIndexEventStream({ clerkOrgId: "org_123" });
    const reader = stream.getReader();
    const read = reader.read();

    emitSkillIndexMessage("org_123", {
      snapshotVersion: "100:1:commit:fresh",
      type: "skill_index.changed",
    });

    const result = await read;
    expect(result.done).toBe(false);
    expect(decode(result.value)).toBe(
      'event: skill-index\ndata: {"snapshotVersion":"100:1:commit:fresh","type":"skill_index.changed"}\n\n'
    );

    await reader.cancel();
  });

  it("shares one Redis subscription per org and cleans up after the last reader", async () => {
    const first = createSkillIndexEventStream({ clerkOrgId: "org_123" });
    const second = createSkillIndexEventStream({ clerkOrgId: "org_123" });
    const firstReader = first.getReader();
    const secondReader = second.getReader();

    expect(redisMock.subscribeMock).toHaveBeenCalledTimes(1);

    await firstReader.cancel();
    expect(redisMock.unsubscribeMock).not.toHaveBeenCalled();

    await secondReader.cancel();
    expect(redisMock.unsubscribeMock).toHaveBeenCalledWith([
      "lightfast:org:org_123:skills:index",
    ]);
    expect(redisMock.removeAllListenersMock).toHaveBeenCalledOnce();
  });

  it("creates a fresh subscription when a new reader opens during cleanup", async () => {
    const unsubscribe = createDeferred<undefined>();
    redisMock.unsubscribeMock.mockReturnValueOnce(unsubscribe.promise);
    const first = createSkillIndexEventStream({ clerkOrgId: "org_123" });
    const firstReader = first.getReader();

    const firstCancel = firstReader.cancel();
    await Promise.resolve();
    expect(redisMock.unsubscribeMock).toHaveBeenCalledOnce();

    const second = createSkillIndexEventStream({ clerkOrgId: "org_123" });
    const secondReader = second.getReader();

    expect(redisMock.subscribeMock).toHaveBeenCalledTimes(2);

    unsubscribe.resolve(undefined);
    await firstCancel;
    await secondReader.cancel();
    expect(redisMock.unsubscribeMock).toHaveBeenCalledTimes(2);
  });
});

function emitSkillIndexMessage(clerkOrgId: string, message: unknown) {
  const channel = `lightfast:org:${clerkOrgId}:skills:index`;
  const listener = redisMock.listeners.get(`message:${channel}`);
  expect(listener).toBeDefined();
  listener?.({ message });
}

function decode(value: Uint8Array | undefined) {
  expect(value).toBeDefined();
  return new TextDecoder().decode(value);
}

function createDeferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}
