/**
 * Lineage Integrity Tests
 *
 * Verifies that the delivery chain from relay webhook → DB persistence → QStash
 * maintains traceable, consistent identifiers. Documents current limitations
 * and asserts invariants that must hold even with the current implementation.
 *
 * Uses the same mock infrastructure as backfill-relay-dispatch.integration.test.ts:
 * - In-memory Redis for dedup tracking
 * - Mocked DB (dbOps array) for insert tracking
 * - QStash capture mock for publish assertions
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Create all mock state in vi.hoisted ──
const { redisMock, redisStore, qstashMessages, qstashMock, dbOps } =
  await vi.hoisted(async () => {
    const { makeRedisMock, makeQStashMock } = await import("./harness.js");
    const redisStore = new Map<string, unknown>();
    const messages: {
      url: string;
      body: unknown;
      headers?: Record<string, string>;
    }[] = [];
    return {
      redisMock: makeRedisMock(redisStore),
      redisStore,
      qstashMessages: messages,
      qstashMock: makeQStashMock(messages),
      dbOps: [] as {
        op: "insert" | "update";
        table?: unknown;
        values?: unknown;
        set?: unknown;
      }[],
    };
  });

// ── vi.mock declarations ──

vi.mock("@vendor/upstash", () => ({
  redis: redisMock,
}));

vi.mock("@vendor/qstash", () => ({
  getQStashClient: () => qstashMock,
  Receiver: class {
    verify() {
      return Promise.resolve(true);
    }
  },
}));

vi.mock("@vercel/related-projects", () => ({
  withRelatedProject: ({
    defaultHost,
  }: {
    projectName: string;
    defaultHost: string;
  }) => defaultHost,
}));

vi.mock("@vendor/upstash-workflow/client", () => ({
  workflowClient: {
    trigger: vi.fn().mockResolvedValue({ workflowRunId: "wf-lineage" }),
  },
}));

vi.mock("@vendor/upstash-workflow/hono", () => ({
  serve: vi.fn(() => () => new Response("ok")),
}));

vi.mock("@db/console/client", () => ({
  db: {
    insert: (...args: unknown[]) => {
      const idx = dbOps.length;
      dbOps.push({ op: "insert" as const, table: args[0] });
      return {
        values: (...valArgs: unknown[]) => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          dbOps[idx]!.values = valArgs[0];
          return { onConflictDoNothing: () => Promise.resolve() };
        },
      };
    },
    update: (...args: unknown[]) => {
      const idx = dbOps.length;
      dbOps.push({ op: "update" as const, table: args[0] });
      return {
        set: (...setArgs: unknown[]) => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          dbOps[idx]!.set = setArgs[0];
          return { where: () => Promise.resolve() };
        },
      };
    },
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({ limit: () => [] }),
        }),
      }),
    }),
  },
}));

vi.mock("@db/console/schema", () => ({
  gatewayWebhookDeliveries: {},
  gatewayInstallations: {},
  gatewayResources: {},
}));

// ── Import relay app ──
import relayApp from "@relay/app";

const API_KEY = "0".repeat(64);

// ── Helpers ──

function resetStores() {
  redisStore.clear();
  qstashMessages.length = 0;
  dbOps.length = 0;
}

async function sendWebhook(
  deliveryId: string,
  options?: { holdForReplay?: boolean }
) {
  return relayApp.request("/webhooks/github", {
    method: "POST",
    headers: new Headers({
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
      ...(options?.holdForReplay ? { "X-Backfill-Hold": "true" } : {}),
    }),
    body: JSON.stringify({
      connectionId: "conn-lineage-001",
      orgId: "org-lineage-001",
      deliveryId,
      eventType: "push",
      payload: { repository: { id: 42 } },
      receivedAt: 1_700_000_000,
    }),
  });
}

// ── Tests ──

describe("deliveryId provenance — within a single backfill run", () => {
  beforeEach(() => {
    resetStores();
  });

  it("deliveryId in DB insert matches the deliveryId in QStash publish body", async () => {
    const DELIVERY_ID = "provider-native-id-abc123";

    const res = await sendWebhook(DELIVERY_ID);
    expect(res.status).toBe(200);

    // Assert DB insert recorded the correct deliveryId
    const insertOp = dbOps.find((op) => op.op === "insert");
    expect(insertOp).toBeDefined();
    expect(insertOp?.values).toMatchObject({ deliveryId: DELIVERY_ID });

    // Assert QStash publish body contains matching deliveryId
    expect(qstashMessages).toHaveLength(1);
    expect(qstashMessages[0]?.body).toMatchObject({ deliveryId: DELIVERY_ID });
  });

  it("deliveryId chain is consistent: DB insert → QStash body both use the same identifier", async () => {
    const DELIVERY_ID = "chain-consistency-xyz789";

    await sendWebhook(DELIVERY_ID);

    const insertOp = dbOps.find((op) => op.op === "insert");
    const dbDeliveryId = (insertOp?.values as { deliveryId?: string })
      ?.deliveryId;
    const qstashDeliveryId = (
      qstashMessages[0]?.body as { deliveryId?: string }
    )?.deliveryId;

    // Both sides of the delivery chain must use the same identifier
    expect(dbDeliveryId).toBe(DELIVERY_ID);
    expect(qstashDeliveryId).toBe(DELIVERY_ID);
    expect(dbDeliveryId).toBe(qstashDeliveryId);
  });

  it("two dispatches with the same deliveryId produce exactly 1 DB insert (dedup at Redis layer)", async () => {
    const DELIVERY_ID = "idempotent-delivery-xyz";

    // First dispatch
    const res1 = await sendWebhook(DELIVERY_ID);
    expect(res1.status).toBe(200);
    const body1 = (await res1.json()) as { status: string };
    expect(body1.status).toBe("accepted");

    // Second dispatch — same deliveryId
    const res2 = await sendWebhook(DELIVERY_ID);
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as { status: string };
    expect(body2.status).toBe("duplicate"); // Redis dedup caught it

    // Only 1 DB insert — the Redis NX check prevented the second one
    const insertOps = dbOps.filter((op) => op.op === "insert");
    expect(insertOps).toHaveLength(1);

    // Only 1 QStash message — duplicate bypassed QStash publish entirely
    expect(qstashMessages).toHaveLength(1);
  });

  it("provider-native deliveryId is preserved verbatim through the relay pipeline", async () => {
    // Provider-specific IDs may contain colons, slashes, hyphens, etc.
    const DELIVERY_IDs = [
      "github:push:abc123",
      "org/repo:push:def456",
      "evt_01234567890abcdefg",
    ];

    for (const DELIVERY_ID of DELIVERY_IDs) {
      resetStores();

      await sendWebhook(DELIVERY_ID);

      const insertOp = dbOps.find((op) => op.op === "insert");
      expect(insertOp?.values).toMatchObject({ deliveryId: DELIVERY_ID });
      expect(qstashMessages[0]?.body).toMatchObject({
        deliveryId: DELIVERY_ID,
      });
    }
  });

  it("DOCUMENTS LIMITATION: entity-worker uses Date.now() for receivedAt, not provider event timestamp", () => {
    // entity-worker.ts: receivedAt: Date.now()
    // This means two concurrent backfill runs for the same provider event will:
    // 1. Have different receivedAt values (non-deterministic, based on wall clock)
    // 2. Use provider-defined deliveryId (from webhookEvent.deliveryId) — which IS stable
    // 3. Therefore, relay dedup WILL catch duplicates because deliveryId is stable
    //
    // The limitation is only that receivedAt doesn't reflect the original event timestamp.
    // This is ACCEPTABLE for the current use case (historical data doesn't need original timestamps).
    //
    // The relay's service-auth path (`webhooks.ts`) receives `receivedAt` from the caller
    // (entity-worker sets it to `Date.now()` at dispatch time).
    //
    // This test explicitly documents this design decision.
    expect(true).toBe(true); // always passes — documentation only
  });
});
