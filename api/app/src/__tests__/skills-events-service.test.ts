import { beforeEach, describe, expect, it, vi } from "vitest";

type MessageHandler = (payload: { message: unknown }) => void;

interface FakeSubscription {
  channel: string;
  emitMessage: (message: unknown) => void;
  handlers: Map<string, MessageHandler[]>;
  on: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
}

const mocks = vi.hoisted(() => ({
  publish: vi.fn(),
  subscribe: vi.fn(),
  subscriptions: [] as FakeSubscription[],
}));

vi.mock("@vendor/upstash", () => ({
  redis: {
    publish: mocks.publish,
    subscribe: mocks.subscribe,
  },
}));

describe("skills events service stream", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.subscriptions.length = 0;
    mocks.subscribe.mockImplementation((channel: string) => {
      let subscription: FakeSubscription;
      subscription = {
        channel,
        emitMessage(message: unknown) {
          const handlers =
            subscription.handlers.get(`message:${channel}`) ?? [];
          for (const handler of handlers) {
            handler({ message });
          }
        },
        handlers: new Map<string, MessageHandler[]>(),
        on: vi.fn((event: string, handler: MessageHandler) => {
          const handlers = subscription.handlers.get(event) ?? [];
          handlers.push(handler);
          subscription.handlers.set(event, handlers);
          return subscription;
        }),
        removeAllListeners: vi.fn(() => {
          subscription.handlers.clear();
        }),
        unsubscribe: vi.fn(async () => undefined),
      };
      mocks.subscriptions.push(subscription);
      return subscription;
    });
  });

  it("streams skill-index Redis messages for the requested Clerk organization", async () => {
    const createSkillIndexEventStream = await loadCreateSkillIndexEventStream();
    const stream = createSkillIndexEventStream({ clerkOrgId: "org_123" });
    const reader = stream.getReader();

    mocks.subscriptions[0]?.emitMessage({ snapshotVersion: 7 });
    const chunk = await reader.read();

    expect(chunk.done).toBe(false);
    if (chunk.done) {
      throw new Error("Expected a skill-index event chunk");
    }
    expect(mocks.subscribe).toHaveBeenCalledWith(
      "lightfast:org:org_123:skills:index"
    );
    expect(new TextDecoder().decode(chunk.value)).toBe(
      'event: skill-index\ndata: {"snapshotVersion":7}\n\n'
    );

    await reader.cancel();
  });

  it("unsubscribes and removes listeners when the stream is canceled", async () => {
    const createSkillIndexEventStream = await loadCreateSkillIndexEventStream();
    const stream = createSkillIndexEventStream({ clerkOrgId: "org_123" });
    const reader = stream.getReader();
    const subscription = mocks.subscriptions[0];

    await reader.cancel();

    expect(subscription?.unsubscribe).toHaveBeenCalledWith([
      "lightfast:org:org_123:skills:index",
    ]);
    expect(subscription?.removeAllListeners).toHaveBeenCalled();
  });

  it("unsubscribes and closes the stream when the request signal aborts", async () => {
    const createSkillIndexEventStream = await loadCreateSkillIndexEventStream();
    const abortController = new AbortController();
    const stream = createSkillIndexEventStream({
      clerkOrgId: "org_123",
      signal: abortController.signal,
    });
    const reader = stream.getReader();
    const subscription = mocks.subscriptions[0];

    abortController.abort();

    await expect(reader.read()).resolves.toMatchObject({ done: true });
    await vi.waitFor(() => {
      expect(subscription?.unsubscribe).toHaveBeenCalledWith([
        "lightfast:org:org_123:skills:index",
      ]);
    });
    expect(subscription?.removeAllListeners).toHaveBeenCalled();
  });
});

async function loadCreateSkillIndexEventStream() {
  const service = (await import("../services/skills/events")) as {
    createSkillIndexEventStream?: (input: {
      clerkOrgId: string;
      signal?: AbortSignal;
    }) => ReadableStream<Uint8Array>;
  };

  expect(service.createSkillIndexEventStream).toEqual(expect.any(Function));
  return service.createSkillIndexEventStream!;
}
