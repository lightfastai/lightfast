/**
 * Temporal TTL Expiry Tests
 *
 * Uses vi.useFakeTimers() to simulate time advancement and test the 24h
 * webhook dedup window. Tests that the same deliveryId is treated as a
 * new delivery after the Redis TTL expires.
 *
 * The Redis mock tracks key expiry by recording insertion time + TTL.
 * vi.setSystemTime() advances Date.now(), causing expired keys to return null.
 */

import type { WebhookReceiptPayload } from "@repo/console-providers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Fake-timer-aware Redis mock ──
// Unlike the standard mock, this tracks per-key TTLs and respects fake time.

function makeTTLAwareRedisMock() {
  const store = new Map<string, { value: string; expiresAt: number }>();

  return {
    set: vi.fn(
      async (
        key: string,
        value: string,
        opts?: { nx?: boolean; ex?: number }
      ) => {
        if (opts?.nx && store.has(key)) {
          const entry = store.get(key)!;
          if (entry.expiresAt >= Date.now()) {
            return null; // key exists and not expired → duplicate
          }
          // Key exists but expired — treat as fresh
        }
        const expiresAt = opts?.ex
          ? Date.now() + opts.ex * 1000
          : Number.POSITIVE_INFINITY;
        store.set(key, { value, expiresAt });
        return "OK";
      }
    ),
    get: vi.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry) {
        return null;
      }
      if (entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    }),
    hgetall: vi.fn().mockResolvedValue(null),
    hset: vi.fn().mockResolvedValue("OK"),
    pipeline: () => {
      const pipe = {
        hset: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      return pipe;
    },
    _store: store,
    _clear: () => store.clear(),
  };
}

const ttlRedis = makeTTLAwareRedisMock();

// ── Standard mocks (same structure as workflows.test.ts) ──

let capturedHandler: (context: unknown) => Promise<void>;

vi.mock("@vendor/upstash-workflow/hono", () => ({
  serve: (handler: (ctx: unknown) => Promise<void>) => {
    capturedHandler = handler;
    return () => new Response("ok");
  },
}));

vi.mock("@vendor/upstash", () => ({
  redis: ttlRedis,
}));

const mockPublishJSON = vi.fn().mockResolvedValue({ messageId: "msg-ttl" });
const mockPublishToTopic = vi
  .fn()
  .mockResolvedValue([{ messageId: "dlq-ttl" }]);

vi.mock("@vendor/qstash", () => ({
  getQStashClient: () => ({
    publishJSON: mockPublishJSON,
    publishToTopic: mockPublishToTopic,
  }),
}));

const mockDbInsert = vi.fn();
const mockOnConflictDoNothing = vi.fn().mockResolvedValue(undefined);
const mockDbUpdate = vi.fn();
const mockDbWhere = vi.fn().mockResolvedValue(undefined);
const mockDbSet = vi.fn();
let mockDbRows: { installationId: string; orgId: string }[] = [];

vi.mock("@db/console/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: () => mockDbRows,
          }),
        }),
      }),
    }),
    insert: (...args: unknown[]) => {
      mockDbInsert(...args);
      return {
        values: () => ({ onConflictDoNothing: mockOnConflictDoNothing }),
      };
    },
    update: (...args: unknown[]) => {
      mockDbUpdate(...args);
      return {
        set: (...setArgs: unknown[]) => {
          mockDbSet(...setArgs);
          return { where: mockDbWhere };
        },
      };
    },
  },
}));

vi.mock("@db/console/schema", () => ({
  gatewayWebhookDeliveries: {},
  gatewayInstallations: {},
  gatewayResources: {},
}));

vi.mock("../lib/urls", () => ({
  relayBaseUrl: "https://relay.test/api",
  consoleUrl: "https://console.test",
}));

// Force module load to capture the handler
await import("./workflows.js");

// ── Test helpers ──

function makePayload(deliveryId = "evt-ttl-default"): WebhookReceiptPayload {
  return {
    provider: "github",
    deliveryId,
    eventType: "push",
    resourceId: "res-123",
    payload: { repository: { id: 42 } },
    receivedAt: 1_700_000_000,
  };
}

function makeContext(payload: WebhookReceiptPayload) {
  return {
    requestPayload: payload,
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
  };
}

// ── Tests ──

describe("webhook dedup TTL expiry (24h window)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ttlRedis._clear();
    vi.clearAllMocks();
    mockDbRows = [];
    mockOnConflictDoNothing.mockResolvedValue(undefined);
    mockDbWhere.mockResolvedValue(undefined);
    mockPublishJSON.mockResolvedValue({ messageId: "msg-ttl" });
    mockPublishToTopic.mockResolvedValue([{ messageId: "dlq-ttl" }]);
    // Default: connection found in cache so delivery goes to Console (not DLQ)
    ttlRedis.hgetall.mockResolvedValue({
      connectionId: "conn-1",
      orgId: "org-1",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("same deliveryId within 24h → deduplicated (second delivery no-ops)", async () => {
    const DELIVERY_ID = "evt-ttl-test-001";
    const payload = makePayload(DELIVERY_ID);

    // First delivery: SET NX succeeds → proceeds to publish
    await capturedHandler(makeContext(payload));
    expect(mockPublishJSON).toHaveBeenCalledTimes(1);

    // Second delivery within 24h: SET NX returns null → duplicate, early exit
    vi.clearAllMocks();
    ttlRedis.hgetall.mockResolvedValue({
      connectionId: "conn-1",
      orgId: "org-1",
    });
    await capturedHandler(makeContext(payload));
    expect(mockPublishJSON).not.toHaveBeenCalled();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it("same deliveryId after exactly 24h TTL expiry → treated as new delivery", async () => {
    const DELIVERY_ID = "evt-ttl-test-002";
    const payload = makePayload(DELIVERY_ID);

    // First delivery
    await capturedHandler(makeContext(payload));
    expect(mockPublishJSON).toHaveBeenCalledTimes(1);

    // Advance time past 24h TTL (86400 seconds)
    vi.advanceTimersByTime(86_400_001); // 24h + 1ms

    // Second delivery after TTL: SET NX succeeds again → new delivery
    vi.clearAllMocks();
    ttlRedis.hgetall.mockResolvedValue({
      connectionId: "conn-1",
      orgId: "org-1",
    });
    mockPublishJSON.mockResolvedValue({ messageId: "msg-after-ttl" });
    await capturedHandler(makeContext(payload));

    // Treated as fresh — full pipeline runs
    expect(mockPublishJSON).toHaveBeenCalledTimes(1);
    expect(mockDbInsert).toHaveBeenCalledTimes(1);
  });

  it("same deliveryId at exactly 24h boundary (not yet expired) → still duplicate", async () => {
    const DELIVERY_ID = "evt-ttl-test-003";
    const payload = makePayload(DELIVERY_ID);

    await capturedHandler(makeContext(payload));
    expect(mockPublishJSON).toHaveBeenCalledTimes(1);

    // Advance to exactly 24h — key has TTL of 86400s, expires at now+86400s
    // At exactly 86400s, the condition is expiresAt <= Date.now() → false (equal means NOT expired)
    vi.advanceTimersByTime(86_400_000); // exactly 24h

    vi.clearAllMocks();
    ttlRedis.hgetall.mockResolvedValue({
      connectionId: "conn-1",
      orgId: "org-1",
    });
    await capturedHandler(makeContext(payload));
    expect(mockPublishJSON).not.toHaveBeenCalled(); // still duplicate
  });

  it("different deliveryIds sent concurrently are both treated as new", async () => {
    const payload1 = makePayload("evt-concurrent-001");
    const payload2 = makePayload("evt-concurrent-002");

    mockPublishJSON.mockResolvedValue({ messageId: "msg-1" });
    await Promise.all([
      capturedHandler(makeContext(payload1)),
      capturedHandler(makeContext(payload2)),
    ]);

    expect(mockPublishJSON).toHaveBeenCalledTimes(2);
    expect(mockDbInsert).toHaveBeenCalledTimes(2);
  });
});
