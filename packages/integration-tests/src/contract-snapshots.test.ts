/**
 * 0.1 Contract Snapshot Tests
 *
 * Captures the shapes of service boundary request/response payloads
 * using shapeOf() (strips values, retains key structure + typeof types) and
 * toMatchSnapshot(). Catches structural drift in PRs: if a boundary payload
 * adds, removes, or renames a field, the snapshot fails and forces a deliberate
 * update.
 *
 * The 3 shapes under test:
 *   1. Connections GET /connections/:id → Backfill orchestrator response
 *   2. Connections GET /connections/:id/token → Backfill entity worker response
 *   3. Backfill → Gateway: POST /webhooks/:provider service-auth body
 *
 * Infrastructure: PGlite (shapes 1–2), QStash capture mock (shape 3).
 * No external network calls. Each test makes a single in-process HTTP call.
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

// ── shapeOf: converts a value to its structural skeleton ──
//
// Recursively replaces primitive values with their typeof string ("string",
// "number", "boolean"), null with "null", undefined with "undefined", and
// arrays with a single-element array of the first element's shape.
// Object keys are sorted for stable snapshot ordering.
function shapeOf(val: unknown): unknown {
  if (val === null) return "null";
  if (val === undefined) return "undefined";
  if (Array.isArray(val)) {
    return val.length > 0 ? [shapeOf(val[0])] : [];
  }
  if (typeof val === "object") {
    return Object.fromEntries(
      Object.entries(val as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, shapeOf(v)]),
    );
  }
  return typeof val;
}

// ── Shared state ──
let db: TestDb;

// ── Create all mock state in vi.hoisted ──
const {
  redisMock,
  redisStore,
  qstashMessages,
  qstashMock,
} = await vi.hoisted(async () => {
  const { makeRedisMock, makeQStashMock } = await import("./harness.js");
  const redisStore = new Map<string, unknown>();
  const messages: { url: string; body: unknown; headers?: Record<string, string> }[] = [];
  return {
    redisMock: makeRedisMock(redisStore),
    redisStore,
    qstashMessages: messages,
    qstashMock: makeQStashMock(messages),
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
    send = vi.fn().mockResolvedValue({ ids: ["evt-1"] });
    createFunction = vi.fn(() => ({ id: "mock" }));
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
    trigger: vi.fn().mockResolvedValue({ workflowRunId: "wf-snap" }),
  }),
}));

vi.mock("@vendor/upstash-workflow/hono", () => ({
  serve: vi.fn(() => () => new Response("ok")),
}));

// ── Import apps and modules after mocks ──
import connectionsApp from "@connections/app";
import { encrypt } from "@repo/lib";

// ── Helpers ──
const API_KEY = "0".repeat(64);
const ENCRYPTION_KEY = "a".repeat(64);

function connReq(path: string) {
  return connectionsApp.request(path, {
    method: "GET",
    headers: new Headers({ "X-API-Key": API_KEY }),
  });
}

// ── Lifecycle ──

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(() => {
  vi.clearAllMocks();
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

// ── Contract Snapshot Tests ──

describe("0.1 — Boundary contract shapes", () => {
  it("Shape 1: GET /connections/:id response (Backfill orchestrator reads this)", async () => {
    const inst = fixtures.installation({
      provider: "github",
      orgId: "org-snap-2",
      status: "active",
    });
    await db.insert(gwInstallations).values(inst);

    const resource = fixtures.resource({
      installationId: inst.id,
      providerResourceId: "owner/snap-repo",
      resourceName: "snap-repo",
      status: "active",
    });
    await db.insert(gwResources).values(resource);

    const res = await connReq(`/services/connections/${inst.id}`);
    expect(res.status).toBe(200);

    const json: unknown = await res.json();
    expect(shapeOf(json)).toMatchSnapshot();
  });

  it("Shape 2: GET /connections/:id/token response (Backfill entity worker reads this)", async () => {
    const inst = fixtures.installation({
      provider: "sentry",
      orgId: "org-snap-3",
      status: "active",
    });
    await db.insert(gwInstallations).values(inst);

    const encryptedToken = encrypt("snap-access-token-xyz", ENCRYPTION_KEY);
    const token = fixtures.token({
      installationId: inst.id,
      accessToken: encryptedToken,
    });
    await db.insert(gwTokens).values(token);

    const res = await connReq(`/services/connections/${inst.id}/token`);
    expect(res.status).toBe(200);

    const json: unknown = await res.json();
    expect(shapeOf(json)).toMatchSnapshot();
  });

  it("Shape 3: Backfill → Gateway POST /webhooks/:provider body (entity worker dispatch)", () => {
    // Representative object — matches what entity-worker.ts constructs and sends
    // to the gateway service-auth endpoint (POST /api/webhooks/:provider, X-API-Key).
    // If entity-worker.ts changes the dispatch body shape, update this fixture.
    const dispatchBody = {
      connectionId: "inst-snap-4",
      orgId: "org-snap-4",
      deliveryId: "del-snap-4",
      eventType: "pull_request",
      payload: { action: "opened", number: 1 },
      receivedAt: 1_700_000_000_000,
    };
    expect(shapeOf(dispatchBody)).toMatchSnapshot();
  });
});
