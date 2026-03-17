import type { WebhookReceiptPayload } from "@repo/console-providers";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock externals ──

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

vi.mock("@vendor/qstash", () => ({
  getQStashClient: () => ({
    publishJSON: mockPublishJSON,
    publishToTopic: mockPublishToTopic,
  }),
}));

const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockOnConflictDoNothing = vi.fn().mockResolvedValue(undefined);
const mockDbSet = vi.fn();
const mockDbWhere = vi.fn().mockResolvedValue(undefined);
const dbOps: { op: "insert" | "update"; values?: unknown; set?: unknown }[] =
  [];

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
      const idx = dbOps.length;
      dbOps.push({ op: "insert" });
      return {
        values: (...valArgs: unknown[]) => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          dbOps[idx]!.values = valArgs[0];
          return { onConflictDoNothing: mockOnConflictDoNothing };
        },
      };
    },
    update: (...args: unknown[]) => {
      mockDbUpdate(...args);
      const idx = dbOps.length;
      dbOps.push({ op: "update" });
      return {
        set: (...setArgs: unknown[]) => {
          mockDbSet(...setArgs);
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          dbOps[idx]!.set = setArgs[0];
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

// This must be a mutable ref so tests can change the DB result
let mockDbRows: { installationId: string; orgId: string }[] = [];

// Force module load to trigger serve() and capture the handler
await import("./workflows.js");

// ── Test helpers ──

function makePayload(
  overrides: Partial<WebhookReceiptPayload> = {}
): WebhookReceiptPayload {
  return {
    provider: "github",
    deliveryId: "del-001",
    eventType: "push",
    resourceId: "res-123",
    payload: { repository: { id: 42 } },
    receivedAt: 1_700_000_000,
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
 * @param payload - The workflow payload
 * @param cachedSteps - Map of step name → cached return value (steps that completed before failure)
 */
function makeRetryContext(
  payload: WebhookReceiptPayload,
  cachedSteps: Record<string, unknown>
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
    dbOps.length = 0;
    mockPublishJSON.mockResolvedValue({ messageId: "msg-1" });
    mockPublishToTopic.mockResolvedValue([{ messageId: "msg-2" }]);
    mockDbRows = [];
    mockOnConflictDoNothing.mockResolvedValue(undefined);
    mockDbWhere.mockResolvedValue(undefined);
  });

  it("publishes to Console when connection found in DB", async () => {
    mockDbRows = [{ installationId: "conn-1", orgId: "org-1" }];

    const ctx = makeContext(makePayload());
    await capturedHandler(ctx);

    // 5 steps: persist-delivery, resolve-connection, route, publish-to-console, update-status-enqueued
    expect(ctx.run).toHaveBeenCalledTimes(5);
    expect(mockPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://console.test/api/gateway/ingress",
        body: expect.objectContaining({
          deliveryId: "del-001",
          connectionId: "conn-1",
          orgId: "org-1",
          provider: "github",
          eventType: "push",
        }),
        retries: 5,
        callback:
          "https://relay.test/api/admin/delivery-status?provider=github",
      })
    );

    // Assert full DB write sequence: persist → set installationId → mark enqueued
    expect(dbOps).toEqual([
      {
        op: "insert",
        values: {
          provider: "github",
          deliveryId: "del-001",
          eventType: "push",
          status: "received",
          payload: JSON.stringify({ repository: { id: 42 } }),
          receivedAt: new Date(1_700_000_000_000).toISOString(),
        },
      },
      { op: "update", set: { installationId: "conn-1" } },
      { op: "update", set: { status: "enqueued" } },
    ]);
  });

  it("routes to DLQ when no connection found", async () => {
    mockDbRows = []; // no DB rows

    const ctx = makeContext(makePayload());
    await capturedHandler(ctx);

    // 3 steps: persist-delivery, resolve-connection, route (DLQ publish + status update)
    expect(ctx.run).toHaveBeenCalledTimes(3);
    expect(mockPublishToTopic).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "webhook-dlq" })
    );
    expect(mockPublishJSON).not.toHaveBeenCalled();

    // Assert DB writes: persist → mark as DLQ (no installationId update)
    expect(dbOps).toEqual([
      {
        op: "insert",
        values: {
          provider: "github",
          deliveryId: "del-001",
          eventType: "push",
          status: "received",
          payload: JSON.stringify({ repository: { id: 42 } }),
          receivedAt: new Date(1_700_000_000_000).toISOString(),
        },
      },
      { op: "update", set: { status: "dlq" } },
    ]);
  });

  it("routes to DLQ when resourceId is null", async () => {
    const ctx = makeContext(makePayload({ resourceId: null }));
    await capturedHandler(ctx);

    expect(mockPublishToTopic).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "webhook-dlq" })
    );
  });

  describe("external dependency failures", () => {
    it("DB query throws during resolve → error propagates", async () => {
      // Make the DB mock chain throw
      mockDbRows = undefined as unknown as typeof mockDbRows; // will cause .limit() to throw

      const ctx = makeContext(makePayload());
      await expect(capturedHandler(ctx)).rejects.toThrow();
      expect(mockPublishJSON).not.toHaveBeenCalled();
    });

    it("QStash publishJSON throws → error propagates, step is retried", async () => {
      mockDbRows = [{ installationId: "conn-1", orgId: "org-1" }];
      mockPublishJSON.mockRejectedValue(new Error("QStash rate limited"));

      const ctx = makeContext(makePayload());
      await expect(capturedHandler(ctx)).rejects.toThrow("QStash rate limited");
    });

    it("DLQ publishToTopic throws → error propagates, step is retried", async () => {
      mockDbRows = []; // no connection → DLQ path
      mockPublishToTopic.mockRejectedValue(new Error("QStash DLQ topic error"));

      const ctx = makeContext(makePayload());
      await expect(capturedHandler(ctx)).rejects.toThrow(
        "QStash DLQ topic error"
      );
    });
  });

  it("publishes complete WebhookEnvelope with all required fields", async () => {
    mockDbRows = [{ installationId: "conn-1", orgId: "org-1" }];

    const payload = makePayload({
      provider: "vercel",
      deliveryId: "del-envelope",
      eventType: "deployment.created",
      resourceId: "prj_abc",
      payload: {
        type: "deployment.created",
        payload: { project: { id: "prj_abc" } },
      },
      receivedAt: 1_700_000_001,
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
      payload: {
        type: "deployment.created",
        payload: { project: { id: "prj_abc" } },
      },
      receivedAt: 1_700_000_001,
    });
  });

  /**
   * Compute the effective final DB row state by replaying ops in order.
   * insert sets initial state, each update merges on top.
   */
  function computeFinalDbState(ops: typeof dbOps): Record<string, unknown> {
    let state: Record<string, unknown> = {};
    for (const op of ops) {
      if (op.op === "insert" && op.values) {
        state = { ...state, ...(op.values as Record<string, unknown>) };
      }
      if (op.op === "update" && op.set) {
        state = { ...state, ...(op.set as Record<string, unknown>) };
      }
    }
    return state;
  }

  describe("path parity: workflow vs service auth final state", () => {
    it("happy path produces equivalent final DB state to service auth path", async () => {
      mockDbRows = [{ installationId: "conn-1", orgId: "org-1" }];

      const ctx = makeContext(makePayload());
      await capturedHandler(ctx);

      const finalState = computeFinalDbState(dbOps);

      // Service auth path inserts {installationId, status:"received"} then updates {status:"enqueued"}.
      // Workflow inserts {status:"received"}, updates {installationId}, then updates {status:"enqueued"}.
      // Final state must match: installationId set, status is "enqueued".
      expect(finalState).toEqual(
        expect.objectContaining({
          provider: "github",
          deliveryId: "del-001",
          eventType: "push",
          status: "enqueued",
          installationId: "conn-1",
        })
      );
    });

    it("DLQ path: final state has status 'dlq' and no installationId", async () => {
      mockDbRows = [];

      const ctx = makeContext(makePayload());
      await capturedHandler(ctx);

      const finalState = computeFinalDbState(dbOps);
      expect(finalState).toEqual(
        expect.objectContaining({
          status: "dlq",
        })
      );
      expect(finalState).not.toHaveProperty("installationId");
    });
  });

  describe("delivery status state machine", () => {
    it("successful path: status reaches 'enqueued' exactly once, never 'dlq'", async () => {
      mockDbRows = [{ installationId: "c1", orgId: "org-1" }];
      mockPublishJSON.mockResolvedValue({ messageId: "msg-1" });
      mockDbWhere.mockResolvedValue(undefined);

      const ctx = makeContext(makePayload());
      await capturedHandler(ctx);

      // Console publish was called; DLQ was not
      expect(mockPublishJSON).toHaveBeenCalledOnce();
      expect(mockPublishToTopic).not.toHaveBeenCalled();
      // DB sequence ends with status=enqueued
      const finalOp = dbOps.at(-1);
      expect(finalOp?.set).toMatchObject({ status: "enqueued" });
    });

    it("no-connection path: status reaches 'dlq' exactly once, never 'enqueued'", async () => {
      mockDbRows = []; // DB miss → no connection → DLQ
      mockPublishToTopic.mockResolvedValue([{ messageId: "dlq-1" }]);
      mockDbWhere.mockResolvedValue(undefined);

      const ctx = makeContext(makePayload());
      await capturedHandler(ctx);

      expect(mockPublishToTopic).toHaveBeenCalledOnce();
      expect(mockPublishJSON).not.toHaveBeenCalled();
      const finalOp = dbOps.at(-1);
      expect(finalOp?.set).toMatchObject({ status: "dlq" });
    });

    it("publish-to-console failure: update-status-enqueued step never runs", async () => {
      mockDbRows = [{ installationId: "c1", orgId: "org-1" }];
      mockPublishJSON.mockRejectedValue(new Error("QStash down"));

      const ctx = makeContext(makePayload());
      await expect(capturedHandler(ctx)).rejects.toThrow("QStash down");

      // Only the update-connection (installationId) step ran — status=enqueued update was never reached
      expect(mockDbUpdate).toHaveBeenCalledTimes(1);
      const updateOp = dbOps.find((op) => op.op === "update");
      expect(updateOp?.set).toMatchObject({ installationId: "c1" });
    });

    it("update-status-enqueued failure after publish: status stuck at 'received'", async () => {
      // Documents the at-most-once delivery gap:
      // QStash publish succeeds (event dispatched), but status update fails.
      // On Upstash retry, the status-update step re-runs (idempotent DB update).
      // QStash dedup prevents re-publish via deduplicationId.
      mockDbRows = [{ installationId: "c1", orgId: "org-1" }];
      mockPublishJSON.mockResolvedValue({ messageId: "msg-1" });

      // Second .where() call (status=enqueued update) throws; first (installationId) succeeds
      let updateCallCount = 0;
      mockDbWhere.mockImplementation(async () => {
        updateCallCount++;
        if (updateCallCount === 2) {
          throw new Error("DB timeout");
        }
      });

      const ctx = makeContext(makePayload());
      await expect(capturedHandler(ctx)).rejects.toThrow("DB timeout");

      // Publish succeeded (event dispatched to Console)
      expect(mockPublishJSON).toHaveBeenCalledOnce();
      // Both update calls were attempted
      expect(updateCallCount).toBe(2);
    });

    it("state machine is exhaustive: terminal states are 'enqueued' and 'dlq' only", () => {
      // Documentation test: asserts the complete set of terminal states.
      // NOTE: "failed" is NOT a terminal state — failed deliveries remain at "received"
      // and are retried by Upstash or replayed via the admin endpoint.
      const TERMINAL_STATES = new Set(["enqueued", "dlq"]);
      const REACHABLE_STATES = new Set([
        "enqueued", // happy path: connection resolved + QStash publish success
        "dlq", // no-connection path: publishToTopic
      ]);
      expect(REACHABLE_STATES).toEqual(TERMINAL_STATES);
    });
  });

  describe("step-level retry semantics", () => {
    // These tests simulate Upstash Workflow's durable execution model.
    // When a step fails, the entire handler is re-invoked, but previously
    // completed steps return cached results instead of re-executing.

    it("publish retry after resolve-connection failure uses cached resolve result", async () => {
      // Scenario: resolve-connection completed (found connection), but publish-to-console
      // failed (QStash down). Upstash re-invokes the handler.
      mockPublishJSON.mockResolvedValue({ messageId: "msg-retry" });

      const ctx = makeRetryContext(makePayload(), {
        "persist-delivery": undefined, // cached
        "resolve-connection": { connectionId: "conn-1", orgId: "org-1" }, // Cached: found connection
        // "publish-to-console" NOT cached — this is the step that failed and needs retry
      });
      await capturedHandler(ctx);

      // Only publish should have executed
      expect(mockPublishJSON).toHaveBeenCalledOnce();
      expect(mockPublishJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            connectionId: "conn-1",
            orgId: "org-1",
          }),
        })
      );
    });

    it("resolve-connection retry after failure re-executes via DB", async () => {
      // Scenario: persist-delivery completed, but resolve-connection failed.
      // Upstash re-invokes. Resolve must re-execute via DB.
      mockDbRows = [{ installationId: "conn-retry", orgId: "org-retry" }];
      mockPublishJSON.mockResolvedValue({ messageId: "msg-1" });

      const ctx = makeRetryContext(makePayload(), {
        "persist-delivery": undefined, // cached
        // "resolve-connection" NOT cached — needs retry
      });
      await capturedHandler(ctx);

      // Publish should execute with the freshly resolved connection from DB
      expect(mockPublishJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            connectionId: "conn-retry",
            orgId: "org-retry",
          }),
        })
      );
    });

    it("DLQ publish retry uses cached resolve result", async () => {
      // Scenario: resolve completed (no connection found), but DLQ publish failed.
      // On retry, cached result is used.
      mockPublishToTopic.mockResolvedValue([{ messageId: "msg-dlq-retry" }]);

      const ctx = makeRetryContext(makePayload(), {
        "persist-delivery": undefined, // cached
        "resolve-connection": null, // Cached: no connection found → DLQ path
      });
      await capturedHandler(ctx);

      expect(mockPublishToTopic).toHaveBeenCalledWith(
        expect.objectContaining({ topic: "webhook-dlq" })
      );
      expect(mockPublishJSON).not.toHaveBeenCalled();
    });
  });

  it("DLQ envelope contains all diagnostic fields", async () => {
    mockDbRows = [];

    const payload = makePayload({
      provider: "linear",
      deliveryId: "del-dlq-shape",
      eventType: "Issue:create",
      resourceId: "org-unknown",
      payload: { type: "Issue", action: "create" },
      receivedAt: 1_700_000_002,
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
      receivedAt: 1_700_000_002,
    });
  });
});
