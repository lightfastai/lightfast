/**
 * Suite 3: Backfill → Connections API (HTTP Contract)
 *
 * Verifies that the Backfill service correctly calls the Connections HTTP API
 * and parses the responses, and that the Connections API responds with the
 * shapes the Backfill service expects.
 *
 * Infrastructure: PGlite (real DB for connections app), service mesh fetch
 * router (localhost:4110 → connectionsApp), Inngest function capture.
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
  qstashMock,
  capturedHandlers,
  inngestSendMock,
  NonRetriableErrorRef,
  mockGetConnector,
} = await vi.hoisted(async () => {
  const { makeRedisMock, makeQStashMock } = await import("./harness.js");
  const redisStore = new Map<string, unknown>();
  const capturedHandlers = new Map<
    string,
    (args: { event: unknown; step: unknown }) => Promise<unknown>
  >();
  // Store NonRetriableError class so tests can check instanceof
  const NonRetriableErrorRef = { current: Error };

  return {
    redisMock: makeRedisMock(redisStore),
    redisStore,
    qstashMock: makeQStashMock([]),
    capturedHandlers,
    inngestSendMock: vi.fn().mockResolvedValue({ ids: ["evt-1"] }),
    NonRetriableErrorRef,
    mockGetConnector: vi.fn(),
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

vi.mock("@vendor/inngest", () => {
  class MockNonRetriableError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "NonRetriableError";
    }
  }
  // Store ref so tests can use instanceof check
  NonRetriableErrorRef.current = MockNonRetriableError as typeof Error;

  return {
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
    NonRetriableError: MockNonRetriableError,
  };
});

vi.mock("@repo/console-backfill", () => ({
  getConnector: (...args: unknown[]): unknown => mockGetConnector(...args),
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

// ── Import apps and orchestrator after mocks ──
import connectionsApp from "@connections/app";
import relayApp from "@relay/app";

// Force backfill workflows to load and register their createFunction handlers
await import("@backfill/orchestrator");
await import("@backfill/entity-worker");

// ── Utilities ──
import { installServiceRouter, makeStep } from "./harness.js";
import { encrypt } from "@repo/lib";

// ── Request helper (connections) ──
const API_KEY = "0".repeat(64);

function connReq(
  path: string,
  init: {
    method?: string;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {},
) {
  const headers = new Headers({ "X-API-Key": API_KEY, ...init.headers });
  if (!headers.has("content-type") && init.body) {
    headers.set("content-type", "application/json");
  }
  return connectionsApp.request(path, {
    method: init.method ?? "GET",
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
  inngestSendMock.mockResolvedValue({ ids: ["evt-1"] });
  redisStore.clear();

  // Default connector — passes orchestrator validation, fetchPage never called by orchestrator
  mockGetConnector.mockReturnValue({
    defaultEntityTypes: ["pull_request"],
    supportedEntityTypes: ["pull_request"],
    fetchPage: vi.fn(),
  });

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

describe("Suite 3.1 — GET /connections/:id HTTP contract", () => {
  it("returns connection shape with resources", async () => {
    const inst = fixtures.installation({
      provider: "github",
      orgId: "org-api-1",
      status: "active",
    });
    await db.insert(gwInstallations).values(inst);

    const resource = fixtures.resource({
      installationId: inst.id,
      providerResourceId: "owner/repo-api",
      resourceName: "repo-api",
      status: "active",
    });
    await db.insert(gwResources).values(resource);

    const res = await connReq(`/services/connections/${inst.id}`);

    expect(res.status).toBe(200);

    const json = await res.json() as {
      id: string;
      provider: string;
      status: string;
      orgId: string;
      resources: { id: string; providerResourceId: string; resourceName: string | null }[];
    };

    expect(json.id).toBe(inst.id);
    expect(json.provider).toBe("github");
    expect(json.status).toBe("active");
    expect(json.orgId).toBe("org-api-1");
    expect(json.resources).toHaveLength(1);
    expect(json.resources[0]).toMatchObject({
      id: resource.id,
      providerResourceId: "owner/repo-api",
      resourceName: "repo-api",
    });
  });

  it("returns 404 for unknown installation ID", async () => {
    const res = await connReq("/services/connections/nonexistent-id-xyz");
    expect(res.status).toBe(404);
  });

  it("returns only active resources (excludes removed)", async () => {
    const inst = fixtures.installation({ provider: "github", status: "active" });
    await db.insert(gwInstallations).values(inst);

    const activeResource = fixtures.resource({ installationId: inst.id, status: "active" });
    const removedResource = fixtures.resource({ installationId: inst.id, status: "removed" });
    await db.insert(gwResources).values([activeResource, removedResource]);

    const res = await connReq(`/services/connections/${inst.id}`);
    expect(res.status).toBe(200);

    const json = await res.json() as { resources: { id: string }[] };
    expect(json.resources).toHaveLength(1);
    const firstResource = json.resources[0];
    expect(firstResource).toBeDefined();
    if (!firstResource) return;
    expect(firstResource.id).toBe(activeResource.id);
  });
});

describe("Suite 3.2 — Orchestrator get-connection step via service router", () => {
  it("orchestrator fetches connection via HTTP and produces correct work units", async () => {
    const inst = fixtures.installation({
      provider: "github",
      orgId: "org-orch-1",
      status: "active",
    });
    await db.insert(gwInstallations).values(inst);

    const resource = fixtures.resource({
      installationId: inst.id,
      providerResourceId: "owner/orch-repo",
      status: "active",
    });
    await db.insert(gwResources).values(resource);

    const orchHandler = capturedHandlers.get("apps-backfill/run.orchestrator");
    if (!orchHandler) throw new Error("orchestrator handler not registered");

    const step = makeStep({
      waitForEvent: vi.fn().mockResolvedValue({
        data: {
          installationId: inst.id,
          provider: "github",
          entityType: "pull_request",
          resourceId: "owner/orch-repo",
          success: true,
          eventsProduced: 2,
          eventsDispatched: 2,
          pagesProcessed: 1,
        },
      }),
    });

    const restore = installServiceRouter({ connectionsApp });
    try {
      const result = await orchHandler({
        event: {
          data: {
            installationId: inst.id,
            provider: "github",
            orgId: "org-orch-1",
            depth: 30,
            entityTypes: ["pull_request"],
          },
        },
        step,
      }) as { success: boolean; workUnits: number };

      expect(result.success).toBe(true);
      expect(result.workUnits).toBe(1);
    } finally {
      restore();
    }
  });

  it("orchestrator throws NonRetriableError when connection status is not active", async () => {
    const inst = fixtures.installation({
      provider: "github",
      orgId: "org-orch-2",
      status: "revoked",
    });
    await db.insert(gwInstallations).values(inst);

    const orchHandler = capturedHandlers.get("apps-backfill/run.orchestrator");
    if (!orchHandler) throw new Error("orchestrator handler not registered");

    const step = makeStep();

    const restore = installServiceRouter({ connectionsApp });
    try {
      await expect(
        orchHandler({
          event: {
            data: {
              installationId: inst.id,
              provider: "github",
              orgId: "org-orch-2",
              depth: 30,
            },
          },
          step,
        }),
      ).rejects.toThrow("Connection is not active");

      // Should be a NonRetriableError (from our mock)
      await expect(
        orchHandler({
          event: {
            data: {
              installationId: inst.id,
              provider: "github",
              orgId: "org-orch-2",
              depth: 30,
            },
          },
          step,
        }),
      ).rejects.toMatchObject({ name: "NonRetriableError" });
    } finally {
      restore();
    }
  });

  it("orchestrator returns early with workUnits: 0 when no resources linked", async () => {
    const inst = fixtures.installation({
      provider: "github",
      orgId: "org-orch-3",
      status: "active",
    });
    await db.insert(gwInstallations).values(inst);
    // No resources inserted

    const orchHandler = capturedHandlers.get("apps-backfill/run.orchestrator");
    if (!orchHandler) throw new Error("orchestrator handler not registered");

    const step = makeStep();

    const restore = installServiceRouter({ connectionsApp });
    try {
      const result = await orchHandler({
        event: {
          data: {
            installationId: inst.id,
            provider: "github",
            orgId: "org-orch-3",
            depth: 30,
            entityTypes: ["pull_request"],
          },
        },
        step,
      }) as { success: boolean; workUnits: number; eventsProduced: number };

      expect(result.success).toBe(true);
      expect(result.workUnits).toBe(0);
      expect(result.eventsProduced).toBe(0);
    } finally {
      restore();
    }
  });
});

describe("Suite 3.3 — GET /connections/:id/token HTTP contract", () => {
  it("returns decrypted Sentry token from DB", async () => {
    const ENCRYPTION_KEY = "a".repeat(64);
    const plainToken = "sentry-access-token-abc123";

    const inst = fixtures.installation({
      provider: "sentry",
      orgId: "org-token-1",
      status: "active",
    });
    await db.insert(gwInstallations).values(inst);

    // Encrypt and store token in DB (as it would be stored by real OAuth flow)
    const encryptedToken = encrypt(plainToken, ENCRYPTION_KEY);
    const token = fixtures.token({
      installationId: inst.id,
      accessToken: encryptedToken,
    });
    await db.insert(gwTokens).values(token);

    const res = await connReq(`/services/connections/${inst.id}/token`);

    expect(res.status).toBe(200);

    const json = await res.json() as {
      accessToken: string;
      provider: string;
      expiresIn: number | null;
    };

    expect(json.accessToken).toBe(plainToken);
    expect(json.provider).toBe("sentry");
  });

  it("returns 400 for inactive installation", async () => {
    const inst = fixtures.installation({
      provider: "sentry",
      status: "revoked",
    });
    await db.insert(gwInstallations).values(inst);

    const res = await connReq(`/services/connections/${inst.id}/token`);

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("installation_not_active");
  });

  it("returns 404 for installation with no token stored", async () => {
    const inst = fixtures.installation({
      provider: "sentry",
      status: "active",
    });
    await db.insert(gwInstallations).values(inst);
    // No token inserted

    const res = await connReq(`/services/connections/${inst.id}/token`);

    expect(res.status).toBe(404);
  });
});

describe("Suite 3.4 — Entity worker token refresh on 401 mid-pagination", () => {
  it("fetches fresh token when connector throws 401 on first fetchPage call", async () => {
    const ENCRYPTION_KEY = "a".repeat(64);

    // Seed DB with an active installation + encrypted token.
    // Use "sentry" not "github": GitHub generates JWTs on-demand (no stored token),
    // which fails in tests. Sentry uses a standard stored OAuth token.
    const inst = fixtures.installation({
      provider: "sentry",
      orgId: "org-retry-401",
      status: "active",
    });
    await db.insert(gwInstallations).values(inst);

    const encryptedToken = encrypt("initial-access-token", ENCRYPTION_KEY);
    const token = fixtures.token({
      installationId: inst.id,
      accessToken: encryptedToken,
    });
    await db.insert(gwTokens).values(token);

    const entityHandler = capturedHandlers.get("apps-backfill/entity.worker");
    if (!entityHandler) throw new Error("entity handler not registered");

    // Connector: throws 401 on first fetchPage, returns one event on second
    const err401 = Object.assign(new Error("Unauthorized"), { status: 401 });
    const mockConnector = {
      defaultEntityTypes: ["pull_request"],
      supportedEntityTypes: ["pull_request"],
      fetchPage: vi.fn()
        .mockRejectedValueOnce(err401)
        .mockResolvedValueOnce({
          events: [
            { deliveryId: "del-retry-1", eventType: "pull_request", payload: { number: 1 } },
          ],
          nextCursor: null,
          rawCount: 1,
        }),
    };
    mockGetConnector.mockReturnValue(mockConnector);

    // Service router: connections (port 4110) → token endpoint
    //                 gateway (port 4108) → accepts dispatched event
    const restore = installServiceRouter({ connectionsApp, relayApp });
    try {
      const result = await entityHandler({
        event: {
          data: {
            installationId: inst.id,
            provider: "sentry",
            orgId: "org-retry-401",
            entityType: "pull_request",
            resource: { providerResourceId: "owner/retry-repo", resourceName: "retry-repo" },
            since: new Date().toISOString(),
          },
        },
        step: makeStep(),
      }) as { eventsDispatched: number; pagesProcessed: number };

      // fetchPage was attempted twice: once with initial token (→ 401), once after refresh
      expect(mockConnector.fetchPage).toHaveBeenCalledTimes(2);
      // Entity worker completed successfully after the refresh
      expect(result.eventsDispatched).toBe(1);
      expect(result.pagesProcessed).toBe(1);
    } finally {
      restore();
    }
  });
});
