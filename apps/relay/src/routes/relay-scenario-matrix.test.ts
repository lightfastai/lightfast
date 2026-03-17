/**
 * Relay Workflow Invariant Matrix Testing
 *
 * Defines scenario dimensions as typed arrays, computes their cartesian
 * product, and runs every combination against universal invariants.
 * Catches edge cases that hand-crafted tests miss.
 *
 * Scenarios: 16 (4 × 2 × 2)
 * - provider: github | linear | sentry | vercel
 * - resolutionPath: db-hit | not-found
 * - qstashResult: success | failure
 *
 * Invariants per scenario (4 total):
 *   I.   new-delivery → exactly 1 DB insert (persist-delivery)
 *   II.  not-found → DLQ publish, status="dlq"
 *   III. found && success → Console publish with correct shape
 *   IV.  found && failure → error propagates
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Types ──

interface RelayScenario {
  provider: string;
  qstashResult: "success" | "failure";
  resolutionPath: "db-hit" | "not-found";
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
  return `provider=${s.provider} path=${s.resolutionPath} qstash=${s.qstashResult}`;
}

// ── Mock declarations ──

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
  // Resolution path — direct DB query
  if (s.resolutionPath === "db-hit") {
    mockDbRows = [
      {
        installationId: `conn-${s.provider}`,
        orgId: `org-${s.provider}`,
      },
    ];
  } else {
    // not-found
    mockDbRows = [];
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

// ── Scenario dimensions ──

const dims = {
  provider: ["github", "linear", "sentry", "vercel"] as const,
  resolutionPath: ["db-hit", "not-found"] as const,
  qstashResult: ["success", "failure"] as const,
};

// 4 × 2 × 2 = 16 scenarios
const scenarios = cartesian(dims) as RelayScenario[];

// ── Matrix tests ──

describe("relay workflow invariant matrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbRows = [];
  });

  it.each(
    scenarios.map((s) => [scenarioLabel(s), s] as const)
  )("%s", async (_label, scenario) => {
    configureMocks(scenario);
    const payload = makePayload(scenario.provider);
    const ctx = makeContext(payload);

    // ── Execute ──

    if (scenario.qstashResult === "failure") {
      await expect(capturedHandler(ctx)).rejects.toThrow();
      return; // Invariant IV: error propagates — no further checks needed
    }

    await capturedHandler(ctx);

    // ── Invariants ──

    // Invariant I: always 1 DB insert
    expect(mockDbInsert).toHaveBeenCalledTimes(1);

    if (scenario.resolutionPath === "not-found") {
      // Invariant II: not-found → DLQ publish
      expect(mockPublishToTopic).toHaveBeenCalledWith(
        expect.objectContaining({ topic: "webhook-dlq" })
      );
      expect(mockPublishJSON).not.toHaveBeenCalled();
      // status update to "dlq" — 1 update
      expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    } else {
      // connection found (db-hit)

      // Invariant III: Console publish with correct shape
      expect(mockPublishJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://console.test/api/gateway/ingress",
          retries: 5,
          deduplicationId: `${scenario.provider}_del-001`,
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

      // 2 updates: installationId + status="enqueued"
      expect(mockDbUpdate).toHaveBeenCalledTimes(2);
    }
  });
});
