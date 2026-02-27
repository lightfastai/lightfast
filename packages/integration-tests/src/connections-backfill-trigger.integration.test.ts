/**
 * Suite 2: Connections → Backfill Trigger (QStash Contract)
 *
 * Verifies that the QStash message published by notifyBackfillService
 * matches the schema expected by POST /api/trigger, and that the
 * cancel message matches POST /api/trigger/cancel.
 *
 * Infrastructure: PGlite (for reactivated-installation test), in-memory
 * QStash capture mock, Inngest send mock.
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
import { gwInstallations } from "@db/console/schema";

// ── Shared state ──
let db: TestDb;

// ── Create all mock state in vi.hoisted ──
const {
  redisMock,
  redisStore,
  qstashMessages,
  qstashMock,
  inngestSendMock,
} = await vi.hoisted(async () => {
  const { makeRedisMock, makeQStashMock } = await import("./harness.js");
  const redisStore = new Map<string, unknown>();
  const messages: { url: string; body: unknown; headers?: Record<string, string> }[] = [];
  return {
    redisMock: makeRedisMock(redisStore),
    redisStore,
    qstashMessages: messages,
    qstashMock: makeQStashMock(messages),
    inngestSendMock: vi.fn().mockResolvedValue({ ids: ["evt-1"] }),
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
    createFunction = vi.fn();
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
    trigger: vi.fn().mockResolvedValue({ workflowRunId: "wf-test" }),
  }),
}));

vi.mock("@vendor/upstash-workflow/hono", () => ({
  serve: vi.fn(() => () => new Response("ok")),
}));

// ── Import apps and utilities after mocks ──
import backfillApp from "@backfill/app";
import connectionsApp from "@connections/app";
import {
  notifyBackfillService,
  cancelBackfillService,
} from "@connections/urls";

// ── Request helper (backfill) ──
const API_KEY = "0".repeat(64);

function triggerReq(
  path: string,
  init: {
    method?: string;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {},
) {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body) {
    headers.set("content-type", "application/json");
  }
  return backfillApp.request(path, {
    method: init.method ?? "POST",
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
}

// ── Lifecycle ──

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(() => {
  vi.clearAllMocks();

  // Restore mock implementations after clearAllMocks
  inngestSendMock.mockResolvedValue({ ids: ["evt-1"] });
  qstashMessages.length = 0;
  redisStore.clear();

  redisMock.hset.mockImplementation((key: string, fields: Record<string, unknown>) => {
    const existing = (redisStore.get(key) ?? {}) as Record<string, unknown>;
    redisStore.set(key, { ...existing, ...fields });
    return Promise.resolve(1);
  });
  redisMock.hgetall.mockImplementation((key: string) =>
    Promise.resolve((redisStore.get(key) ?? null) as Record<string, string> | null),
  );
  redisMock.set.mockImplementation((key: string, value: unknown, opts?: { nx?: boolean }) => {
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
});

afterEach(async () => {
  await resetTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

// ── Tests ──

describe("Suite 2.1 — notifyBackfillService publishes correct QStash body", () => {
  it("publishes to backfill trigger URL with X-API-Key and correct body shape", async () => {
    await notifyBackfillService({
      installationId: "inst-trigger-1",
      provider: "github",
      orgId: "org-trigger-1",
    });

    expect(qstashMock.publishJSON).toHaveBeenCalledOnce();

    const mockCalls = (qstashMock.publishJSON as ReturnType<typeof vi.fn>).mock.calls;
    const firstMockCall = mockCalls[0] as unknown[] | undefined;
    expect(firstMockCall).toBeDefined();
    const call = firstMockCall[0] as {
      url: string;
      headers: Record<string, string>;
      body: { installationId: string; provider: string; orgId: string };
    };

    expect(call.url).toContain("/trigger");
    expect(call.url).toContain("localhost:4109");
    expect(call.headers).toMatchObject({ "X-API-Key": API_KEY });
    expect(call.body).toMatchObject({
      installationId: "inst-trigger-1",
      provider: "github",
      orgId: "org-trigger-1",
    });
  });

  it("captured QStash body delivered to POST /api/trigger returns 200 and fires run.requested", async () => {
    await notifyBackfillService({
      installationId: "inst-e2e-1",
      provider: "github",
      orgId: "org-e2e-1",
    });

    const capturedMsg = qstashMessages[0];
    expect(capturedMsg).toBeDefined();
    const capturedHeaders = capturedMsg.headers ?? {};

    // Re-deliver the captured QStash message to the backfill trigger endpoint
    const res = await triggerReq("/api/trigger", {
      body: capturedMsg.body as Record<string, unknown>,
      headers: capturedHeaders,
    });

    expect(res.status).toBe(200);

    const json = await res.json() as { status: string; installationId: string };
    expect(json.status).toBe("accepted");
    expect(json.installationId).toBe("inst-e2e-1");

    // Inngest event should have fired
    expect(inngestSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "apps-backfill/run.requested",
        data: expect.objectContaining({
          installationId: "inst-e2e-1",
          provider: "github",
          orgId: "org-e2e-1",
          depth: 30,
        }) as unknown,
      }),
    );
  });
});

describe("Suite 2.2 — Backfill trigger endpoint auth and validation", () => {
  it("POST /api/trigger rejects missing API key with 401", async () => {
    const res = await triggerReq("/api/trigger", {
      body: { installationId: "inst-1", provider: "github", orgId: "org-1" },
    });
    expect(res.status).toBe(401);
  });

  it("POST /api/trigger rejects wrong API key with 401", async () => {
    const res = await triggerReq("/api/trigger", {
      body: { installationId: "inst-1", provider: "github", orgId: "org-1" },
      headers: { "X-API-Key": "wrong-secret-key" },
    });
    expect(res.status).toBe(401);
  });

  it("POST /api/trigger rejects body missing required fields with 400", async () => {
    const res = await triggerReq("/api/trigger", {
      body: { installationId: "inst-1" }, // missing provider and orgId
      headers: { "X-API-Key": API_KEY },
    });
    expect(res.status).toBe(400);
  });
});

describe("Suite 2.3 — cancelBackfillService publishes cancel body", () => {
  it("publishes to trigger/cancel URL with correct body", async () => {
    await cancelBackfillService({ installationId: "inst-cancel-1" });

    expect(qstashMock.publishJSON).toHaveBeenCalledOnce();

    const mockCalls = (qstashMock.publishJSON as ReturnType<typeof vi.fn>).mock.calls;
    const firstMockCall = mockCalls[0] as unknown[] | undefined;
    expect(firstMockCall).toBeDefined();
    const call = firstMockCall[0] as {
      url: string;
      headers: Record<string, string>;
      body: { installationId: string };
    };

    expect(call.url).toContain("/trigger/cancel");
    expect(call.url).toContain("localhost:4109");
    expect(call.headers).toMatchObject({ "X-API-Key": API_KEY });
    expect(call.body).toEqual({ installationId: "inst-cancel-1" });
  });

  it("captured cancel body delivered to POST /api/trigger/cancel returns 200 and fires run.cancelled", async () => {
    await cancelBackfillService({ installationId: "inst-cancel-e2e" });

    const capturedMsg = qstashMessages[0];
    expect(capturedMsg).toBeDefined();
    const capturedHeaders = capturedMsg.headers ?? {};

    const res = await triggerReq("/api/trigger/cancel", {
      body: capturedMsg.body as Record<string, unknown>,
      headers: capturedHeaders,
    });

    expect(res.status).toBe(200);

    const json = await res.json() as { status: string; installationId: string };
    expect(json.status).toBe("cancelled");
    expect(json.installationId).toBe("inst-cancel-e2e");

    expect(inngestSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "apps-backfill/run.cancelled",
        data: { installationId: "inst-cancel-e2e" },
      }),
    );
  });
});

describe("Suite 2.4 — Reactivated GitHub installation skips backfill trigger", () => {
  it("GitHub callback for pre-existing installation does NOT publish to QStash", async () => {
    // Pre-seed an existing installation in the DB
    const inst = fixtures.installation({
      provider: "github",
      externalId: "gh-reactivate-ext-1",
      orgId: "org-reactivate",
      status: "revoked",
    });
    await db.insert(gwInstallations).values(inst);

    // Pre-seed valid OAuth state in Redis
    redisStore.set("gw:oauth:state:reactivate-state-1", {
      provider: "github",
      orgId: "org-reactivate",
      connectedBy: "user-reactivate",
      createdAt: Date.now().toString(),
    });

    // Call GitHub OAuth callback — should upsert (not insert) since externalId already exists
    const res = await connectionsApp.request(
      "/services/connections/github/callback?installation_id=gh-reactivate-ext-1&state=reactivate-state-1",
    );

    // Callback redirects on success
    expect(res.status).toBe(302);

    // notifyBackfillService should NOT have been called for a reactivated connection
    expect(qstashMock.publishJSON).not.toHaveBeenCalled();
  });

  it("Brand-new GitHub installation DOES publish to QStash", async () => {
    // Pre-seed OAuth state in Redis
    redisStore.set("gw:oauth:state:new-install-state", {
      provider: "github",
      orgId: "org-new",
      connectedBy: "user-new",
      createdAt: Date.now().toString(),
    });

    // Call GitHub OAuth callback for a NEW installation (no pre-existing DB row)
    const res = await connectionsApp.request(
      "/services/connections/github/callback?installation_id=gh-brand-new-ext-1&state=new-install-state",
    );

    // Callback redirects on success
    expect(res.status).toBe(302);

    // notifyBackfillService SHOULD have been called for a new connection
    expect(qstashMock.publishJSON).toHaveBeenCalledOnce();

    const mockCalls = (qstashMock.publishJSON as ReturnType<typeof vi.fn>).mock.calls;
    const firstMockCall = mockCalls[0] as unknown[] | undefined;
    expect(firstMockCall).toBeDefined();
    const call = firstMockCall[0] as {
      url: string;
      body: { provider: string; orgId: string };
    };
    expect(call.url).toContain("/trigger");
    expect(call.body.provider).toBe("github");
    expect(call.body.orgId).toBe("org-new");
  });
});
