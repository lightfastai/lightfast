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

/**
 * Simulates Upstash Workflow's step-level durability on retry.
 *
 * In production, when a workflow step fails and the workflow is re-invoked:
 * - Previously COMPLETED steps return their cached result (fn is NOT re-executed)
 * - The FAILED step re-executes fn
 * - Subsequent steps execute normally
 *
 * This is critical because some steps are NOT idempotent:
 * - Redis SET NX returns "OK" on first call, null on second (dedup would wrongly fire)
 * - DB queries may return different results if data changed between attempts
 *
 * @param payload - The workflow payload
 * @param cachedSteps - Map of step name → cached return value (steps that completed before failure)
 */
function makeRetryContext(
  payload: WebhookReceiptPayload,
  cachedSteps: Record<string, unknown>,
) {
  return {
    requestPayload: payload,
    run: vi.fn((name: string, fn: () => unknown) => {
      if (name in cachedSteps) {
        return cachedSteps[name]; // Return cached result, skip fn execution
      }
      return fn(); // Execute normally (this step failed last time or is new)
    }),
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

  describe("external dependency failures", () => {
    it("Redis dedup (SET NX) throws → error propagates, webhook is retried by Upstash", async () => {
      mockRedisSet.mockRejectedValue(new Error("Redis connection refused"));

      const ctx = makeContext(makePayload());
      await expect(capturedHandler(ctx)).rejects.toThrow(
        "Redis connection refused",
      );
      // No publish should have happened
      expect(mockPublishJSON).not.toHaveBeenCalled();
      expect(mockPublishToTopic).not.toHaveBeenCalled();
    });

    it("Redis hgetall throws during resolve → error propagates, step is retried", async () => {
      mockRedisSet.mockResolvedValue("OK");
      mockRedisHgetall.mockRejectedValue(new Error("Redis timeout"));

      const ctx = makeContext(makePayload());
      await expect(capturedHandler(ctx)).rejects.toThrow("Redis timeout");
      // Publish never reached
      expect(mockPublishJSON).not.toHaveBeenCalled();
    });

    it("DB query throws during resolve fallthrough → error propagates", async () => {
      mockRedisSet.mockResolvedValue("OK");
      mockRedisHgetall.mockResolvedValue(null); // cache miss → DB
      // Make the DB mock chain throw
      mockDbRows = undefined as unknown as typeof mockDbRows; // will cause .limit() to throw

      const ctx = makeContext(makePayload());
      await expect(capturedHandler(ctx)).rejects.toThrow();
      expect(mockPublishJSON).not.toHaveBeenCalled();
    });

    it("Redis hset (cache populate) throws → blocks publish even though connection was found", async () => {
      // This documents current behavior: cache populate failure inside the
      // resolve-connection step causes the ENTIRE step to fail, preventing
      // publish. Upstash retries the step, but it's worth knowing this is
      // the behavior — a cache write error blocks delivery.
      mockRedisSet.mockResolvedValue("OK");
      mockRedisHgetall.mockResolvedValue(null); // cache miss
      mockDbRows = [{ installationId: "conn-found", orgId: "org-found" }];
      mockRedisHset.mockRejectedValue(new Error("Redis write error"));

      const ctx = makeContext(makePayload());
      await expect(capturedHandler(ctx)).rejects.toThrow("Redis write error");
      // Connection was resolved but publish was never reached
      expect(mockPublishJSON).not.toHaveBeenCalled();
    });

    it("QStash publishJSON throws → error propagates, step is retried", async () => {
      mockRedisSet.mockResolvedValue("OK");
      mockRedisHgetall.mockResolvedValue({
        connectionId: "conn-1",
        orgId: "org-1",
      });
      mockPublishJSON.mockRejectedValue(new Error("QStash rate limited"));

      const ctx = makeContext(makePayload());
      await expect(capturedHandler(ctx)).rejects.toThrow("QStash rate limited");
    });

    it("DLQ publishToTopic throws → error propagates, step is retried", async () => {
      mockRedisSet.mockResolvedValue("OK");
      mockRedisHgetall.mockResolvedValue(null);
      mockDbRows = []; // no connection → DLQ path
      mockPublishToTopic.mockRejectedValue(new Error("QStash DLQ topic error"));

      const ctx = makeContext(makePayload());
      await expect(capturedHandler(ctx)).rejects.toThrow(
        "QStash DLQ topic error",
      );
    });
  });

  describe("step-level retry semantics", () => {
    // These tests simulate Upstash Workflow's durable execution model.
    // When a step fails, the entire handler is re-invoked, but previously
    // completed steps return cached results instead of re-executing.
    //
    // This catches a critical class of bugs: steps that are not idempotent
    // (like Redis SET NX) would produce WRONG results if re-executed,
    // causing silent webhook loss.

    it("publish retry after resolve-connection failure uses cached dedup result", async () => {
      // Scenario: First run completed dedup (not duplicate) and resolve-connection
      // (found connection), but publish-to-console failed (QStash down).
      // Upstash re-invokes the handler.
      //
      // Critical: dedup step must return cached false (not duplicate),
      // NOT re-execute SET NX (which would return null = "duplicate" and drop the webhook).
      mockPublishJSON.mockResolvedValue({ messageId: "msg-retry" });

      const ctx = makeRetryContext(makePayload(), {
        dedup: false, // Cached: not a duplicate
        "resolve-connection": { connectionId: "conn-1", orgId: "org-1" }, // Cached: found connection
        // "publish-to-console" NOT cached — this is the step that failed and needs retry
      });
      await capturedHandler(ctx);

      // Dedup step should NOT have re-executed (would call redis.set again)
      expect(mockRedisSet).not.toHaveBeenCalled();
      // Resolve step should NOT have re-executed (would call redis.hgetall/db again)
      expect(mockRedisHgetall).not.toHaveBeenCalled();
      // Only publish should have executed
      expect(mockPublishJSON).toHaveBeenCalledOnce();
      expect(mockPublishJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            connectionId: "conn-1",
            orgId: "org-1",
          }),
        }),
      );
    });

    it("resolve-connection retry after failure uses cached dedup result", async () => {
      // Scenario: Dedup completed (not duplicate), but resolve-connection
      // failed (Redis timeout on hgetall). Upstash re-invokes.
      //
      // Dedup must return cached result, resolve must re-execute.
      mockRedisHgetall.mockResolvedValue({
        connectionId: "conn-retry",
        orgId: "org-retry",
      });
      mockPublishJSON.mockResolvedValue({ messageId: "msg-1" });

      const ctx = makeRetryContext(makePayload(), {
        dedup: false, // Cached: not a duplicate
        // "resolve-connection" NOT cached — needs retry
        // "publish-to-console" NOT cached — hasn't run yet
      });
      await capturedHandler(ctx);

      // Dedup should not re-execute
      expect(mockRedisSet).not.toHaveBeenCalled();
      // Resolve should re-execute (it was the failed step)
      expect(mockRedisHgetall).toHaveBeenCalledOnce();
      // Publish should execute with the freshly resolved connection
      expect(mockPublishJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            connectionId: "conn-retry",
            orgId: "org-retry",
          }),
        }),
      );
    });

    it("DLQ publish retry uses cached dedup and resolve results", async () => {
      // Scenario: Dedup and resolve both completed (no connection found),
      // but DLQ publish failed. On retry, both cached results are used.
      mockPublishToTopic.mockResolvedValue([{ messageId: "msg-dlq-retry" }]);

      const ctx = makeRetryContext(makePayload(), {
        dedup: false,
        "resolve-connection": null, // Cached: no connection found → DLQ path
      });
      await capturedHandler(ctx);

      expect(mockRedisSet).not.toHaveBeenCalled();
      expect(mockRedisHgetall).not.toHaveBeenCalled();
      expect(mockPublishToTopic).toHaveBeenCalledWith(
        expect.objectContaining({ topic: "webhook-dlq" }),
      );
      expect(mockPublishJSON).not.toHaveBeenCalled();
    });

    it("duplicate detection is stable across retries when cached", async () => {
      // If the first run found a duplicate (SET NX returned null),
      // the retry should also see "duplicate" from cache and exit cleanly.
      const ctx = makeRetryContext(makePayload(), {
        dedup: true, // Cached: IS a duplicate
      });
      await capturedHandler(ctx);

      // Should exit immediately — no resolve, no publish
      expect(mockRedisSet).not.toHaveBeenCalled();
      expect(mockRedisHgetall).not.toHaveBeenCalled();
      expect(mockPublishJSON).not.toHaveBeenCalled();
      expect(mockPublishToTopic).not.toHaveBeenCalled();
    });
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
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
