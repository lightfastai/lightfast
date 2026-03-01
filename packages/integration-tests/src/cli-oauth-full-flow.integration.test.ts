/**
 * Suite 9: Full CLI OAuth Flow E2E
 *
 * End-to-end CLI flow bridging tRPC caller → connections service → Redis polling.
 * Exercises the full authorize-callback-poll chain as a CLI client would experience it.
 *
 * Because Redis is in-memory (shared Map), state written by the authorize handler
 * is immediately readable by the callback handler and the poll endpoint.
 *
 * Tests:
 *   9.1 — Happy path: authorize → callback → poll completed
 *   9.2 — Reactivation: existing connection → reactivated flag flows through
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

// ── Shared state ──
let db: TestDb;

// ── Create mock state in vi.hoisted ──
const { redisMock, redisStore, mockGetProvider, mockProvider } =
  await vi.hoisted(async () => {
    const { makeRedisMock } = await import("./harness.js");
    const redisStore = new Map<string, unknown>();
    const mockProvider = {
      name: "github" as const,
      getAuthorizationUrl: vi
        .fn()
        .mockReturnValue(
          "https://github.com/login/oauth/authorize?mock=1",
        ),
      handleCallback: vi.fn().mockResolvedValue({
        installationId: "inst-1",
        provider: "github",
        status: "connected",
      }),
      resolveToken: vi.fn(),
    };
    return {
      redisMock: makeRedisMock(redisStore),
      redisStore,
      mockGetProvider: vi.fn().mockReturnValue(mockProvider),
      mockProvider,
    };
  });

// ── vi.mock declarations ──

vi.mock("@db/console/client", () => ({
  get db() {
    return db;
  },
}));

vi.mock("@vendor/upstash", () => ({ redis: redisMock }));

vi.mock("@vendor/upstash-workflow/client", () => ({
  getWorkflowClient: () => ({
    trigger: vi.fn().mockResolvedValue({ workflowRunId: "wf-1" }),
  }),
}));

vi.mock("@vendor/qstash", () => ({
  getQStashClient: () => ({
    publishJSON: vi.fn().mockResolvedValue({ messageId: "msg-1" }),
  }),
  Receiver: class {
    verify() {
      return Promise.resolve(true);
    }
  },
}));

vi.mock("@vendor/related-projects", () => ({
  withRelatedProject: ({ defaultHost }: { defaultHost: string }) => defaultHost,
}));

vi.mock("@vercel/related-projects", () => ({
  withRelatedProject: ({
    defaultHost,
  }: {
    projectName: string;
    defaultHost: string;
  }) => {
    if (defaultHost.includes("4110")) return `${defaultHost}/services`;
    return defaultHost;
  },
}));

vi.mock("@console/env", () => ({
  env: { GATEWAY_API_KEY: "0".repeat(64) },
}));

vi.mock("@vendor/clerk/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null, orgId: null }),
  clerkClient: () => ({}),
}));

vi.mock("@connections/providers", () => ({
  getProvider: (...args: unknown[]): unknown => mockGetProvider(...args),
}));

// ── Imports after mocks ──
import { createTRPCRouter, createCallerFactory } from "@console/trpc";
import type { createUserTRPCContext } from "@console/trpc";
import { connectionsRouter } from "@console/router/org/connections";
import connectionsApp from "@connections/app";
import { makeApiKeyFixture, installServiceRouter, TEST_WORKSPACE_SETTINGS } from "./harness.js";
import { orgWorkspaces } from "@db/console/schema";
import { oauthResultKey } from "@connections/cache";

// Use crypto.randomUUID() for unique IDs — avoids importing @repo/lib
function uid() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

// ── tRPC caller setup ──
const testRouter = createTRPCRouter(connectionsRouter);
const createCaller = createCallerFactory(testRouter);

// TRPCCtx: the resolved context shape createCaller expects.
// We cast PgliteDatabase → NeonHttpDatabase since they share the same query interface.
type TRPCCtx = Awaited<ReturnType<typeof createUserTRPCContext>>;

function apiKeyCaller(rawKey: string, workspaceId: string) {
  // Cast to TRPCCtx: PgliteDatabase is interface-compatible with NeonHttpDatabase at runtime.
  return createCaller({
    auth: { type: "unauthenticated" },
    db,
    headers: new Headers({
      Authorization: `Bearer ${rawKey}`,
      "X-Workspace-ID": workspaceId,
    }),
  } as unknown as TRPCCtx);
}

// ── Lifecycle ──

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(() => {
  vi.clearAllMocks();

  redisMock.hset.mockImplementation(
    (key: string, fields: Record<string, unknown>) => {
      const existing =
        (redisStore.get(key) ?? {}) as Record<string, unknown>;
      redisStore.set(key, { ...existing, ...fields });
      return Promise.resolve(1);
    },
  );
  redisMock.hgetall.mockImplementation(<T>(key: string) =>
    Promise.resolve((redisStore.get(key) ?? null) as T),
  );
  redisMock.set.mockImplementation(
    (key: string, value: unknown, opts?: { nx?: boolean }) => {
      if (opts?.nx && redisStore.has(key)) return Promise.resolve(null);
      redisStore.set(key, value);
      return Promise.resolve("OK");
    },
  );
  redisMock.del.mockImplementation((...keys: string[]) => {
    const allKeys = keys.flat();
    let count = 0;
    for (const k of allKeys) {
      if (redisStore.delete(k)) count++;
    }
    return Promise.resolve(count);
  });
  redisMock.get.mockImplementation(<T>(key: string) =>
    Promise.resolve((redisStore.get(key) ?? null) as T),
  );
  redisMock.pipeline.mockImplementation(() => {
    const ops: (() => void)[] = [];
    const pipe = {
      hset: vi.fn((key: string, fields: Record<string, unknown>) => {
        ops.push(() => {
          const existing =
            (redisStore.get(key) ?? {}) as Record<string, unknown>;
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

  mockGetProvider.mockReturnValue(mockProvider);
  mockProvider.getAuthorizationUrl.mockReturnValue(
    "https://github.com/login/oauth/authorize?mock=1",
  );
  mockProvider.handleCallback.mockResolvedValue({
    installationId: "inst-1",
    provider: "github",
    status: "connected",
  });
});

afterEach(async () => {
  await resetTestDb();
  redisStore.clear();
});

afterAll(async () => {
  await closeTestDb();
});

// ── Tests ──

describe("Suite 9 — Full CLI OAuth Flow E2E", () => {
  it("9.1 — Happy path: authorize → callback → poll completed", async () => {
    // 1. Seed DB: orgWorkspace with clerkOrgId, API key
    const wsId = uid();
    const clerkOrgId = `org_${uid()}`;
    await db.insert(orgWorkspaces).values({
      id: wsId,
      clerkOrgId,
      name: "e2e-workspace",
      slug: "e2e-ws",
      settings: TEST_WORKSPACE_SETTINGS,
    });
    const { rawKey } = await makeApiKeyFixture(db, { userId: "user_e2e" });

    const restore = installServiceRouter({ connectionsApp });
    try {
      // 2. Call tRPC cliAuthorize → connections service → { url, state }
      const caller = apiKeyCaller(rawKey, wsId);
      const { state } = (await caller.cliAuthorize({
        provider: "github",
      })) as { url: string; state: string };
      expect(typeof state).toBe("string");
      expect(state.length).toBeGreaterThan(0);

      // 3. Simulate browser callback: GET /services/connections/github/callback?code=abc&state=<state>
      const callbackRes = await connectionsApp.request(
        `/services/connections/github/callback?code=abc&state=${state}`,
      );
      expect(callbackRes.status).toBe(200); // inline HTML

      // 4. Assert oauthResultKey(state) in Redis has { status: "completed" }
      const result = redisStore.get(oauthResultKey(state)) as Record<
        string,
        string
      >;
      expect(result).toBeDefined();
      expect(result.status).toBe("completed");
      expect(result.provider).toBe("github");

      // 5. Poll: GET /services/connections/oauth/status?state=<state>
      const pollRes = await connectionsApp.request(
        `/services/connections/oauth/status?state=${state}`,
      );
      expect(pollRes.status).toBe(200);
      const pollJson = (await pollRes.json()) as {
        status: string;
        provider: string;
      };
      expect(pollJson.status).toBe("completed");
      expect(pollJson.provider).toBe("github");
    } finally {
      restore();
    }
  });

  it("9.2 — Reactivation: callback with reactivated=true flows through to poll response", async () => {
    // 1. Seed DB: orgWorkspace, API key
    const wsId = uid();
    const clerkOrgId = `org_${uid()}`;
    await db.insert(orgWorkspaces).values({
      id: wsId,
      clerkOrgId,
      name: "reactivation-workspace",
      slug: "reactivation-ws",
      settings: TEST_WORKSPACE_SETTINGS,
    });
    const { rawKey } = await makeApiKeyFixture(db, {
      userId: "user_reactivation",
    });

    // Simulate reactivation: handleCallback returns { reactivated: true }
    mockProvider.handleCallback.mockResolvedValueOnce({
      installationId: "inst-existing",
      provider: "github",
      status: "connected",
      reactivated: true,
    });

    const restore = installServiceRouter({ connectionsApp });
    try {
      // 2. Call tRPC cliAuthorize → { url, state }
      const caller = apiKeyCaller(rawKey, wsId);
      const { state } = (await caller.cliAuthorize({
        provider: "github",
      })) as { url: string; state: string };

      // 3. Simulate callback — reactivated connection
      const callbackRes = await connectionsApp.request(
        `/services/connections/github/callback?code=abc&state=${state}`,
      );
      expect(callbackRes.status).toBe(200); // inline HTML (reactivated, still inline)

      // 4. Assert oauthResultKey has { status: "completed", reactivated: "true" }
      const result = redisStore.get(oauthResultKey(state)) as Record<
        string,
        string
      >;
      expect(result.status).toBe("completed");
      expect(result.reactivated).toBe("true");

      // 5. Poll → { status: "completed", reactivated: "true" }
      const pollRes = await connectionsApp.request(
        `/services/connections/oauth/status?state=${state}`,
      );
      expect(pollRes.status).toBe(200);
      const pollJson = (await pollRes.json()) as {
        status: string;
        reactivated: string;
      };
      expect(pollJson.status).toBe("completed");
      expect(pollJson.reactivated).toBe("true");
    } finally {
      restore();
    }
  });
});
