import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WebhookReceiptPayload } from "@repo/gateway-types";

// ── Mock externals ──

const mockRedisSet = vi.fn();
const mockRedisHgetall = vi.fn();
const mockRedisHset = vi.fn();
const mockPublishJSON = vi.fn().mockResolvedValue({ messageId: "msg-1" });
const mockPublishToTopic = vi.fn().mockResolvedValue([{ messageId: "msg-2" }]);

// Capture the workflow handler passed to serve()
let capturedHandler: (context: unknown) => Promise<void>;

vi.mock("@vendor/upstash-workflow/hono", () => ({
  serve: (handler: (ctx: unknown) => Promise<void>) => {
    capturedHandler = handler;
    // Return a dummy Hono handler
    return () => new Response("ok");
  },
}));

vi.mock("@vendor/upstash", () => ({
  redis: {
    set: (...args: unknown[]) => mockRedisSet(...args),
    hgetall: (...args: unknown[]) => mockRedisHgetall(...args),
    hset: (...args: unknown[]) => mockRedisHset(...args),
  },
}));

vi.mock("@vendor/qstash", () => ({
  getQStashClient: () => ({
    publishJSON: mockPublishJSON,
    publishToTopic: mockPublishToTopic,
  }),
}));

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
  },
}));

vi.mock("../lib/urls", () => ({
  gatewayBaseUrl: "https://gateway.test",
  consoleUrl: "https://console.test",
}));

// This must be a mutable ref so tests can change the DB result
let mockDbRows: { installationId: string; orgId: string }[] = [];

// Force module load to trigger serve() and capture the handler
await import("./webhook-delivery");

// ── Test helpers ──

function makePayload(
  overrides: Partial<WebhookReceiptPayload> = {},
): WebhookReceiptPayload {
  return {
    provider: "github",
    deliveryId: "del-001",
    eventType: "push",
    resourceId: "res-123",
    payload: { repository: { id: 42 } },
    receivedAt: 1700000000,
    ...overrides,
  };
}

function makeContext(payload: WebhookReceiptPayload) {
  return {
    requestPayload: payload,
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
  };
}

// ── Tests ──

describe("webhook-delivery workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisSet.mockResolvedValue("OK");
    mockRedisHgetall.mockResolvedValue(null);
    mockRedisHset.mockResolvedValue("OK");
    mockPublishJSON.mockResolvedValue({ messageId: "msg-1" });
    mockPublishToTopic.mockResolvedValue([{ messageId: "msg-2" }]);
    mockDbRows = [];
  });

  it("stops on duplicate delivery", async () => {
    mockRedisSet.mockResolvedValue(null); // null = key existed = duplicate

    const ctx = makeContext(makePayload());
    await capturedHandler(ctx);

    // Only dedup step should run, no publish
    expect(ctx.run).toHaveBeenCalledTimes(1);
    expect(mockPublishJSON).not.toHaveBeenCalled();
    expect(mockPublishToTopic).not.toHaveBeenCalled();
  });

  it("publishes to Console when connection found in Redis cache", async () => {
    mockRedisSet.mockResolvedValue("OK"); // new key = not duplicate
    mockRedisHgetall.mockResolvedValue({
      connectionId: "conn-1",
      orgId: "org-1",
    });

    const ctx = makeContext(makePayload());
    await capturedHandler(ctx);

    // 3 steps: dedup, resolve, publish
    expect(ctx.run).toHaveBeenCalledTimes(3);
    expect(mockPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://console.test/api/webhooks/ingress",
        body: expect.objectContaining({
          deliveryId: "del-001",
          connectionId: "conn-1",
          orgId: "org-1",
          provider: "github",
          eventType: "push",
        }),
        retries: 5,
        deduplicationId: "github:del-001",
        callback: "https://gateway.test/admin/delivery-status",
      }),
    );
  });

  it("falls through to DB when Redis cache misses, then populates cache", async () => {
    mockRedisSet.mockResolvedValue("OK");
    mockRedisHgetall.mockResolvedValue(null); // cache miss
    mockDbRows = [{ installationId: "conn-2", orgId: "org-2" }];

    const ctx = makeContext(makePayload());
    await capturedHandler(ctx);

    // Should populate Redis cache
    expect(mockRedisHset).toHaveBeenCalledWith(
      expect.stringContaining("gw:resource:github:res-123"),
      { connectionId: "conn-2", orgId: "org-2" },
    );
    // Should publish to Console
    expect(mockPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          connectionId: "conn-2",
          orgId: "org-2",
        }),
      }),
    );
  });

  it("routes to DLQ when no connection found", async () => {
    mockRedisSet.mockResolvedValue("OK");
    mockRedisHgetall.mockResolvedValue(null); // cache miss
    mockDbRows = []; // no DB rows

    const ctx = makeContext(makePayload());
    await capturedHandler(ctx);

    // 3 steps: dedup, resolve, publish-to-dlq
    expect(ctx.run).toHaveBeenCalledTimes(3);
    expect(mockPublishToTopic).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "webhook-dlq" }),
    );
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  it("routes to DLQ when resourceId is null", async () => {
    mockRedisSet.mockResolvedValue("OK");

    const ctx = makeContext(makePayload({ resourceId: null }));
    await capturedHandler(ctx);

    expect(mockPublishToTopic).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "webhook-dlq" }),
    );
  });

  it("falls through to DB when Redis cache has partial data (connectionId but no orgId)", async () => {
    mockRedisSet.mockResolvedValue("OK");
    // Redis returned an incomplete hash — e.g. partial write from a crashed cache populate
    mockRedisHgetall.mockResolvedValue({ connectionId: "conn-stale" });
    mockDbRows = [{ installationId: "conn-fresh", orgId: "org-fresh" }];

    const ctx = makeContext(makePayload());
    await capturedHandler(ctx);

    // Should have fallen through to DB and used the DB result
    expect(mockPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          connectionId: "conn-fresh",
          orgId: "org-fresh",
        }),
      }),
    );
    // Should have repopulated the cache with correct data
    expect(mockRedisHset).toHaveBeenCalled();
  });

  it("falls through to DB when Redis cache returns empty object", async () => {
    mockRedisSet.mockResolvedValue("OK");
    mockRedisHgetall.mockResolvedValue({}); // empty hash
    mockDbRows = [{ installationId: "conn-3", orgId: "org-3" }];

    const ctx = makeContext(makePayload());
    await capturedHandler(ctx);

    expect(mockPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          connectionId: "conn-3",
          orgId: "org-3",
        }),
      }),
    );
  });

  it("propagates Redis error from dedup step", async () => {
    mockRedisSet.mockRejectedValue(new Error("Redis connection refused"));

    const ctx = makeContext(makePayload());
    await expect(capturedHandler(ctx)).rejects.toThrow(
      "Redis connection refused",
    );
  });

  it("propagates QStash error from publish step", async () => {
    mockRedisSet.mockResolvedValue("OK");
    mockRedisHgetall.mockResolvedValue({
      connectionId: "conn-1",
      orgId: "org-1",
    });
    mockPublishJSON.mockRejectedValue(new Error("QStash rate limited"));

    const ctx = makeContext(makePayload());
    await expect(capturedHandler(ctx)).rejects.toThrow("QStash rate limited");
  });

  it("publishes complete WebhookEnvelope with all required fields", async () => {
    mockRedisSet.mockResolvedValue("OK");
    mockRedisHgetall.mockResolvedValue({
      connectionId: "conn-1",
      orgId: "org-1",
    });

    const payload = makePayload({
      provider: "vercel",
      deliveryId: "del-envelope",
      eventType: "deployment.created",
      resourceId: "prj_abc",
      payload: { type: "deployment.created", payload: { project: { id: "prj_abc" } } },
      receivedAt: 1700000001,
    });
    const ctx = makeContext(payload);
    await capturedHandler(ctx);

    // Assert the exact envelope shape — if any field is renamed or missing,
    // Console ingress will reject it
    const publishedBody = mockPublishJSON.mock.calls[0]![0].body;
    expect(publishedBody).toEqual({
      deliveryId: "del-envelope",
      connectionId: "conn-1",
      orgId: "org-1",
      provider: "vercel",
      eventType: "deployment.created",
      payload: { type: "deployment.created", payload: { project: { id: "prj_abc" } } },
      receivedAt: 1700000001,
    });
  });

  it("DLQ envelope contains all diagnostic fields", async () => {
    mockRedisSet.mockResolvedValue("OK");
    mockRedisHgetall.mockResolvedValue(null);
    mockDbRows = [];

    const payload = makePayload({
      provider: "linear",
      deliveryId: "del-dlq-shape",
      eventType: "Issue:create",
      resourceId: "org-unknown",
      payload: { type: "Issue", action: "create" },
      receivedAt: 1700000002,
    });
    const ctx = makeContext(payload);
    await capturedHandler(ctx);

    const dlqBody = mockPublishToTopic.mock.calls[0]![0].body;
    expect(dlqBody).toEqual({
      provider: "linear",
      deliveryId: "del-dlq-shape",
      eventType: "Issue:create",
      resourceId: "org-unknown",
      payload: { type: "Issue", action: "create" },
      receivedAt: 1700000002,
    });
  });
});
