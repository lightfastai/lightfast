/**
 * Suite 5: Full Stack Connection Lifecycle
 *
 * End-to-end integration tests that wire all three services together:
 *   - Connections writes cache → Gateway reads it
 *   - Connections notifies Backfill via QStash
 *   - Backfill fetches from Connections HTTP API
 *   - Backfill dispatches events to Gateway
 *
 * Uses the service mesh fetch router to route all inter-service HTTP calls
 * to in-process Hono apps, and captures Inngest/QStash side effects.
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
import { gwInstallations, gwResources, gwTokens } from "@db/console/schema";

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
  const messages: Array<{ url: string; body: unknown; headers?: Record<string, string> }> = [];
  const inngestEventsSent: Array<{ name: string; data: unknown }> = [];
  const capturedHandlers = new Map<
    string,
    (args: { event: unknown; step: unknown }) => Promise<unknown>
  >();

  const sendMock = vi.fn(
    (event: { name: string; data: unknown } | Array<{ name: string; data: unknown }>) => {
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
    constructor() {}
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
    trigger: vi.fn().mockResolvedValue({ workflowRunId: "wf-lifecycle-1" }),
  }),
}));

vi.mock("@vendor/upstash-workflow/hono", () => ({
  serve: vi.fn(() => () => new Response("ok")),
}));

// ── Import all apps after mocks ──
import connectionsApp from "@connections/app";
import backfillApp from "@backfill/app";
import gatewayApp from "@gateway/app";

// Force backfill workflows to load and register handlers
await import("@backfill/orchestrator");

// ── Utilities ──
import { installServiceRouter, makeStep } from "./harness.js";
import { notifyBackfillService, cancelBackfillService } from "@connections/urls";

// ── Lifecycle ──

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(() => {
  vi.clearAllMocks();
  qstashMessages.length = 0;
  inngestEventsSent.length = 0;
  redisStore.clear();

  // Restore Inngest send implementation
  inngestSendMock.mockImplementation(
    (event: { name: string; data: unknown } | Array<{ name: string; data: unknown }>) => {
      const all = Array.isArray(event) ? event : [event];
      inngestEventsSent.push(...all);
      return Promise.resolve({ ids: all.map((_, i) => `evt-${i}`) });
    },
  );

  redisMock.hset.mockImplementation((key: string, fields: Record<string, unknown>) => {
    const existing = (redisStore.get(key) as Record<string, unknown>) ?? {};
    redisStore.set(key, { ...existing, ...fields });
    return Promise.resolve(1);
  });
  redisMock.hgetall.mockImplementation((key: string) =>
    Promise.resolve(redisStore.get(key) ?? null),
  );
  redisMock.set.mockImplementation((key: string, value: unknown, opts?: { nx?: boolean; ex?: number }) => {
    if (opts?.nx && redisStore.has(key)) return Promise.resolve(null);
    redisStore.set(key, value);
    return Promise.resolve("OK");
  });
  redisMock.del.mockImplementation((...keys: string[]) => {
    const allKeys = keys.flat() as string[];
    let count = 0;
    for (const k of allKeys) { if (redisStore.delete(k)) count++; }
    return Promise.resolve(count);
  });
  redisMock.get.mockImplementation((key: string) =>
    Promise.resolve(redisStore.get(key) ?? null),
  );
  redisMock.pipeline.mockImplementation(() => {
    const ops: Array<() => void> = [];
    const pipe = {
      hset: vi.fn((key: string, fields: Record<string, unknown>) => {
        ops.push(() => {
          const existing = (redisStore.get(key) as Record<string, unknown>) ?? {};
          redisStore.set(key, { ...existing, ...fields });
        });
        return pipe;
      }),
      expire: vi.fn(() => pipe),
      exec: vi.fn(async () => { ops.forEach((op) => op()); return []; }),
    };
    return pipe;
  });
});

afterEach(async () => {
  await resetTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

// ── Tests ──

describe("Suite 5.1 — Happy path: notify → trigger → orchestrator → connection details", () => {
  it("QStash message from notifyBackfillService flows through to backfill trigger and fires Inngest event", async () => {
    // 1. Connections publishes QStash notify message
    await notifyBackfillService({
      installationId: "inst-lifecycle-happy",
      provider: "github",
      orgId: "org-lifecycle-happy",
    });

    expect(qstashMessages).toHaveLength(1);
    const capturedMsg = qstashMessages[0]!;
    expect(capturedMsg.url).toContain("/trigger");

    // 2. Deliver captured QStash body to backfill trigger endpoint
    const res = await backfillApp.request("/api/trigger", {
      method: "POST",
      headers: new Headers({
        "Content-Type": "application/json",
        ...(capturedMsg.headers ?? {}),
      }),
      body: JSON.stringify(capturedMsg.body),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as { status: string };
    expect(json.status).toBe("accepted");

    // 3. Inngest run.requested event should have fired
    expect(inngestEventsSent).toContainEqual(
      expect.objectContaining({
        name: "apps-backfill/run.requested",
        data: expect.objectContaining({
          installationId: "inst-lifecycle-happy",
          provider: "github",
          orgId: "org-lifecycle-happy",
        }),
      }),
    );
  });

  it("orchestrator fetches connection from Connections service via service router", async () => {
    // Pre-seed DB with installation + resources
    const inst = fixtures.installation({
      provider: "github",
      orgId: "org-lifecycle-orch",
      status: "active",
    });
    await db.insert(gwInstallations).values(inst);

    const resource = fixtures.resource({
      installationId: inst.id!,
      providerResourceId: "owner/lifecycle-repo",
      status: "active",
    });
    await db.insert(gwResources).values(resource);

    const orchHandler = capturedHandlers.get("apps-backfill/run.orchestrator");
    expect(orchHandler).toBeDefined();

    const step = makeStep({
      waitForEvent: vi.fn().mockResolvedValue({
        data: {
          installationId: inst.id,
          provider: "github",
          entityType: "pull_request",
          resourceId: "owner/lifecycle-repo",
          success: true,
          eventsProduced: 5,
          eventsDispatched: 5,
          pagesProcessed: 1,
        },
      }),
    });

    // Install service router so orchestrator fetch() → connectionsApp
    const restore = installServiceRouter({ connectionsApp });
    try {
      const result = await orchHandler!({
        event: {
          data: {
            installationId: inst.id,
            provider: "github",
            orgId: "org-lifecycle-orch",
            depth: 30,
            entityTypes: ["pull_request"],
          },
        },
        step,
      }) as {
        success: boolean;
        workUnits: number;
        eventsProduced: number;
        eventsDispatched: number;
      };

      expect(result.success).toBe(true);
      expect(result.workUnits).toBe(1);
      expect(result.eventsProduced).toBe(5);
      expect(result.eventsDispatched).toBe(5);
    } finally {
      restore();
    }
  });

  it("gateway service auth path accepts backfill-dispatched event and publishes envelope to QStash", async () => {
    // Simulate the dispatch step at the end of the entity worker loop
    const restore = installServiceRouter({ gatewayApp });
    try {
      const res = await fetch("http://localhost:4108/api/webhooks/github", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": "0".repeat(64),
        },
        body: JSON.stringify({
          connectionId: "conn-lifecycle-1",
          orgId: "org-lifecycle-1",
          deliveryId: "del-lifecycle-e2e-1",
          eventType: "push",
          payload: { repository: { id: 99999 } },
          receivedAt: Date.now(),
        }),
      });

      const json = await res.json() as { status: string };
      expect(json.status).toBe("accepted");

      // QStash should have received the WebhookEnvelope
      expect(qstashMock.publishJSON).toHaveBeenCalled();
      const envelope = (qstashMock.publishJSON as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
        body: { connectionId: string; provider: string; deliveryId: string };
      };
      expect(envelope.body.connectionId).toBe("conn-lifecycle-1");
      expect(envelope.body.provider).toBe("github");
      expect(envelope.body.deliveryId).toBe("del-lifecycle-e2e-1");
    } finally {
      restore();
    }
  });
});

describe("Suite 5.2 — Teardown path: cancel → trigger/cancel → Inngest run.cancelled", () => {
  it("cancelBackfillService QStash message delivered to trigger/cancel fires run.cancelled", async () => {
    // 1. Connections publishes cancel QStash message
    await cancelBackfillService({ installationId: "inst-lifecycle-cancel" });

    expect(qstashMessages).toHaveLength(1);
    const capturedMsg = qstashMessages[0]!;
    expect(capturedMsg.url).toContain("/trigger/cancel");

    // 2. Deliver captured QStash body to backfill cancel endpoint
    const res = await backfillApp.request("/api/trigger/cancel", {
      method: "POST",
      headers: new Headers({
        "Content-Type": "application/json",
        ...(capturedMsg.headers ?? {}),
      }),
      body: JSON.stringify(capturedMsg.body),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as { status: string };
    expect(json.status).toBe("cancelled");

    // 3. Inngest run.cancelled event should have fired
    expect(inngestEventsSent).toContainEqual(
      expect.objectContaining({
        name: "apps-backfill/run.cancelled",
        data: { installationId: "inst-lifecycle-cancel" },
      }),
    );
  });

  it("DELETE /connections/:provider/:id triggers teardown workflow", async () => {
    const inst = fixtures.installation({
      provider: "github",
      orgId: "org-teardown-1",
      status: "active",
    });
    await db.insert(gwInstallations).values(inst);

    const res = await connectionsApp.request(
      `/api/connections/github/${inst.id}`,
      {
        method: "DELETE",
        headers: new Headers({ "X-API-Key": "0".repeat(64) }),
      },
    );

    expect(res.status).toBe(200);
    const json = await res.json() as { status: string; installationId: string };
    expect(json.status).toBe("teardown_initiated");
    expect(json.installationId).toBe(inst.id);
  });

  it("dedup prevents duplicate gateway events during backfill retries", async () => {
    const deliveryId = "del-dedup-lifecycle-1";
    const body = {
      connectionId: "conn-dedup-1",
      orgId: "org-dedup-1",
      deliveryId,
      eventType: "push",
      payload: { repository: { id: 11111 } },
      receivedAt: Date.now(),
    };

    // First dispatch — accepted
    const first = await gatewayApp.request("/api/webhooks/github", {
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json", "X-API-Key": "0".repeat(64) }),
      body: JSON.stringify(body),
    });
    expect((await first.json() as { status: string }).status).toBe("accepted");

    // Second dispatch (retry with same deliveryId) — deduplicated
    const second = await gatewayApp.request("/api/webhooks/github", {
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json", "X-API-Key": "0".repeat(64) }),
      body: JSON.stringify({ ...body, receivedAt: Date.now() }),
    });
    expect((await second.json() as { status: string }).status).toBe("duplicate");

    // QStash should only have been called once
    expect(qstashMock.publishJSON).toHaveBeenCalledOnce();
  });
});
