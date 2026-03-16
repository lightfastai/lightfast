/**
 * Suite 6.6 — Post-Teardown Webhook Routing Invariant
 *
 * After teardown (soft-delete + cache-cleanup in any order), webhooks for the
 * revoked connection must route to DLQ, never to Console ingress.
 *
 * Tests 2 orderings of the two teardown effects:
 *   [soft-delete → cache-cleanup]
 *   [cache-cleanup → soft-delete]
 *
 * "soft-delete"   = DB lookup returns no active connection (installation revoked)
 * "cache-cleanup" = Redis cache miss for the resource key
 *
 * The workflow checks cache first, then DB fallback. After both are cleared in
 * any order, the connection is unresolvable → DLQ routing is mandatory.
 */

import type { WebhookReceiptPayload } from "@repo/console-providers";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Capture workflow handler from serve() ──
let capturedHandler: (context: unknown) => Promise<void>;

vi.mock("@vendor/upstash-workflow/hono", () => ({
  serve: (handler: (ctx: unknown) => Promise<void>) => {
    capturedHandler = handler;
    return () => new Response("ok");
  },
}));

// ── Redis mock ──
const mockRedisSet = vi.fn();
const mockRedisHgetall = vi.fn();

vi.mock("@vendor/upstash", () => ({
  redis: {
    set: (...args: unknown[]) => mockRedisSet(...args),
    hgetall: (...args: unknown[]) => mockRedisHgetall(...args),
    hset: vi.fn(),
    pipeline: () => {
      const pipe = {
        hset: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      return pipe;
    },
  },
}));

// ── QStash mock ──
const mockPublishJSON = vi.fn().mockResolvedValue({ messageId: "msg-1" });
const mockPublishToTopic = vi.fn().mockResolvedValue([{ messageId: "dlq-1" }]);

vi.mock("@vendor/qstash", () => ({
  getQStashClient: () => ({
    publishJSON: mockPublishJSON,
    publishToTopic: mockPublishToTopic,
  }),
}));

// ── DB mock ──
const mockOnConflictDoNothing = vi.fn().mockResolvedValue(undefined);
const mockDbWhere = vi.fn().mockResolvedValue(undefined);
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
    insert: () => ({
      values: () => ({ onConflictDoNothing: mockOnConflictDoNothing }),
    }),
    update: () => ({
      set: () => ({ where: mockDbWhere }),
    }),
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

// Force module load to capture the workflow handler via serve()
await import("./workflows.js");

// ── Helpers ──

function makePayload(deliveryId: string): WebhookReceiptPayload {
  return {
    provider: "github",
    deliveryId,
    eventType: "push",
    resourceId: "res-teardown-001",
    payload: { repository: { id: 99 } },
    receivedAt: Date.now(),
  };
}

function makeContext(payload: WebhookReceiptPayload) {
  return {
    requestPayload: payload,
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
  };
}

// ── Tests ──

describe("Suite 6.6 — Post-teardown webhook routes to DLQ in all orderings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbRows = [];
    mockOnConflictDoNothing.mockResolvedValue(undefined);
    mockDbWhere.mockResolvedValue(undefined);
    mockPublishJSON.mockResolvedValue({ messageId: "msg-1" });
    mockPublishToTopic.mockResolvedValue([{ messageId: "dlq-1" }]);
  });

  it("after soft-delete + cache-cleanup in any order, webhook for revoked connection goes to DLQ (not Console)", async () => {
    // Two teardown effects — applied in 2 orderings
    const softDelete = () => {
      // Simulates DB soft-delete: connection lookup returns nothing
      mockDbRows = [];
    };
    const cacheCleanup = () => {
      // Simulates Redis cache-cleanup: cache lookup returns nothing
      mockRedisHgetall.mockResolvedValue(null);
    };

    const orderings = [
      {
        label: "[soft-delete → cache-cleanup]",
        effects: [softDelete, cacheCleanup],
      },
      {
        label: "[cache-cleanup → soft-delete]",
        effects: [cacheCleanup, softDelete],
      },
    ];

    for (const { label, effects } of orderings) {
      // Reset: restore "active" state before each permutation
      mockDbRows = [
        { installationId: "inst-post-teardown", orgId: "org-post-teardown" },
      ];
      mockRedisSet.mockResolvedValue("OK"); // unique deliveryId each time
      mockRedisHgetall.mockResolvedValue({
        connectionId: "inst-post-teardown",
        orgId: "org-post-teardown",
      });
      mockPublishJSON.mockClear();
      mockPublishToTopic.mockClear();
      mockOnConflictDoNothing.mockResolvedValue(undefined);
      mockDbWhere.mockResolvedValue(undefined);

      // Apply teardown effects in this ordering
      for (const effect of effects) {
        effect();
      }

      // Invariant: send a webhook for the revoked connection
      const payload = makePayload(`post-teardown-${label.replace(/\W/g, "-")}`);
      await capturedHandler(makeContext(payload));

      // Must route to DLQ (no-connection path), NOT to Console ingress
      expect(
        mockPublishToTopic,
        `${label}: expected DLQ routing`
      ).toHaveBeenCalledOnce();
      expect(
        mockPublishJSON,
        `${label}: must not publish to Console ingress after teardown`
      ).not.toHaveBeenCalled();
    }
  });

  it("before teardown: active connection routes to Console ingress (baseline)", async () => {
    // Active connection in both Redis cache AND DB fallback
    mockDbRows = [{ installationId: "inst-active", orgId: "org-active" }];
    mockRedisSet.mockResolvedValue("OK");
    mockRedisHgetall.mockResolvedValue({
      connectionId: "inst-active",
      orgId: "org-active",
    });

    const payload = makePayload("pre-teardown-baseline");
    await capturedHandler(makeContext(payload));

    expect(mockPublishJSON).toHaveBeenCalledOnce();
    expect(mockPublishToTopic).not.toHaveBeenCalled();
  });

  it("partial teardown (only cache-cleanup, DB still active): DB fallback prevents DLQ routing", async () => {
    // Cache is cleared but DB still has an active connection.
    // The workflow must fall back to DB and find the connection — no DLQ.
    mockDbRows = [{ installationId: "inst-partial", orgId: "org-partial" }];
    mockRedisSet.mockResolvedValue("OK");
    // Cache miss — simulates cache-cleanup done but soft-delete not yet applied
    mockRedisHgetall.mockResolvedValue(null);

    const payload = makePayload("partial-teardown-cache-only");
    await capturedHandler(makeContext(payload));

    // DB fallback resolved — must still route to Console, not DLQ
    expect(mockPublishJSON).toHaveBeenCalledOnce();
    expect(mockPublishToTopic).not.toHaveBeenCalled();
  });
});
