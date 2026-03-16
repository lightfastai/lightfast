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
  gatewayInstallations,
  gatewayResources,
  workspaceEntityEdges,
} from "@db/console/schema";
import type { PostTransformEvent } from "@repo/console-providers";
import type { TestDb } from "@repo/console-test-db";
import { closeTestDb, createTestDb, resetTestDb } from "@repo/console-test-db";
import { fixtures } from "@repo/console-test-db/fixtures";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

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
  neuralCapturedHandlers,
} = await vi.hoisted(async () => {
  const { makeRedisMock, makeQStashMock } = await import("./harness.js");
  const redisStore = new Map<string, unknown>();
  const messages: {
    url: string;
    body: unknown;
    headers?: Record<string, string>;
  }[] = [];
  const inngestEventsSent: { name: string; data: unknown }[] = [];
  const capturedHandlers = new Map<
    string,
    (args: { event: unknown; step: unknown }) => Promise<unknown>
  >();

  const sendMock = vi.fn(
    (
      event: { name: string; data: unknown } | { name: string; data: unknown }[]
    ) => {
      const all = Array.isArray(event) ? event : [event];
      inngestEventsSent.push(...all);
      return Promise.resolve({ ids: all.map((_, i) => `evt-${i}`) });
    }
  );

  const neuralCapturedHandlers = new Map<
    string,
    (args: { event: unknown; step: unknown }) => Promise<unknown>
  >();

  return {
    redisMock: makeRedisMock(redisStore),
    redisStore,
    qstashMessages: messages,
    qstashMock: makeQStashMock(messages),
    capturedHandlers,
    inngestSendMock: sendMock,
    inngestEventsSent,
    neuralCapturedHandlers,
  };
});

// ── vi.mock declarations ──

vi.mock("@db/console/client", () => ({
  get db() {
    return db;
  },
}));

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
        handler: (args: { event: unknown; step: unknown }) => Promise<unknown>
      ) => {
        capturedHandlers.set(config.id, handler);
        return { id: config.id };
      }
    );
  },
  EventSchemas: class {
    fromSchema() {
      return this;
    }
  },
  NonRetriableError: class extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "NonRetriableError";
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
    trigger: vi.fn().mockResolvedValue({ workflowRunId: "wf-perm-1" }),
  },
}));

vi.mock("@vendor/upstash-workflow/hono", () => ({
  serve: vi.fn(() => () => new Response("ok")),
}));

// ── Neural pipeline mocks (used by Suite 6.7) ──

vi.mock("@console/inngest-client", () => ({
  inngest: {
    createFunction: (
      config: { id: string },
      _trigger: unknown,
      handler: (args: { event: unknown; step: unknown }) => Promise<unknown>
    ) => {
      neuralCapturedHandlers.set(config.id, handler);
      return { id: config.id };
    },
    send: vi.fn(),
  },
}));

vi.mock("@repo/console-pinecone", () => ({
  consolePineconeClient: { upsertVectors: vi.fn() },
}));

vi.mock("@repo/console-embed", () => ({
  createEmbeddingProviderForWorkspace: vi.fn().mockReturnValue({
    embed: vi.fn().mockResolvedValue({
      embeddings: [new Array(1024).fill(0.1)],
      model: "test-model",
    }),
    dimension: 1024,
  }),
}));

vi.mock("@vendor/knock", () => ({ notifications: null, Knock: class {} }));

// ── Import all apps after mocks ──
import backfillApp from "@backfill/app";
import relayApp from "@relay/app";

// Force backfill workflows to register handlers
await import("@backfill/orchestrator");

import { cancelBackfillService } from "@gateway/urls";
// ── Utilities ──
import { makeStep, withEventPermutations } from "./harness";

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
    (
      event: { name: string; data: unknown } | { name: string; data: unknown }[]
    ) => {
      const all = Array.isArray(event) ? event : [event];
      inngestEventsSent.push(...all);
      return Promise.resolve({ ids: all.map((_, i) => `evt-${i}`) });
    }
  );

  redisMock.hset.mockImplementation(
    (key: string, fields: Record<string, unknown>) => {
      const existing = (redisStore.get(key) ?? {}) as Record<string, unknown>;
      redisStore.set(key, { ...existing, ...fields });
      return Promise.resolve(1);
    }
  );
  redisMock.hgetall.mockImplementation((key: string) =>
    Promise.resolve(
      (redisStore.get(key) ?? null) as Record<string, string> | null
    )
  );
  redisMock.set.mockImplementation(
    (key: string, value: unknown, opts?: { nx?: boolean; ex?: number }) => {
      if (opts?.nx && redisStore.has(key)) {
        return Promise.resolve(null);
      }
      redisStore.set(key, value);
      return Promise.resolve("OK");
    }
  );
  redisMock.del.mockImplementation((...keys: string[]) => {
    const allKeys = keys.flat();
    let count = 0;
    for (const k of allKeys) {
      if (redisStore.delete(k)) {
        count++;
      }
    }
    return Promise.resolve(count);
  });
  redisMock.get.mockImplementation((key: string) =>
    Promise.resolve(redisStore.get(key) ?? null)
  );
  redisMock.pipeline.mockImplementation(() => {
    const ops: (() => void)[] = [];
    const pipe = {
      hset: vi.fn((key: string, fields: Record<string, unknown>) => {
        ops.push(() => {
          const existing = (redisStore.get(key) ?? {}) as Record<
            string,
            unknown
          >;
          redisStore.set(key, { ...existing, ...fields });
        });
        return pipe;
      }),
      expire: vi.fn(() => pipe),
      exec: vi.fn(() => {
        ops.forEach((op) => op());
        return [];
      }),
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
        await db.insert(gatewayInstallations).values(inst);
        await db.insert(gatewayResources).values(resource);
        redisStore.set(cacheKey, {
          connectionId: inst.id,
          orgId: "org-perm-teardown",
        });
      },

      effects: [
        {
          label: "cancel-backfill",
          deliver: async () => {
            // Connections publishes cancel → deliver to backfill → Inngest run.cancelled
            await cancelBackfillService({ installationId: inst.id });
            const cancelMsg = qstashMessages.find((m) =>
              m.url.includes("/trigger/cancel")
            );
            if (cancelMsg) {
              await backfillApp.request("/trigger/cancel", {
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
            const client = (
              db as unknown as {
                $client: { exec: (sql: string) => Promise<unknown> };
              }
            ).$client;
            await client.exec(
              `UPDATE lightfast_gateway_installations SET status = 'revoked' WHERE id = '${inst.id}'`
            );
            await client.exec(
              `UPDATE lightfast_gateway_resources SET status = 'removed' WHERE installation_id = '${inst.id}'`
            );
          },
        },
      ],

      invariant: async () => {
        // Redis cache cleared
        expect(redisStore.has(cacheKey)).toBe(false);

        // DB records soft-deleted
        const instRow = await db.query.gatewayInstallations.findFirst({
          where: (t, { eq }) => eq(t.id, inst.id),
        });
        expect(instRow?.status).toBe("revoked");

        const resRow = await db.query.gatewayResources.findFirst({
          where: (t, { eq }) => eq(t.installationId, inst.id),
        });
        expect(resRow?.status).toBe("removed");

        // Backfill cancel event fired
        expect(
          inngestEventsSent.some(
            (e) => e.name === "apps-backfill/run.cancelled"
          )
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
          const res = await relayApp.request("/webhooks/github", {
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
          (m) => (m.body as { deliveryId: string }).deliveryId
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
        await db.insert(gatewayInstallations).values(inst);
      },

      effects: [
        {
          label: "notify-backfill",
          deliver: async () => {
            // Deliver backfill trigger directly (previously routed via notifyBackfillService)
            const res = await backfillApp.request("/trigger", {
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
            await relayApp.request("/webhooks/github", {
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
          inngestEventsSent.some(
            (e) => e.name === "apps-backfill/run.requested"
          )
        ).toBe(true);

        // Relay webhook was published to QStash
        const webhookEnvelopes = qstashMessages.filter(
          (m) =>
            (m.body as { deliveryId?: string }).deliveryId ===
            "del-perm-mixed-1"
        );
        expect(webhookEnvelopes).toHaveLength(1);
      },

      reset: resetStores,
    });

    expect(result.failures).toHaveLength(0);
    expect(result.permutationsRun).toBe(2); // 2! = 2
  });
});

describe("Suite 6.4 — All 4 gateway teardown steps are order-independent (24 orderings)", () => {
  it("cancel-backfill + revoke-token + cleanup-cache + soft-delete produce identical final state in all 24 orderings", async () => {
    const mockRevokeToken = vi.fn().mockResolvedValue(undefined);

    const inst = fixtures.installation({
      provider: "linear",
      orgId: "org-teardown-4step",
      status: "active",
    });
    const resource = fixtures.resource({
      installationId: inst.id,
      providerResourceId: "linear-team-001",
      status: "active",
    });
    const cacheKey = "gw:resource:linear:linear-team-001";

    const result = await withEventPermutations({
      setup: async () => {
        restoreMockImpls();
        await db.insert(gatewayInstallations).values(inst);
        await db.insert(gatewayResources).values(resource);
        redisStore.set(cacheKey, {
          connectionId: inst.id,
          orgId: "org-teardown-4step",
        });
        mockRevokeToken.mockClear();
      },

      effects: [
        {
          label: "cancel-backfill",
          deliver: async () => {
            // Simulate teardown step 1: publish cancel message to backfill service
            await qstashMock.publishJSON({
              url: "http://localhost:3024/services/backfill/trigger/cancel",
              body: { installationId: inst.id },
            });
          },
        },
        {
          label: "revoke-token",
          deliver: async () => {
            // Simulate teardown step 2: provider token revocation (best-effort, no persistent side effects)
            await mockRevokeToken(inst.id);
          },
        },
        {
          label: "cleanup-cache",
          deliver: async () => {
            // Simulate teardown step 3: delete Redis cache entries for linked resources
            redisStore.delete(cacheKey);
          },
        },
        {
          label: "soft-delete",
          deliver: async () => {
            // Simulate teardown step 4: soft-delete installation and resources in DB
            const client = (
              db as unknown as {
                $client: { exec: (sql: string) => Promise<unknown> };
              }
            ).$client;
            await client.exec(
              `UPDATE lightfast_gateway_installations SET status = 'revoked' WHERE id = '${inst.id}'`
            );
            await client.exec(
              `UPDATE lightfast_gateway_resources SET status = 'removed' WHERE installation_id = '${inst.id}'`
            );
          },
        },
      ],

      invariant: async () => {
        // Step 3 invariant: Redis cache cleared
        expect(redisStore.has(cacheKey)).toBe(false);

        // Step 4 invariant: DB records soft-deleted
        const instRow = await db.query.gatewayInstallations.findFirst({
          where: (t, { eq }) => eq(t.id, inst.id),
        });
        expect(instRow?.status).toBe("revoked");

        const resRow = await db.query.gatewayResources.findFirst({
          where: (t, { eq }) => eq(t.installationId, inst.id),
        });
        expect(resRow?.status).toBe("removed");

        // Step 1 invariant: backfill cancel dispatched to QStash
        const cancelMsg = qstashMessages.find(
          (m) => typeof m.url === "string" && m.url.includes("/trigger/cancel")
        );
        expect(cancelMsg).toBeDefined();
        expect(cancelMsg?.body).toMatchObject({ installationId: inst.id });

        // Step 2 invariant: token revocation attempted exactly once
        expect(mockRevokeToken).toHaveBeenCalledTimes(1);
      },

      reset: resetStores,
    });

    expect(result.failures).toHaveLength(0);
    expect(result.permutationsRun).toBe(24); // 4! = 24
  });
});

describe("Suite 6.6 — Post-teardown cache state is consistent in both teardown orderings", () => {
  it("after soft-delete + cache-cleanup in any order, resource cache key is absent (no stale cache)", async () => {
    const inst = fixtures.installation({
      provider: "github",
      orgId: "org-post-teardown",
      status: "active",
    });
    const resource = fixtures.resource({
      installationId: inst.id,
      providerResourceId: "owner/teardown-repo",
      status: "active",
    });
    const cacheKey = "gw:resource:github:owner/teardown-repo";

    const result = await withEventPermutations({
      setup: async () => {
        restoreMockImpls();
        await db.insert(gatewayInstallations).values(inst);
        await db.insert(gatewayResources).values(resource);
        redisStore.set(cacheKey, {
          connectionId: inst.id,
          orgId: "org-post-teardown",
        });
      },

      effects: [
        {
          label: "soft-delete",
          deliver: async () => {
            const client = (
              db as unknown as {
                $client: { exec: (sql: string) => Promise<unknown> };
              }
            ).$client;
            await client.exec(
              `UPDATE lightfast_gateway_installations SET status = 'revoked' WHERE id = '${inst.id}'`
            );
            await client.exec(
              `UPDATE lightfast_gateway_resources SET status = 'removed' WHERE installation_id = '${inst.id}'`
            );
          },
        },
        {
          label: "cache-cleanup",
          deliver: () => {
            redisStore.delete(cacheKey);
          },
        },
      ],

      invariant: async () => {
        // After teardown: Redis cache must not contain the resource key (no stale routing)
        expect(redisStore.has(cacheKey)).toBe(false);

        // After teardown: DB must show installation as revoked
        const instRow = await db.query.gatewayInstallations.findFirst({
          where: (t, { eq }) => eq(t.id, inst.id),
        });
        expect(instRow?.status).toBe("revoked");

        // After teardown: DB must show resource as removed
        const resRow = await db.query.gatewayResources.findFirst({
          where: (t, { eq }) => eq(t.installationId, inst.id),
        });
        expect(resRow?.status).toBe("removed");
      },

      reset: resetStores,
    });

    expect(result.failures).toHaveLength(0);
    expect(result.permutationsRun).toBe(2); // 2! = 2
  });
});

describe("Suite 6.5 — Relay dedup prevents double-dispatch in both orderings", () => {
  it("same deliveryId dispatches exactly once regardless of arrival order", async () => {
    const DELIVERY_ID = "del-dedup-suite65";

    async function sendWebhook() {
      await relayApp.request("/webhooks/github", {
        method: "POST",
        headers: new Headers({
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        }),
        body: JSON.stringify({
          connectionId: "conn-dedup-test",
          orgId: "org-dedup-test",
          deliveryId: DELIVERY_ID,
          eventType: "push",
          payload: { repository: { id: 99 } },
          receivedAt: Date.now(),
        }),
      });
    }

    const result = await withEventPermutations({
      setup: () => {
        restoreMockImpls();
      },

      effects: [
        { label: "webhook-first-send", deliver: sendWebhook },
        { label: "webhook-duplicate-send", deliver: sendWebhook },
      ],

      invariant: () => {
        // Exactly 1 QStash message — dedup prevented double-dispatch
        expect(qstashMessages).toHaveLength(1);
        expect(qstashMessages[0]?.body).toMatchObject({
          deliveryId: DELIVERY_ID,
        });
        // Dedup key is set in Redis
        expect(redisStore.has(`gw:webhook:seen:github:${DELIVERY_ID}`)).toBe(
          true
        );
      },

      reset: resetStores,
    });

    expect(result.failures).toHaveLength(0);
    expect(result.permutationsRun).toBe(2); // 2! = 2
  });
});

describe("Suite 6.7 — Neural entity co-occurrence edges converge under 3! orderings", () => {
  /**
   * Import neural handlers once so their createFunction registrations land in
   * neuralCapturedHandlers (via the @console/inngest-client mock).
   */
  beforeAll(async () => {
    await import("@console/neural");
  });

  it("produces identical workspaceEntityEdges count for all 6 orderings", async () => {
    // ── Fixture: 3 GitHub events where issue#50 + issue#51 co-occur via Event C
    //   Event C (PR) lists both issues as relations → edge resolver finds issue↔issue
    //   pair across co-occurring events regardless of processing order.
    const REPO_ID = 999_888_777;
    const RESOURCE_ID = String(REPO_ID);

    const events: PostTransformEvent[] = [
      {
        deliveryId: "del_perm_graph_a",
        sourceId: "github:issue:graph-issues#50:opened",
        provider: "github",
        eventType: "issues.opened",
        occurredAt: "2026-03-14T10:00:00.000Z",
        entity: {
          provider: "github",
          entityType: "issue",
          entityId: "graph-issues#50",
          title: "Issue 50",
          url: null,
          state: "open",
        },
        relations: [
          {
            provider: "github",
            entityType: "repository",
            entityId: "graph-org/graph-repo",
            title: null,
            url: null,
            relationshipType: "belongs_to",
          },
        ],
        title: "Issue 50",
        body: "",
        attributes: { repoId: REPO_ID },
      },
      {
        deliveryId: "del_perm_graph_b",
        sourceId: "github:issue:graph-issues#51:opened",
        provider: "github",
        eventType: "issues.opened",
        occurredAt: "2026-03-14T10:01:00.000Z",
        entity: {
          provider: "github",
          entityType: "issue",
          entityId: "graph-issues#51",
          title: "Issue 51",
          url: null,
          state: "open",
        },
        relations: [
          {
            provider: "github",
            entityType: "repository",
            entityId: "graph-org/graph-repo",
            title: null,
            url: null,
            relationshipType: "belongs_to",
          },
        ],
        title: "Issue 51",
        body: "",
        attributes: { repoId: REPO_ID },
      },
      {
        deliveryId: "del_perm_graph_c",
        sourceId: "github:pr:graph-pr#10:opened",
        provider: "github",
        eventType: "pull_request.opened",
        occurredAt: "2026-03-14T10:02:00.000Z",
        entity: {
          provider: "github",
          entityType: "pr",
          entityId: "graph-pr#10",
          title: "PR 10",
          url: null,
          state: "open",
        },
        relations: [
          {
            provider: "github",
            entityType: "issue",
            entityId: "graph-issues#50",
            title: null,
            url: null,
            relationshipType: "closes",
          },
          {
            provider: "github",
            entityType: "issue",
            entityId: "graph-issues#51",
            title: null,
            url: null,
            relationshipType: "closes",
          },
          {
            provider: "github",
            entityType: "repository",
            entityId: "graph-org/graph-repo",
            title: null,
            url: null,
            relationshipType: "belongs_to",
          },
        ],
        title: "PR 10",
        body: "",
        attributes: { repoId: REPO_ID },
      },
    ];

    async function seedGraphFixtures() {
      const {
        gatewayInstallations: gw,
        orgWorkspaces: ow,
        workspaceIntegrations: wi,
      } = await import("@db/console/schema");
      await db.insert(gw).values({
        id: "inst_graph001",
        provider: "github",
        externalId: "gh_install_graph",
        connectedBy: "user_graph001",
        orgId: "org_graph001",
        status: "active",
      });
      await db.insert(ow).values({
        id: "ws_graph001",
        clerkOrgId: "org_graph001",
        name: "graph-workspace",
        slug: "graph-ws",
        settings: {
          version: 1,
          embedding: {
            indexName: "lightfast-v1",
            namespaceName: "org_graph001:ws_ws_graph001",
            embeddingDim: 1024,
            embeddingModel: "embed-english-v3.0",
            embeddingProvider: "cohere",
            pineconeMetric: "cosine",
            pineconeCloud: "aws",
            pineconeRegion: "us-east-1",
            chunkMaxTokens: 512,
            chunkOverlap: 50,
          },
        },
      });
      await db.insert(wi).values({
        workspaceId: "ws_graph001",
        installationId: "inst_graph001",
        provider: "github",
        providerResourceId: RESOURCE_ID,
        providerConfig: {
          provider: "github",
          type: "repository",
          sync: { autoSync: true },
        },
      });
    }

    const eventStoreHandler = neuralCapturedHandlers.get(
      "apps-console/event.store"
    );
    const entityGraphHandler = neuralCapturedHandlers.get(
      "apps-console/entity.graph"
    );
    expect(eventStoreHandler).toBeDefined();
    expect(entityGraphHandler).toBeDefined();

    interface StepSendEventData {
      data: Record<string, unknown>;
      name: string;
    }
    let expectedEdgeCount: number | null = null;

    const result = await withEventPermutations({
      effects: events.map((evt) => ({
        label: evt.sourceId,
        deliver: async () => {
          const step = makeStep();
          const esResult = (await eventStoreHandler!({
            event: {
              id: `test-run-${Date.now()}`,
              data: {
                workspaceId: "ws_graph001",
                clerkOrgId: "org_graph001",
                sourceEvent: evt,
              },
            },
            step,
          })) as { status: string } | undefined;

          if (esResult?.status !== "stored") {
            return;
          }

          const sendCalls = step.sendEvent.mock.calls as [
            string,
            StepSendEventData,
          ][];
          const upsertedCall = sendCalls.find(
            ([, e]) => e.name === "apps-console/entity.upserted"
          );
          if (!upsertedCall) {
            return;
          }

          const graphStep = makeStep();
          await entityGraphHandler!({
            event: { data: upsertedCall[1].data },
            step: graphStep,
          });
        },
      })),

      setup: async () => {
        vi.clearAllMocks();
        restoreMockImpls();
        await seedGraphFixtures();
      },

      reset: async () => {
        await resetStores();
      },

      invariant: async () => {
        const edges = await db.select().from(workspaceEntityEdges);
        if (expectedEdgeCount === null) {
          // First permutation: capture the count and assert edges were created.
          expectedEdgeCount = edges.length;
          expect(edges.length).toBeGreaterThan(0);
        } else {
          // Subsequent permutations: assert convergence (same count for every ordering).
          expect(edges.length).toBe(expectedEdgeCount);
        }
      },
    });

    expect(result.failures).toHaveLength(0);
    expect(result.permutationsRun).toBe(6); // 3! = 6
  });
});
