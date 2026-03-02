/**
 * Suite 6: Event-Ordering Permutation Tests
 *
 * Verifies that concurrent side-effects produce identical final state
 * regardless of delivery order.  Inspired by FoundationDB / TigerBeetle
 * deterministic simulation testing, applied at the service-mesh layer.
 *
 * Each test defines N concurrent effects, then withEventPermutations() runs
 * all N! orderings (or a random sample for large N) and checks an invariant
 * after each permutation.
 *
 * Infrastructure: PGlite, in-memory Redis, QStash capture, Inngest capture,
 * service router (all three apps).
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest";
import {
  createTestDb,
  resetTestDb,
  closeTestDb,
} from "@repo/console-test-db";
import type { TestDb } from "@repo/console-test-db";
import { fixtures } from "@repo/console-test-db/fixtures";
import { gwInstallations, gwResources } from "@db/console/schema";

// ── Shared state ──
let db: TestDb;

// ── Create all mock state in vi.hoisted ──
const {
  redisMock,
  redisStore,
  qstashMessages,
  qstashMock,
  capturedHandlers,
  inngestSendMock,
  inngestEventsSent,
} = await vi.hoisted(async () => {
  const { makeRedisMock, makeQStashMock } = await import("./harness.js");
  const redisStore = new Map<string, unknown>();
  const messages: { url: string; body: unknown; headers?: Record<string, string> }[] = [];
  const inngestEventsSent: { name: string; data: unknown }[] = [];
  const capturedHandlers = new Map<
    string,
    (args: { event: unknown; step: unknown }) => Promise<unknown>
  >();

  const sendMock = vi.fn(
    (event: { name: string; data: unknown } | { name: string; data: unknown }[]) => {
      const all = Array.isArray(event) ? event : [event];
      inngestEventsSent.push(...all);
      return Promise.resolve({ ids: all.map((_, i) => `evt-${i}`) });
    },
  );

  return {
    redisMock: makeRedisMock(redisStore),
    redisStore,
    qstashMessages: messages,
    qstashMock: makeQStashMock(messages),
    capturedHandlers,
    inngestSendMock: sendMock,
    inngestEventsSent,
  };
});

// ── vi.mock declarations ──

vi.mock("@db/console/client", () => ({
  get db() { return db; },
}));

vi.mock("@vendor/upstash", () => ({
  redis: redisMock,
}));

vi.mock("@vendor/qstash", () => ({
  getQStashClient: () => qstashMock,
  Receiver: class { verify() { return Promise.resolve(true); } },
}));

vi.mock("@vendor/inngest/hono", () => ({
  serve: vi.fn(() => () => new Response("ok")),
}));

vi.mock("@vendor/inngest", () => ({
  Inngest: class {
    send = inngestSendMock;
    createFunction = vi.fn(
      (
        config: { id: string },
        _trigger: unknown,
        handler: (args: { event: unknown; step: unknown }) => Promise<unknown>,
      ) => {
        capturedHandlers.set(config.id, handler);
        return { id: config.id };
      },
    );
  },
  EventSchemas: class {
    fromSchema() { return this; }
  },
  NonRetriableError: class extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "NonRetriableError";
    }
  },
}));

vi.mock("@vendor/related-projects", () => ({
  withRelatedProject: ({ defaultHost }: { projectName: string; defaultHost: string }) =>
    defaultHost,
}));

vi.mock("@vercel/related-projects", () => ({
  withRelatedProject: ({ defaultHost }: { projectName: string; defaultHost: string }) =>
    defaultHost,
}));

vi.mock("@vendor/upstash-workflow/client", () => ({
  getWorkflowClient: () => ({
    trigger: vi.fn().mockResolvedValue({ workflowRunId: "wf-perm-1" }),
  }),
}));

vi.mock("@vendor/upstash-workflow/hono", () => ({
  serve: vi.fn(() => () => new Response("ok")),
}));

// ── Import all apps after mocks ──
import backfillApp from "@backfill/app";
import relayApp from "@relay/app";

// Force backfill workflows to register handlers
await import("@backfill/orchestrator");

// ── Utilities ──
import { withEventPermutations } from "./harness.js";
import { cancelBackfillService } from "@connections/urls";

const API_KEY = "0".repeat(64);

// ── Helpers ──

/** Reset all data stores between permutations (preserves mock implementations) */
async function resetStores() {
  await resetTestDb();
  redisStore.clear();
  qstashMessages.length = 0;
  inngestEventsSent.length = 0;
}

/** Restore mock implementations that vi.clearAllMocks() resets */
function restoreMockImpls() {
  inngestSendMock.mockImplementation(
    (event: { name: string; data: unknown } | { name: string; data: unknown }[]) => {
      const all = Array.isArray(event) ? event : [event];
      inngestEventsSent.push(...all);
      return Promise.resolve({ ids: all.map((_, i) => `evt-${i}`) });
    },
  );

  redisMock.hset.mockImplementation((key: string, fields: Record<string, unknown>) => {
    const existing = (redisStore.get(key) ?? {}) as Record<string, unknown>;
    redisStore.set(key, { ...existing, ...fields });
    return Promise.resolve(1);
  });
  redisMock.hgetall.mockImplementation((key: string) =>
    Promise.resolve((redisStore.get(key) ?? null) as Record<string, string> | null),
  );
  redisMock.set.mockImplementation((key: string, value: unknown, opts?: { nx?: boolean; ex?: number }) => {
    if (opts?.nx && redisStore.has(key)) return Promise.resolve(null);
    redisStore.set(key, value);
    return Promise.resolve("OK");
  });
  redisMock.del.mockImplementation((...keys: string[]) => {
    const allKeys = keys.flat();
    let count = 0;
    for (const k of allKeys) { if (redisStore.delete(k)) count++; }
    return Promise.resolve(count);
  });
  redisMock.get.mockImplementation((key: string) =>
    Promise.resolve(redisStore.get(key) ?? null),
  );
  redisMock.pipeline.mockImplementation(() => {
    const ops: (() => void)[] = [];
    const pipe = {
      hset: vi.fn((key: string, fields: Record<string, unknown>) => {
        ops.push(() => {
          const existing = (redisStore.get(key) ?? {}) as Record<string, unknown>;
          redisStore.set(key, { ...existing, ...fields });
        });
        return pipe;
      }),
      expire: vi.fn(() => pipe),
      exec: vi.fn(() => { ops.forEach((op) => op()); return []; }),
    };
    return pipe;
  });
}

// ── Lifecycle ──

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(() => {
  vi.clearAllMocks();
  qstashMessages.length = 0;
  inngestEventsSent.length = 0;
  redisStore.clear();
  restoreMockImpls();
});

afterEach(async () => {
  await resetTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

// ── Tests ──

describe("Suite 6.1 — Teardown effects are order-independent", () => {
  it("cancel-backfill + clear-cache + soft-delete produce same final state in all 6 orderings", async () => {
    // Fixed fixtures reused across all 6 permutations
    const inst = fixtures.installation({
      provider: "github",
      orgId: "org-perm-teardown",
      status: "active",
    });
    const resource = fixtures.resource({
      installationId: inst.id,
      providerResourceId: "owner/perm-repo",
      status: "active",
    });
    const cacheKey = "gw:resource:github:owner/perm-repo";

    const result = await withEventPermutations({
      setup: async () => {
        restoreMockImpls();
        await db.insert(gwInstallations).values(inst);
        await db.insert(gwResources).values(resource);
        redisStore.set(cacheKey, { connectionId: inst.id, orgId: "org-perm-teardown" });
      },

      effects: [
        {
          label: "cancel-backfill",
          deliver: async () => {
            // Connections publishes cancel → deliver to backfill → Inngest run.cancelled
            await cancelBackfillService({ installationId: inst.id });
            const cancelMsg = qstashMessages.find((m) => m.url.includes("/trigger/cancel"));
            if (cancelMsg) {
              await backfillApp.request("/api/trigger/cancel", {
                method: "POST",
                headers: new Headers({
                  "Content-Type": "application/json",
                  ...(cancelMsg.headers ?? {}),
                }),
                body: JSON.stringify(cancelMsg.body),
              });
            }
          },
        },
        {
          label: "clear-redis-cache",
          deliver: () => {
            redisStore.delete(cacheKey);
          },
        },
        {
          label: "soft-delete-db",
          deliver: async () => {
            // Use PGlite raw query — avoids drizzle-orm direct import
            const client = (db as unknown as { $client: { exec: (sql: string) => Promise<unknown> } }).$client;
            await client.exec(
              `UPDATE lightfast_gw_installations SET status = 'revoked' WHERE id = '${inst.id}'`,
            );
            await client.exec(
              `UPDATE lightfast_gw_resources SET status = 'removed' WHERE installation_id = '${inst.id}'`,
            );
          },
        },
      ],

      invariant: async () => {
        // Redis cache cleared
        expect(redisStore.has(cacheKey)).toBe(false);

        // DB records soft-deleted
        const instRow = await db.query.gwInstallations.findFirst({
          where: (t, { eq }) => eq(t.id, inst.id),
        });
        expect(instRow?.status).toBe("revoked");

        const resRow = await db.query.gwResources.findFirst({
          where: (t, { eq }) => eq(t.installationId, inst.id),
        });
        expect(resRow?.status).toBe("removed");

        // Backfill cancel event fired
        expect(
          inngestEventsSent.some((e) => e.name === "apps-backfill/run.cancelled"),
        ).toBe(true);
      },

      reset: resetStores,
    });

    expect(result.failures).toHaveLength(0);
    expect(result.permutationsRun).toBe(6); // 3! = 6
  });
});

describe("Suite 6.2 — Concurrent relay dispatches are order-independent", () => {
  it("3 webhooks with different deliveryIds all accepted in every ordering", async () => {
    const deliveryIds = ["del-perm-a", "del-perm-b", "del-perm-c"];

    const result = await withEventPermutations({
      setup: () => {
        restoreMockImpls();
      },

      effects: deliveryIds.map((deliveryId) => ({
        label: `webhook-${deliveryId}`,
        deliver: async () => {
          const res = await relayApp.request("/api/webhooks/github", {
            method: "POST",
            headers: new Headers({
              "Content-Type": "application/json",
              "X-API-Key": API_KEY,
            }),
            body: JSON.stringify({
              connectionId: "conn-perm-dispatch",
              orgId: "org-perm-dispatch",
              deliveryId,
              eventType: "push",
              payload: { repository: { id: 42 } },
              receivedAt: Date.now(),
            }),
          });
          expect(res.status).toBe(200);
          const json = (await res.json()) as { status: string };
          expect(json.status).toBe("accepted");
        },
      })),

      invariant: () => {
        // All 3 published to QStash
        expect(qstashMessages).toHaveLength(3);

        // All 3 have distinct delivery IDs
        const ids = qstashMessages.map(
          (m) => (m.body as { deliveryId: string }).deliveryId,
        );
        expect(new Set(ids).size).toBe(3);
        for (const id of deliveryIds) {
          expect(ids).toContain(id);
        }

        // All 3 dedup keys written to Redis
        for (const id of deliveryIds) {
          expect(redisStore.has(`gw:webhook:seen:github:${id}`)).toBe(true);
        }
      },

      reset: resetStores,
    });

    expect(result.failures).toHaveLength(0);
    expect(result.permutationsRun).toBe(6); // 3! = 6
  });
});

describe("Suite 6.3 — Backfill notify + relay dispatch are order-independent", () => {
  it("notify-backfill and webhook-dispatch produce same side-effects regardless of order", async () => {
    const inst = fixtures.installation({
      provider: "github",
      orgId: "org-perm-mixed",
      status: "active",
    });

    const result = await withEventPermutations({
      setup: async () => {
        restoreMockImpls();
        await db.insert(gwInstallations).values(inst);
      },

      effects: [
        {
          label: "notify-backfill",
          deliver: async () => {
            // Deliver backfill trigger directly (previously routed via notifyBackfillService)
            const res = await backfillApp.request("/api/trigger", {
              method: "POST",
              headers: new Headers({
                "Content-Type": "application/json",
                "X-API-Key": API_KEY,
              }),
              body: JSON.stringify({
                installationId: inst.id,
                provider: "github",
                orgId: "org-perm-mixed",
              }),
            });
            expect(res.status).toBe(200);
          },
        },
        {
          label: "relay-webhook-dispatch",
          deliver: async () => {
            await relayApp.request("/api/webhooks/github", {
              method: "POST",
              headers: new Headers({
                "Content-Type": "application/json",
                "X-API-Key": API_KEY,
              }),
              body: JSON.stringify({
                connectionId: inst.id,
                orgId: "org-perm-mixed",
                deliveryId: "del-perm-mixed-1",
                eventType: "push",
                payload: { repository: { id: 777 } },
                receivedAt: Date.now(),
              }),
            });
          },
        },
      ],

      invariant: () => {
        // Backfill was notified (Inngest run.requested fired)
        expect(
          inngestEventsSent.some((e) => e.name === "apps-backfill/run.requested"),
        ).toBe(true);

        // Relay webhook was published to QStash
        const webhookEnvelopes = qstashMessages.filter(
          (m) => (m.body as { deliveryId?: string }).deliveryId === "del-perm-mixed-1",
        );
        expect(webhookEnvelopes).toHaveLength(1);
      },

      reset: resetStores,
    });

    expect(result.failures).toHaveLength(0);
    expect(result.permutationsRun).toBe(2); // 2! = 2
  });
});
