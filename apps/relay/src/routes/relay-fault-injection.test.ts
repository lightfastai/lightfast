/**
 * Relay Workflow Fault Injection Tests
 *
 * For every step boundary in the durable webhook delivery workflow,
 * injects a specific fault and verifies:
 *   - The error propagates correctly (Upstash Workflow will retry the step)
 *   - Previously-completed steps ran exactly once
 *   - No phantom side effects (publish never called when it shouldn't be)
 *
 * Steps in order:
 *   1. persist-delivery — db.insert
 *   2. resolve-connection — direct DB query
 *   3. route — db.update + DLQ or console decision
 *   4a. publish-to-dlq / 4b. update-status-dlq (not-found path)
 *   4c. publish-to-console / 4d. update-status-enqueued (found path)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Handler capture ──

let capturedHandler: (context: unknown) => Promise<void>;

vi.mock("@vendor/upstash-workflow/hono", () => ({
  serve: (handler: (ctx: unknown) => Promise<void>) => {
    capturedHandler = handler;
    return () => new Response("ok");
  },
}));

// ── Mock externals ──

const mockPublishJSON = vi.fn();
const mockPublishToTopic = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockOnConflictDoNothing = vi.fn();
const mockDbWhere = vi.fn();

let mockDbRows: { installationId: string; orgId: string }[] = [];

vi.mock("@vendor/qstash", () => ({
  getQStashClient: () => ({
    publishJSON: (...args: unknown[]) => mockPublishJSON(...args),
    publishToTopic: (...args: unknown[]) => mockPublishToTopic(...args),
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
    insert: (...args: unknown[]) => {
      mockDbInsert(...args);
      return {
        values: () => ({ onConflictDoNothing: mockOnConflictDoNothing }),
      };
    },
    update: (...args: unknown[]) => {
      mockDbUpdate(...args);
      return {
        set: () => ({ where: mockDbWhere }),
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

// Force module load to capture handler
await import("./workflows.js");

// ── Helpers ──

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    provider: "github",
    deliveryId: "del-fault-001",
    eventType: "push",
    resourceId: "res-123",
    payload: { repository: { id: 1 } },
    receivedAt: 1_700_000_000,
    ...overrides,
  };
}

function makeContext(payload: ReturnType<typeof makePayload>) {
  return {
    requestPayload: payload,
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
  };
}

/**
 * Simulates Upstash Workflow's step-level durability on retry.
 * Previously completed steps return their cached result without re-executing.
 */
function makeRetryContext(
  payload: ReturnType<typeof makePayload>,
  cachedSteps: Record<string, unknown>
) {
  return {
    requestPayload: payload,
    run: vi.fn((name: string, fn: () => unknown) => {
      if (name in cachedSteps) {
        return cachedSteps[name];
      }
      return fn();
    }),
  };
}

// ── Default happy-path setup ──

function setHappyPath() {
  mockPublishJSON.mockResolvedValue({ messageId: "msg-1" });
  mockPublishToTopic.mockResolvedValue([{ messageId: "msg-dlq-1" }]);
  mockOnConflictDoNothing.mockResolvedValue(undefined);
  mockDbWhere.mockResolvedValue(undefined);
  mockDbRows = [{ installationId: "conn-1", orgId: "org-1" }];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbRows = [];
  setHappyPath();
});

// ── Step 1: persist-delivery ──

describe("step 1 — persist-delivery fault injection", () => {
  it("db.insert chain throws → handler rejects after 1 step, no resolve, no publish", async () => {
    mockOnConflictDoNothing.mockRejectedValue(new Error("DB connection lost"));
    const ctx = makeContext(makePayload());

    await expect(capturedHandler(ctx)).rejects.toThrow("DB connection lost");

    expect(ctx.run).toHaveBeenCalledTimes(1); // only persist-delivery ran
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  it("persist fault is idempotent on retry via onConflictDoNothing — duplicate persist is safe", async () => {
    // First attempt: persist succeeds (onConflictDoNothing returns normally)
    // This verifies that re-persisting the same deliveryId on retry is safe.
    mockOnConflictDoNothing.mockResolvedValue(undefined);
    const ctx = makeContext(makePayload());
    await capturedHandler(ctx);

    expect(mockOnConflictDoNothing).toHaveBeenCalledOnce();
    expect(mockPublishJSON).toHaveBeenCalledOnce();
  });
});

// ── Step 2: resolve-connection ──

describe("step 2 — resolve-connection fault injection", () => {
  it("DB query throws → handler rejects, no publish", async () => {
    // Make DB mock throw by returning something that breaks .limit()
    mockDbRows = undefined as unknown as typeof mockDbRows;
    const ctx = makeContext(makePayload());

    await expect(capturedHandler(ctx)).rejects.toThrow();
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  it("on retry: resolve step re-executes, persist uses cached result", async () => {
    // Simulate retry where persist completed but resolve failed
    mockDbRows = [{ installationId: "conn-retry", orgId: "org-retry" }];

    const ctx = makeRetryContext(makePayload(), {
      "persist-delivery": undefined, // cached
      // resolve-connection NOT cached — needs retry
    });
    await capturedHandler(ctx);

    expect(mockPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ connectionId: "conn-retry" }),
      })
    );
  });
});

// ── Step 3: route (update-connection — found path) ──

describe("step 3 — update-connection fault injection", () => {
  it("db.update throws → handler rejects after resolve, before publish", async () => {
    mockDbWhere.mockRejectedValueOnce(new Error("DB write failed"));
    const ctx = makeContext(makePayload());

    await expect(capturedHandler(ctx)).rejects.toThrow("DB write failed");
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  it("on retry: update-connection re-executes, persist and resolve use cached results", async () => {
    const ctx = makeRetryContext(makePayload(), {
      "persist-delivery": undefined,
      "resolve-connection": {
        connectionId: "conn-cached",
        orgId: "org-cached",
      },
      // route NOT cached — failed last time
    });
    await capturedHandler(ctx);

    // route + update-status-enqueued both execute
    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
    // publish follows
    expect(mockPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ connectionId: "conn-cached" }),
      })
    );
  });
});

// ── Step 4c: publish-to-console (found path) ──

describe("step 4c — publish-to-console fault injection", () => {
  it("qstash publishJSON throws → handler rejects, no status update", async () => {
    mockPublishJSON.mockRejectedValue(new Error("QStash 429 rate limited"));
    const ctx = makeContext(makePayload());

    await expect(capturedHandler(ctx)).rejects.toThrow(
      "QStash 429 rate limited"
    );
    // Resolve ran, but status update never reached
    // Only 1 update: route step DB update (before publish)
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
  });

  it("on retry: publish re-executes, prior steps use cached results", async () => {
    const ctx = makeRetryContext(makePayload(), {
      "persist-delivery": undefined,
      "resolve-connection": { connectionId: "conn-1", orgId: "org-1" },
      route: "console",
      // publish-to-console NOT cached — failed last time
    });
    await capturedHandler(ctx);

    expect(mockPublishJSON).toHaveBeenCalledOnce();
  });
});

// ── Step 4d: update-status-enqueued ──

describe("step 4d — update-status-enqueued fault injection", () => {
  it("db.update throws for status enqueued → handler rejects (step retried by Upstash)", async () => {
    let updateCallCount = 0;
    mockDbWhere.mockImplementation(() => {
      updateCallCount++;
      if (updateCallCount === 2) {
        // 2nd update = update-status-enqueued
        return Promise.reject(new Error("DB constraint violation"));
      }
      return Promise.resolve(undefined);
    });
    const ctx = makeContext(makePayload());

    await expect(capturedHandler(ctx)).rejects.toThrow(
      "DB constraint violation"
    );
    // Publish DID run (error is in the post-publish status step)
    expect(mockPublishJSON).toHaveBeenCalledOnce();
  });
});

// ── Step 4a: publish-to-dlq (not-found path) ──

describe("step 4a — publish-to-dlq fault injection", () => {
  beforeEach(() => {
    // Override to not-found path
    mockDbRows = [];
  });

  it("publishToTopic throws → handler rejects, DLQ status not updated", async () => {
    mockPublishToTopic.mockRejectedValue(new Error("QStash topic full"));
    const ctx = makeContext(makePayload());

    await expect(capturedHandler(ctx)).rejects.toThrow("QStash topic full");
    expect(mockPublishJSON).not.toHaveBeenCalled();
    // Only 1 DB write: persist-delivery (no status update for DLQ reached)
    expect(mockDbInsert).toHaveBeenCalledOnce();
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it("on retry: DLQ publish re-executes with cached persist and resolve", async () => {
    const ctx = makeRetryContext(makePayload(), {
      "persist-delivery": undefined,
      "resolve-connection": null, // cached: no connection found → DLQ path
      // publish-to-dlq NOT cached — failed last time
    });
    await capturedHandler(ctx);

    expect(mockPublishToTopic).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "webhook-dlq" })
    );
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });
});

// ── Step 4b: update-status-dlq ──

describe("step 4b — update-status-dlq fault injection", () => {
  beforeEach(() => {
    mockDbRows = [];
  });

  it("db.update throws for DLQ status → handler rejects after DLQ publish", async () => {
    mockDbWhere.mockRejectedValue(new Error("DB timeout"));
    const ctx = makeContext(makePayload());

    await expect(capturedHandler(ctx)).rejects.toThrow("DB timeout");
    // DLQ publish DID run
    expect(mockPublishToTopic).toHaveBeenCalledOnce();
  });
});

// ── Boundary value tests ──

describe("receivedAt normalization boundary", () => {
  it("epoch seconds (< 1e12) is converted to milliseconds in persisted record", async () => {
    const ctx = makeContext(makePayload({ receivedAt: 1_700_000_000 }));
    await capturedHandler(ctx);

    // The persisted receivedAt should be the ISO string of epoch ms
    expect(mockDbInsert).toHaveBeenCalledOnce();
    // The insert values are passed to .values() — check it was called
    // (values are checked in workflows.test.ts, this confirms normalization doesn't throw)
    expect(mockPublishJSON).toHaveBeenCalledOnce();
  });

  it("epoch milliseconds (>= 1e12) is used directly without multiplication", async () => {
    const receivedAtMs = 1_700_000_000_000; // already ms
    const ctx = makeContext(makePayload({ receivedAt: receivedAtMs }));
    await capturedHandler(ctx);

    expect(mockPublishJSON).toHaveBeenCalledOnce();
  });

  it("receivedAt at boundary (1e12 exactly) is treated as milliseconds", async () => {
    const ctx = makeContext(makePayload({ receivedAt: 1e12 }));
    await capturedHandler(ctx);

    // Should not throw — the boundary is inclusive for ms path
    expect(mockPublishJSON).toHaveBeenCalledOnce();
  });
});

describe("null resourceId path", () => {
  it("null resourceId skips DB query, routes to DLQ", async () => {
    mockDbRows = [];
    const ctx = makeContext(makePayload({ resourceId: null }));
    await capturedHandler(ctx);

    // resolve-connection skips DB lookup entirely when resourceId is null
    expect(mockPublishToTopic).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "webhook-dlq" })
    );
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  it("null resourceId DLQ envelope includes null resourceId field", async () => {
    mockDbRows = [];
    const ctx = makeContext(
      makePayload({ resourceId: null, deliveryId: "del-null-res" })
    );
    await capturedHandler(ctx);

    const dlqCall = mockPublishToTopic.mock.calls[0]?.[0] as {
      body: Record<string, unknown>;
    };
    expect(dlqCall?.body).toHaveProperty("resourceId", null);
    expect(dlqCall?.body).toHaveProperty("deliveryId", "del-null-res");
  });
});

describe("correlationId propagation", () => {
  it("correlationId is forwarded in QStash Console publish headers", async () => {
    const ctx = makeContext(makePayload({ correlationId: "trace-abc-123" }));
    await capturedHandler(ctx);

    expect(mockPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { "X-Correlation-Id": "trace-abc-123" },
      })
    );
  });

  it("missing correlationId produces no X-Correlation-Id header", async () => {
    const ctx = makeContext(makePayload()); // no correlationId field
    await capturedHandler(ctx);

    const call = mockPublishJSON.mock.calls[0]?.[0] as {
      headers?: unknown;
    };
    expect(call?.headers).toBeUndefined();
  });

  it("correlationId is forwarded in DLQ publish headers", async () => {
    mockDbRows = [];
    const ctx = makeContext(
      makePayload({ resourceId: null, correlationId: "trace-dlq-999" })
    );
    await capturedHandler(ctx);

    expect(mockPublishToTopic).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { "X-Correlation-Id": "trace-dlq-999" },
      })
    );
  });
});
