/**
 * Relay Workflow Invariant Matrix Testing
 *
 * Defines scenario dimensions as typed arrays, computes their cartesian
 * product, and runs every combination against universal invariants.
 * Catches edge cases that hand-crafted tests miss.
 *
 * Scenarios: 72 (4 × 3 × 3 × 2)
 * - provider: github | linear | sentry | vercel
 * - resolutionPath: cache-hit | db-hit | not-found
 * - deduplication: new-delivery | duplicate | redis-unavailable
 * - qstashResult: success | failure
 *
 * Invariants per scenario (7 total):
 *   I.   duplicate → exactly 1 step, no side effects
 *   II.  new-delivery → exactly 1 DB insert (persist-delivery)
 *   III. new-delivery && not-found → DLQ publish, status="dlq"
 *   IV.  new-delivery && found && success → Console publish with correct shape
 *   V.   new-delivery && db-hit → Redis cache populated
 *   VI.  new-delivery && found && failure → error propagates
 *   VII. redis-unavailable → throws, no side effects (never silently drops)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Types ──

interface RelayScenario {
  deduplication: "new-delivery" | "duplicate" | "redis-unavailable";
  provider: string;
  qstashResult: "success" | "failure";
  resolutionPath: "cache-hit" | "db-hit" | "not-found";
}

// ── Cartesian product engine ──

function cartesian<T extends Record<string, readonly unknown[]>>(
  dims: T
): Array<{ [K in keyof T]: T[K][number] }> {
  const keys = Object.keys(dims) as (keyof T)[];
  const values = keys.map((k) => dims[k] as readonly unknown[]);
  const results: Array<{ [K in keyof T]: T[K][number] }> = [];
  const indices = new Array(keys.length).fill(0) as number[];
  const lengths = values.map((v) => v.length);

  if (lengths.some((l) => l === 0)) {
    return results;
  }

  while (true) {
    const entry = {} as { [K in keyof T]: T[K][number] };
    for (let i = 0; i < keys.length; i++) {
      (entry as Record<string, unknown>)[keys[i] as string] =
        values[i]![indices[i]!];
    }
    results.push(entry);

    let carry = true;
    for (let i = keys.length - 1; i >= 0 && carry; i--) {
      indices[i]!++;
      if (indices[i]! < lengths[i]!) {
        carry = false;
      } else {
        indices[i] = 0;
      }
    }
    if (carry) {
      break;
    }
  }
  return results;
}

function scenarioLabel(s: RelayScenario): string {
  return `provider=${s.provider} path=${s.resolutionPath} dedup=${s.deduplication} qstash=${s.qstashResult}`;
}

// ── Mock declarations ──

const mockRedisSet = vi.fn();
const mockRedisHgetall = vi.fn();
const mockRedisHset = vi.fn();
const mockRedisExpire = vi.fn();
const mockPipelineExec = vi.fn();
const mockPublishJSON = vi.fn();
const mockPublishToTopic = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockOnConflictDoNothing = vi.fn();
const mockDbWhere = vi.fn();

let mockDbRows: { installationId: string; orgId: string }[] = [];

// Capture the workflow handler passed to serve()
let capturedHandler: (context: unknown) => Promise<void>;

vi.mock("@vendor/upstash-workflow/hono", () => ({
  serve: (handler: (ctx: unknown) => Promise<void>) => {
    capturedHandler = handler;
    return () => new Response("ok");
  },
}));

vi.mock("@vendor/upstash", () => ({
  redis: {
    set: (...args: unknown[]) => mockRedisSet(...args),
    hgetall: (...args: unknown[]) => mockRedisHgetall(...args),
    pipeline: () => {
      const pipe = {
        hset: (...args: unknown[]) => {
          mockRedisHset(...args);
          return pipe;
        },
        expire: (...args: unknown[]) => {
          mockRedisExpire(...args);
          return pipe;
        },
        exec: () => mockPipelineExec(),
      };
      return pipe;
    },
  },
}));

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

function makePayload(provider: string, deliveryId = "del-001") {
  return {
    provider,
    deliveryId,
    eventType: "test.event",
    resourceId: `res-${provider}-001`,
    payload: { action: "test" },
    receivedAt: 1_700_000_000,
  };
}

function makeContext(payload: ReturnType<typeof makePayload>) {
  return {
    requestPayload: payload,
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
  };
}

function configureMocks(s: RelayScenario) {
  if (s.deduplication === "redis-unavailable") {
    // Redis is down — SET NX throws
    mockRedisSet.mockRejectedValue(new Error("Redis connection refused"));
    return;
  }

  // Dedup: SET NX returns null = duplicate (key existed), "OK" = new
  mockRedisSet.mockResolvedValue(s.deduplication === "duplicate" ? null : "OK");

  if (s.deduplication === "new-delivery") {
    // Resolution path
    if (s.resolutionPath === "cache-hit") {
      mockRedisHgetall.mockResolvedValue({
        connectionId: `conn-${s.provider}`,
        orgId: `org-${s.provider}`,
      });
      mockDbRows = []; // DB should NOT be called
    } else if (s.resolutionPath === "db-hit") {
      mockRedisHgetall.mockResolvedValue(null); // cache miss
      mockDbRows = [
        {
          installationId: `conn-${s.provider}`,
          orgId: `org-${s.provider}`,
        },
      ];
      mockPipelineExec.mockResolvedValue([]);
    } else {
      // not-found
      mockRedisHgetall.mockResolvedValue(null); // cache miss
      mockDbRows = []; // DB also miss
    }

    // QStash outcome
    if (s.qstashResult === "success") {
      mockPublishJSON.mockResolvedValue({ messageId: "msg-ok" });
      mockPublishToTopic.mockResolvedValue([{ messageId: "msg-dlq-ok" }]);
    } else if (s.resolutionPath === "not-found") {
      // failure — only affects the relevant publish call
      mockPublishToTopic.mockRejectedValue(new Error("QStash DLQ error"));
    } else {
      mockPublishJSON.mockRejectedValue(new Error("QStash Console error"));
    }

    mockOnConflictDoNothing.mockResolvedValue(undefined);
    mockDbWhere.mockResolvedValue(undefined);
  }
}

// ── Scenario dimensions ──

const dims = {
  provider: ["github", "linear", "sentry", "vercel"] as const,
  resolutionPath: ["cache-hit", "db-hit", "not-found"] as const,
  deduplication: ["new-delivery", "duplicate", "redis-unavailable"] as const,
  qstashResult: ["success", "failure"] as const,
};

// 4 × 3 × 3 × 2 = 72 scenarios
const scenarios = cartesian(dims) as RelayScenario[];

// ── Matrix tests ──

describe("relay workflow invariant matrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbRows = [];
    mockPipelineExec.mockResolvedValue([]);
  });

  it.each(
    scenarios.map((s) => [scenarioLabel(s), s] as const)
  )("%s", async (_label, scenario) => {
    configureMocks(scenario);
    const payload = makePayload(scenario.provider);
    const ctx = makeContext(payload);

    // ── Execute ──

    let error: Error | null = null;

    if (scenario.deduplication === "redis-unavailable") {
      // Invariant VII: Redis down → throws, no side effects (never silently drops)
      await expect(capturedHandler(ctx)).rejects.toThrow();
      expect(mockDbInsert).not.toHaveBeenCalled();
      expect(mockPublishJSON).not.toHaveBeenCalled();
      expect(mockPublishToTopic).not.toHaveBeenCalled();
      return;
    }

    if (
      scenario.qstashResult === "failure" &&
      scenario.deduplication === "new-delivery"
    ) {
      await expect(capturedHandler(ctx)).rejects.toThrow();
      return; // Invariant VI: error propagates — no further checks needed
    }
    try {
      await capturedHandler(ctx);
    } catch (e) {
      error = e as Error;
    }

    // ── Invariants ──

    if (scenario.deduplication === "duplicate") {
      // Invariant I: duplicate → 1 step, no side effects
      expect(ctx.run).toHaveBeenCalledTimes(1);
      expect(mockDbInsert).not.toHaveBeenCalled();
      expect(mockPublishJSON).not.toHaveBeenCalled();
      expect(mockPublishToTopic).not.toHaveBeenCalled();
      expect(error).toBeNull();
      return;
    }

    // Invariant II: new-delivery → always 1 DB insert
    expect(mockDbInsert).toHaveBeenCalledTimes(1);
    expect(error).toBeNull();

    if (scenario.resolutionPath === "not-found") {
      // Invariant III: not-found → DLQ publish
      expect(mockPublishToTopic).toHaveBeenCalledWith(
        expect.objectContaining({ topic: "webhook-dlq" })
      );
      expect(mockPublishJSON).not.toHaveBeenCalled();
      // status update to "dlq" — 1 update
      expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    } else {
      // connection found (cache-hit or db-hit)

      // Invariant IV: Console publish with correct shape
      expect(mockPublishJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://console.test/api/gateway/ingress",
          retries: 5,
          deduplicationId: `${scenario.provider}:del-001`,
          callback: expect.stringContaining(
            `/admin/delivery-status?provider=${scenario.provider}`
          ),
          body: expect.objectContaining({
            deliveryId: "del-001",
            connectionId: `conn-${scenario.provider}`,
            orgId: `org-${scenario.provider}`,
            provider: scenario.provider,
          }),
        })
      );
      expect(mockPublishToTopic).not.toHaveBeenCalled();

      // Invariant V: db-hit path populates Redis cache
      if (scenario.resolutionPath === "db-hit") {
        expect(mockRedisHset).toHaveBeenCalledWith(
          expect.stringContaining(`gw:resource:${scenario.provider}:`),
          expect.objectContaining({
            connectionId: `conn-${scenario.provider}`,
            orgId: `org-${scenario.provider}`,
          })
        );
      }

      // cache-hit path must NOT populate cache (no extra write)
      if (scenario.resolutionPath === "cache-hit") {
        expect(mockRedisHset).not.toHaveBeenCalled();
      }

      // 2 updates: installationId + status="enqueued"
      expect(mockDbUpdate).toHaveBeenCalledTimes(2);
    }
  });
});
