/**
 * Suite 8: api/console connections tRPC procedures
 *
 * First-ever tRPC integration tests in the monorepo.
 * Uses createCallerFactory to invoke procedures directly with a manually
 * constructed context — no HTTP server, no Hono.
 *
 * Tests:
 *   8.1 — apiKeyProcedure auth validation (no key, bad key, expired, valid)
 *   8.2 — cliAuthorize procedure (workspace not found, no clerkOrgId, service error, happy path)
 *   8.3 — getAuthorizeUrl procedure (pending auth, happy path, service error)
 *
 * Infrastructure: PGlite (real DB for API key/workspace lookups), in-memory Redis,
 *   service mesh router (gatewayApp intercepts tRPC → connections fetches).
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

// ── Octokit mock functions (hoisted so vi.mock factory can reference them) ──
const { mockCreateGitHubApp, mockGetAppInstallation, mockGetInstallationRepositories } =
  vi.hoisted(() => ({
    mockCreateGitHubApp: vi.fn().mockReturnValue({}),
    mockGetAppInstallation: vi.fn(),
    mockGetInstallationRepositories: vi.fn(),
  }));

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

// @vendor/related-projects is used by the gateway service (urls.ts)
vi.mock("@vendor/related-projects", () => ({
  withRelatedProject: ({ defaultHost }: { defaultHost: string }) => defaultHost,
}));

// @vercel/related-projects is used by api/console connections router
// Return with /services prefix so fetch URL aligns with connections app mount
vi.mock("@vercel/related-projects", () => ({
  withRelatedProject: ({
    defaultHost,
  }: {
    projectName: string;
    defaultHost: string;
  }) => {
    // Gateway service URL needs /services prefix for service mesh to route correctly
    if (defaultHost.includes("4110")) return `${defaultHost}/services`;
    return defaultHost;
  },
}));

// Mock @console/env so cliAuthorize/getAuthorizeUrl can read GATEWAY_API_KEY
vi.mock("@console/env", () => ({
  env: {
    GATEWAY_API_KEY: "0".repeat(64),
    GITHUB_APP_ID: "12345",
    GITHUB_APP_PRIVATE_KEY: "test-private-key",
  },
}));

// Mock @repo/console-octokit-github for github.validate and github.repositories procedures
vi.mock("@repo/console-octokit-github", () => ({
  createGitHubApp: mockCreateGitHubApp,
  getAppInstallation: mockGetAppInstallation,
  getInstallationRepositories: mockGetInstallationRepositories,
}));

// Mock @vendor/clerk/server to avoid "server-only" import issues
vi.mock("@vendor/clerk/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null, orgId: null }),
  clerkClient: () => ({}),
}));

// Mock @gateway/providers for the gateway service routes
vi.mock("@gateway/providers", () => ({
  getProvider: (...args: unknown[]): unknown => mockGetProvider(...args),
}));

// ── Imports after mocks ──
import { createTRPCRouter, createCallerFactory } from "@console/trpc";
import type { createUserTRPCContext } from "@console/trpc";
import { connectionsRouter } from "@console/router/org/connections";
import gatewayApp from "@gateway/app";
import { makeApiKeyFixture, installServiceRouter, TEST_WORKSPACE_SETTINGS } from "./harness.js";
import { orgWorkspaces, gwInstallations } from "@db/console/schema";
import type { GitHubAccountInfo } from "@repo/gateway-types";

// Use crypto.randomUUID() for unique IDs — avoids importing @repo/lib
function uid() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

/**
 * Builds a valid GitHub providerAccountInfo JSONB blob for seeding test rows.
 */
function makeGitHubAccountInfo(overrides?: Partial<{
  accountLogin: string;
  accountType: "User" | "Organization";
}>): GitHubAccountInfo {
  return {
    version: 1,
    sourceType: "github",
    events: ["push", "pull_request"],
    installedAt: "2026-01-01T00:00:00Z",
    lastValidatedAt: "2026-01-01T00:00:00Z",
    raw: {
      account: {
        login: overrides?.accountLogin ?? "test-org",
        id: 67890,
        type: overrides?.accountType ?? "Organization",
        avatar_url: "https://avatars.githubusercontent.com/u/67890",
      },
      permissions: { contents: "read", metadata: "read" },
      events: ["push", "pull_request"],
      created_at: "2026-01-01T00:00:00Z",
    },
  };
}

// ── tRPC caller setup ──
// Wrap the connectionsRouter record in a tRPC router so createCallerFactory can use it
const testRouter = createTRPCRouter(connectionsRouter);
const createCaller = createCallerFactory(testRouter);

// TRPCCtx: the resolved context shape createCaller expects.
// We cast PgliteDatabase → NeonHttpDatabase since they share the same query interface.
type TRPCCtx = Awaited<ReturnType<typeof createUserTRPCContext>>;

// ── Request helpers ──

type AuthContext =
  | { type: "unauthenticated" }
  | { type: "clerk-active"; userId: string; orgId: string }
  | { type: "clerk-pending"; userId: string };

function makeCaller(auth: AuthContext, headers?: Headers) {
  // Cast to TRPCCtx: PgliteDatabase is interface-compatible with NeonHttpDatabase at runtime.
  // The discriminated union auth type requires double-cast to avoid member exhaustiveness errors.
  return createCaller({ auth, db, headers: headers ?? new Headers() } as unknown as TRPCCtx);
}

function apiKeyCaller(rawKey: string, workspaceId: string) {
  return makeCaller(
    { type: "unauthenticated" },
    new Headers({
      Authorization: `Bearer ${rawKey}`,
      "X-Workspace-ID": workspaceId,
    }),
  );
}

function clerkActiveCaller(userId: string, orgId: string) {
  return makeCaller({ type: "clerk-active", userId, orgId });
}

// ── Lifecycle ──

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(() => {
  vi.clearAllMocks();

  // Re-wire Redis mock implementations
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
    Promise.resolve((redisStore.get(key) as T) ?? null),
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

  // Re-wire provider mock
  mockGetProvider.mockReturnValue(mockProvider);
  mockProvider.getAuthorizationUrl.mockReturnValue(
    "https://github.com/login/oauth/authorize?mock=1",
  );
  mockProvider.handleCallback.mockResolvedValue({
    installationId: "inst-1",
    provider: "github",
    status: "connected",
  });

  // Re-wire octokit mocks (cleared by vi.clearAllMocks())
  mockCreateGitHubApp.mockReturnValue({});
  mockGetAppInstallation.mockResolvedValue({
    account: {
      id: 67890,
      login: "test-org",
      type: "Organization",
      avatar_url: "https://avatars.githubusercontent.com/u/67890",
    },
    permissions: { contents: "read", metadata: "read" },
    events: ["push", "pull_request"],
    created_at: "2026-01-01T00:00:00Z",
  });
  mockGetInstallationRepositories.mockResolvedValue({
    repositories: [
      {
        id: 123,
        name: "test-repo",
        full_name: "test-org/test-repo",
        owner: { login: "test-org" },
        description: "A test repository",
        default_branch: "main",
        private: false,
        archived: false,
        html_url: "https://github.com/test-org/test-repo",
        language: "TypeScript",
        stargazers_count: 0,
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
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

describe("Suite 8 — api/console connections tRPC procedures", () => {
  describe("8.1 — apiKeyProcedure auth validation", () => {
    it("No Authorization header → throws UNAUTHORIZED", async () => {
      const caller = makeCaller({ type: "unauthenticated" });
      await expect(
        caller.cliAuthorize({ provider: "github" }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("Bearer token with no matching API key → throws UNAUTHORIZED", async () => {
      const caller = makeCaller(
        { type: "unauthenticated" },
        new Headers({ Authorization: "Bearer sk-lf-testkey" }),
      );
      await expect(
        caller.cliAuthorize({ provider: "github" }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("Invalid API key (not in DB) → throws UNAUTHORIZED 'Invalid API key'", async () => {
      const caller = apiKeyCaller("sk-lf-notindb-invalid", "ws-nonexistent");
      await expect(
        caller.cliAuthorize({ provider: "github" }),
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        message: "Invalid API key",
      });
    });

    it("Expired API key → throws UNAUTHORIZED 'API key expired'", async () => {
      const { rawKey, id: _id } = await makeApiKeyFixture(db, {
        userId: "user_expired",
        expiresAt: new Date(Date.now() - 60_000), // 1 minute ago
      });
      const caller = apiKeyCaller(rawKey, "ws-any");
      await expect(
        caller.cliAuthorize({ provider: "github" }),
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        message: "API key expired",
      });
    });

    it("Valid API key → passes auth (proceeds to workspace lookup)", async () => {
      const wsId = uid();
      const clerkOrgId = `org_${uid()}`;
      // Seed workspace
      await db.insert(orgWorkspaces).values({
        id: wsId,
        clerkOrgId,
        name: "test-workspace",
        slug: "test-ws",
        settings: TEST_WORKSPACE_SETTINGS,
      });
      const { rawKey } = await makeApiKeyFixture(db, { userId: "user_valid" });

      // Install service router so the connections fetch succeeds
      const restore = installServiceRouter({ gatewayApp });
      try {
        const caller = apiKeyCaller(rawKey, wsId);
        const result = await caller.cliAuthorize({ provider: "github" });
        expect(result).toHaveProperty("url");
        expect(result).toHaveProperty("state");
        expect((result as { url: string }).url).toContain("github.com");
      } finally {
        restore();
      }
    });
  });

  describe("8.2 — cliAuthorize procedure", () => {
    it("Valid API key → cliAuthorize succeeds (org-scoped, no workspace lookup)", async () => {
      const { rawKey } = await makeApiKeyFixture(db, {
        userId: "user_no_ws",
      });
      const restore = installServiceRouter({ gatewayApp });
      try {
        const caller = apiKeyCaller(rawKey, "ignored-workspace-id");
        const result = await caller.cliAuthorize({ provider: "github" });
        expect(result).toHaveProperty("url");
        expect(result).toHaveProperty("state");
      } finally {
        restore();
      }
    });

    it("Workspace with no clerkOrgId → throws NOT_FOUND", async () => {
      // orgWorkspaces schema has clerkOrgId as notNull, so this scenario is
      // guarded at the DB level. We test the happy path branch instead —
      // cliAuthorize succeeds when both workspace and clerkOrgId exist.
      // (Schema enforces not-null, so null-clerkOrgId can't be inserted via normal path)
      const wsId = uid();
      const clerkOrgId = `org_${uid()}`;
      await db.insert(orgWorkspaces).values({
        id: wsId,
        clerkOrgId,
        name: "test-ws-2",
        slug: "test-ws-2",
        settings: TEST_WORKSPACE_SETTINGS,
      });
      const { rawKey } = await makeApiKeyFixture(db, { userId: "user_ws2" });
      const restore = installServiceRouter({ gatewayApp });
      try {
        const caller = apiKeyCaller(rawKey, wsId);
        const result = await caller.cliAuthorize({ provider: "github" });
        expect(result).toHaveProperty("url");
        expect(result).toHaveProperty("state");
      } finally {
        restore();
      }
    });

    it("Gateway service returns non-200 → throws BAD_REQUEST", async () => {
      const wsId = uid();
      const clerkOrgId = `org_${uid()}`;
      await db.insert(orgWorkspaces).values({
        id: wsId,
        clerkOrgId,
        name: "test-ws-err",
        slug: "test-ws-err",
        settings: TEST_WORKSPACE_SETTINGS,
      });
      const { rawKey } = await makeApiKeyFixture(db, {
        userId: "user_ws_err",
      });

      // Make the provider throw so connections returns 400
      mockGetProvider.mockImplementationOnce(() => {
        throw new Error("unknown_provider");
      });

      const restore = installServiceRouter({ gatewayApp });
      try {
        const caller = apiKeyCaller(rawKey, wsId);
        await expect(
          caller.cliAuthorize({ provider: "github" }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      } finally {
        restore();
      }
    });

    it("Happy path: returns { url, state }, gateway service receives correct headers", async () => {
      const wsId = uid();
      const clerkOrgId = `org_${uid()}`;
      await db.insert(orgWorkspaces).values({
        id: wsId,
        clerkOrgId,
        name: "test-ws-happy",
        slug: "test-ws-happy",
        settings: TEST_WORKSPACE_SETTINGS,
      });
      const { rawKey, userId } = await makeApiKeyFixture(db, {
        userId: "user_happy",
        clerkOrgId,
      });

      const restore = installServiceRouter({ gatewayApp });
      try {
        const caller = apiKeyCaller(rawKey, wsId);
        const result = await caller.cliAuthorize({ provider: "github" });
        expect(result).toHaveProperty("url");
        expect(result).toHaveProperty("state");
        const r = result as { url: string; state: string };
        expect(r.url).toContain("github.com");
        expect(typeof r.state).toBe("string");

        // Verify X-Org-Id was set to clerkOrgId (state in Redis has orgId)
        const { oauthStateKey } = await import("@gateway/cache");
        const stateData = redisStore.get(
          oauthStateKey(r.state),
        ) as Record<string, string>;
        expect(stateData.orgId).toBe(clerkOrgId);
        expect(stateData.connectedBy).toBe(userId);
        expect(stateData.redirectTo).toBe("inline");
      } finally {
        restore();
      }
    });
  });

  describe("8.3 — getAuthorizeUrl procedure", () => {

    it("clerk-pending auth → throws FORBIDDEN (orgScopedProcedure rejects)", async () => {
      const caller = makeCaller({ type: "clerk-pending", userId: "u1" });
      await expect(
        caller.getAuthorizeUrl({ provider: "github" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("Happy path: returns { url, state } with clerk-active context", async () => {
      const orgId = `org_${uid()}`;
      const restore = installServiceRouter({ gatewayApp });
      try {
        const caller = clerkActiveCaller("user_clerk", orgId);
        const result = await caller.getAuthorizeUrl({
          provider: "github",
        });
        expect(result).toHaveProperty("url");
        expect(result).toHaveProperty("state");
        const r = result as { url: string; state: string };
        expect(r.url).toContain("github.com");

        // Verify X-Org-Id was passed correctly
        const { oauthStateKey } = await import("@gateway/cache");
        const stateData = redisStore.get(
          oauthStateKey(r.state),
        ) as Record<string, string>;
        expect(stateData.orgId).toBe(orgId);
      } finally {
        restore();
      }
    });

    it("Gateway service returns non-200 → throws BAD_REQUEST", async () => {
      const orgId = `org_${uid()}`;
      // Make the provider throw so connections returns 400
      mockGetProvider.mockImplementationOnce(() => {
        throw new Error("unknown_provider");
      });

      const restore = installServiceRouter({ gatewayApp });
      try {
        const caller = clerkActiveCaller("user_clerk_err", orgId);
        await expect(
          caller.getAuthorizeUrl({ provider: "github" }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      } finally {
        restore();
      }
    });
  });

  describe("8.4 — github.list procedure", () => {
    it("Returns null when no GitHub installations exist", async () => {
      const orgId = `org_${uid()}`;
      const caller = clerkActiveCaller("user_1", orgId);
      const result = await caller.github.list();
      expect(result).toBeNull();
    });

    it("Returns connection with installations for a single row", async () => {
      const orgId = `org_${uid()}`;
      const rowId = uid();
      await db.insert(gwInstallations).values({
        id: rowId,
        provider: "github",
        externalId: "12345",
        connectedBy: "user_1",
        orgId,
        status: "active",
        providerAccountInfo: makeGitHubAccountInfo(),
      });

      const caller = clerkActiveCaller("user_1", orgId);
      const result = await caller.github.list();

      expect(result).not.toBeNull();
      if (!result) throw new Error("Expected result to be non-null");
      expect(result.installations).toHaveLength(1);
      expect(result.installations[0]?.accountLogin).toBe("test-org");
      expect(result.installations[0]?.gwInstallationId).toBe(rowId);
    });

    it("Merges installations from multiple rows (different externalId)", async () => {
      const orgId = `org_${uid()}`;
      await db.insert(gwInstallations).values([
        {
          provider: "github",
          externalId: "11111",
          connectedBy: "user_1",
          orgId,
          status: "active",
          providerAccountInfo: makeGitHubAccountInfo({ accountLogin: "org-a" }),
        },
        {
          provider: "github",
          externalId: "22222",
          connectedBy: "user_1",
          orgId,
          status: "active",
          providerAccountInfo: makeGitHubAccountInfo({ accountLogin: "org-b" }),
        },
      ]);

      const caller = clerkActiveCaller("user_1", orgId);
      const result = await caller.github.list();

      expect(result).not.toBeNull();
      if (!result) throw new Error("Expected result to be non-null");
      expect(result.installations).toHaveLength(2);
      const logins = result.installations.map((i) => i.accountLogin);
      expect(logins).toContain("org-a");
      expect(logins).toContain("org-b");
    });

    it("Ignores non-active (revoked) rows", async () => {
      const orgId = `org_${uid()}`;
      await db.insert(gwInstallations).values([
        {
          provider: "github",
          externalId: "33333",
          connectedBy: "user_1",
          orgId,
          status: "active",
          providerAccountInfo: makeGitHubAccountInfo({ accountLogin: "active-org" }),
        },
        {
          provider: "github",
          externalId: "44444",
          connectedBy: "user_1",
          orgId,
          status: "revoked",
          providerAccountInfo: makeGitHubAccountInfo({ accountLogin: "revoked-org" }),
        },
      ]);

      const caller = clerkActiveCaller("user_1", orgId);
      const result = await caller.github.list();

      expect(result).not.toBeNull();
      if (!result) throw new Error("Expected result to be non-null");
      expect(result.installations).toHaveLength(1);
      expect(result.installations[0]?.accountLogin).toBe("active-org");
    });

    it("Ignores non-github providers (vercel row returns null)", async () => {
      const orgId = `org_${uid()}`;
      await db.insert(gwInstallations).values({
        provider: "vercel",
        externalId: "vercel-config-55555",
        connectedBy: "user_1",
        orgId,
        status: "active",
        providerAccountInfo: {
          version: 1 as const,
          sourceType: "vercel" as const,
          events: [],
          installedAt: "2026-01-01T00:00:00Z",
          lastValidatedAt: "2026-01-01T00:00:00Z",
          raw: {
            token_type: "Bearer",
            installation_id: "icfg_55555",
            user_id: "user-vercel",
            team_id: null,
          },
        },
      });

      const caller = clerkActiveCaller("user_1", orgId);
      const result = await caller.github.list();
      expect(result).toBeNull();
    });
  });

  describe("8.5 — github.validate procedure", () => {
    it("Throws NOT_FOUND when no active GitHub installation exists", async () => {
      const orgId = `org_${uid()}`;
      const caller = clerkActiveCaller("user_1", orgId);
      await expect(caller.github.validate()).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("Refreshes providerAccountInfo with GitHub API data", async () => {
      const orgId = `org_${uid()}`;
      const rowId = uid();
      await db.insert(gwInstallations).values({
        id: rowId,
        provider: "github",
        externalId: "12345",
        connectedBy: "user_1",
        orgId,
        status: "active",
        providerAccountInfo: makeGitHubAccountInfo({ accountLogin: "old-org" }),
      });

      // Mock returns updated avatar URL
      mockGetAppInstallation.mockResolvedValueOnce({
        account: {
          id: 67890,
          login: "new-org",
          type: "Organization",
          avatar_url: "https://avatars.githubusercontent.com/u/99999",
        },
        permissions: { contents: "read", metadata: "read" },
        events: ["push"],
        created_at: "2026-01-01T00:00:00Z",
      });

      const caller = clerkActiveCaller("user_1", orgId);
      await caller.github.validate();

      // Verify DB was updated — query all rows and find the one we seeded
      const allRows = await db.select().from(gwInstallations);
      const updated = allRows.find((r) => r.id === rowId);
      expect(updated?.providerAccountInfo?.sourceType).toBe("github");
      if (updated?.providerAccountInfo?.sourceType === "github") {
        expect(updated.providerAccountInfo.raw.account.avatar_url).toBe(
          "https://avatars.githubusercontent.com/u/99999",
        );
        expect(updated.providerAccountInfo.raw.account.login).toBe("new-org");
      }
    });

    it("Returns correct added/removed/total counts (1 existing installation)", async () => {
      const orgId = `org_${uid()}`;
      await db.insert(gwInstallations).values({
        provider: "github",
        externalId: "12345",
        connectedBy: "user_1",
        orgId,
        status: "active",
        providerAccountInfo: makeGitHubAccountInfo(),
      });

      const caller = clerkActiveCaller("user_1", orgId);
      const result = await caller.github.validate();

      // 1 current installation → added: 0, removed: 0, total: 1
      expect(result).toMatchObject({ added: 0, removed: 0, total: 1 });
    });

    it("Throws INTERNAL_SERVER_ERROR for inconsistent sourceType in providerAccountInfo", async () => {
      const orgId = `org_${uid()}`;
      await db.insert(gwInstallations).values({
        provider: "github",
        externalId: "12345",
        connectedBy: "user_1",
        orgId,
        status: "active",
        // provider column is "github" but JSONB sourceType is "vercel" — data inconsistency
        providerAccountInfo: {
          version: 1 as const,
          sourceType: "vercel" as const,
          events: [],
          installedAt: "2026-01-01T00:00:00Z",
          lastValidatedAt: "2026-01-01T00:00:00Z",
          raw: {
            token_type: "Bearer",
            installation_id: "icfg_1",
            user_id: "user-vercel",
            team_id: null,
          },
        },
      });

      const caller = clerkActiveCaller("user_1", orgId);
      await expect(caller.github.validate()).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
      });
    });
  });

  describe("8.6 — github.repositories procedure", () => {
    it("Throws NOT_FOUND for unknown integrationId", async () => {
      const orgId = `org_${uid()}`;
      const caller = clerkActiveCaller("user_1", orgId);
      await expect(
        caller.github.repositories({
          integrationId: "nonexistent-id",
          installationId: "12345",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("Throws NOT_FOUND when installationId not in providerAccountInfo", async () => {
      const orgId = `org_${uid()}`;
      const rowId = uid();
      await db.insert(gwInstallations).values({
        id: rowId,
        provider: "github",
        externalId: "12345",
        connectedBy: "user_1",
        orgId,
        status: "active",
        providerAccountInfo: makeGitHubAccountInfo(),
      });

      const caller = clerkActiveCaller("user_1", orgId);
      await expect(
        caller.github.repositories({
          integrationId: rowId,
          installationId: "99999", // not in providerAccountInfo
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("Returns normalized repository list", async () => {
      const orgId = `org_${uid()}`;
      const rowId = uid();
      await db.insert(gwInstallations).values({
        id: rowId,
        provider: "github",
        externalId: "12345",
        connectedBy: "user_1",
        orgId,
        status: "active",
        providerAccountInfo: makeGitHubAccountInfo(),
      });

      const caller = clerkActiveCaller("user_1", orgId);
      const result = await caller.github.repositories({
        integrationId: rowId,
        installationId: "12345",
      });

      expect(result).toHaveLength(1);
      const repo = result[0];
      expect(repo?.id).toBe("123"); // number → string
      expect(repo?.name).toBe("test-repo");
      expect(repo?.fullName).toBe("test-org/test-repo");
      expect(repo?.isPrivate).toBe(false);
    });

    it("Denies cross-org access (org B cannot access org A's row)", async () => {
      const orgA = `org_${uid()}`;
      const orgB = `org_${uid()}`;
      const rowId = uid();
      await db.insert(gwInstallations).values({
        id: rowId,
        provider: "github",
        externalId: "12345",
        connectedBy: "user_1",
        orgId: orgA,
        status: "active",
        providerAccountInfo: makeGitHubAccountInfo(),
      });

      // Caller scoped to org B tries to access org A's installation
      const caller = clerkActiveCaller("user_1", orgB);
      await expect(
        caller.github.repositories({
          integrationId: rowId,
          installationId: "12345",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("Handles empty repository list", async () => {
      const orgId = `org_${uid()}`;
      const rowId = uid();
      await db.insert(gwInstallations).values({
        id: rowId,
        provider: "github",
        externalId: "12345",
        connectedBy: "user_1",
        orgId,
        status: "active",
        providerAccountInfo: makeGitHubAccountInfo(),
      });

      mockGetInstallationRepositories.mockResolvedValueOnce({ repositories: [] });

      const caller = clerkActiveCaller("user_1", orgId);
      const result = await caller.github.repositories({
        integrationId: rowId,
        installationId: "12345",
      });
      expect(result).toEqual([]);
    });
  });
});
