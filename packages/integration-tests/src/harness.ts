/**
 * Shared test harness for cross-service integration tests.
 *
 * Provides in-memory implementations of all external dependencies that the
 * three apps share:
 *   - PGlite (replaces @db/console / PlanetScale)
 *   - In-memory Redis Map (replaces @vendor/upstash / Upstash Redis)
 *   - QStash capture mock (replaces @vendor/qstash / Upstash QStash)
 *   - Inngest handler capture (replaces @vendor/inngest)
 *   - Service mesh fetch router (routes localhost:* URLs to Hono app.request())
 *
 * Usage in a test file:
 *
 *   import { makeRedisMock, makeQStashMock, makeServiceRouter } from "../harness.js";
 *
 * Each test file still needs its own vi.hoisted() + vi.mock() declarations.
 * Import only what you need from this module.
 */

import type { TestDb } from "@repo/console-test-db";
import { vi } from "vitest";
import type { Hono } from "hono";

export type { TestDb };

/**
 * Creates an in-memory Redis mock backed by a Map.
 *
 * Implements the subset of @upstash/redis operations used by the three apps:
 * - hset, hgetall
 * - set (with nx + ex options), get
 * - del (variadic)
 * - expire
 * - pipeline (chaining: hset, expire, exec — for connections.authorize)
 * - multi (chaining: hgetall, del, exec — for connections.resolveAndConsumeState)
 *
 * All methods operate on the shared `store` Map, so writes from one app are
 * immediately visible to reads in another app — simulating a shared Redis.
 */
export function makeRedisMock(store: Map<string, unknown>) {
  const mock = {
    hset: vi.fn((key: string, fields: Record<string, unknown>) => {
      const existing = (store.get(key) ?? {}) as Record<string, unknown>;
      store.set(key, { ...existing, ...fields });
      return Promise.resolve(1);
    }),
    hgetall: vi.fn(<T = Record<string, string>>(key: string): Promise<T | null> => {
      const val = store.get(key);
      return Promise.resolve((val ?? null) as T | null);
    }),
    set: vi.fn(
      (
        key: string,
        value: unknown,
        opts?: { nx?: boolean; ex?: number },
      ): Promise<"OK" | null> => {
        if (opts?.nx && store.has(key)) return Promise.resolve(null);
        store.set(key, value);
        return Promise.resolve("OK");
      },
    ),
    get: vi.fn(<T = unknown>(key: string): Promise<T | null> => {
      return Promise.resolve((store.get(key) as T) ?? null);
    }),
    del: vi.fn((...keys: string[]): Promise<number> => {
      // Supports both del("k1", "k2") and del(["k1", "k2"]) call styles
      const allKeys = keys.flat();
      let count = 0;
      for (const k of allKeys) {
        if (store.delete(k)) count++;
      }
      return Promise.resolve(count);
    }),
    expire: vi.fn(() => Promise.resolve(1)),
    pipeline: vi.fn(() => {
      // Lazy-evaluated pipeline — stores ops and runs them in exec()
      const ops: (() => void)[] = [];
      const pipe = {
        hset: vi.fn((key: string, fields: Record<string, unknown>) => {
          ops.push(() => {
            const existing = (store.get(key) ?? {}) as Record<string, unknown>;
            store.set(key, { ...existing, ...fields });
          });
          return pipe;
        }),
        expire: vi.fn(() => {
          // TTLs not tracked in the in-memory mock
          return pipe;
        }),
        exec: vi.fn(() => {
          ops.forEach((op) => op());
          return [];
        }),
      };
      return pipe;
    }),
    multi: vi.fn(() => {
      // Transactional multi — collects ops, returns results array from exec()
      // Used by resolveAndConsumeState: redis.multi().hgetall(key).del(key).exec()
      const ops: (() => unknown)[] = [];
      const chain = {
        hgetall: vi.fn((key: string) => {
          ops.push(() => store.get(key) ?? null);
          return chain;
        }),
        del: vi.fn((...keys: string[]) => {
          ops.push(() => {
            const allKeys = keys.flat();
            let count = 0;
            for (const k of allKeys) {
              if (store.delete(k)) count++;
            }
            return count;
          });
          return chain;
        }),
        hset: vi.fn((key: string, fields: Record<string, unknown>) => {
          ops.push(() => {
            const existing = (store.get(key) ?? {}) as Record<string, unknown>;
            store.set(key, { ...existing, ...fields });
            return 1;
          });
          return chain;
        }),
        expire: vi.fn(() => {
          ops.push(() => 1);
          return chain;
        }),
        exec: vi.fn(() => {
          return Promise.resolve(ops.map((op) => op()));
        }),
      };
      return chain;
    }),
  };
  return mock;
}

export type RedisMock = ReturnType<typeof makeRedisMock>;

/**
 * Captures QStash messages instead of publishing them.
 *
 * Records every `publishJSON` call in `messages` for assertion.
 * `publishToTopic` is a no-op stub (used by gateway DLQ path).
 */
export interface QStashMessage {
  url: string;
  body: unknown;
  headers?: Record<string, string>;
}

export function makeQStashMock(messages: QStashMessage[]) {
  return {
    publishJSON: vi.fn(
      (opts: { url: string; body: unknown; headers?: Record<string, string> }) => {
        messages.push({ url: opts.url, body: opts.body, headers: opts.headers });
        return Promise.resolve({ messageId: `msg-${Date.now()}-${Math.random()}` });
      },
    ),
    publishToTopic: vi.fn(() =>
      Promise.resolve([{ messageId: `dlq-${Date.now()}` }]),
    ),
    publish: vi.fn(() => Promise.resolve({ messageId: `pub-${Date.now()}` })),
  };
}

export type QStashMock = ReturnType<typeof makeQStashMock>;

/**
 * Captures Inngest events and workflow handlers.
 *
 * - `inngest.send(event)` → appends to `events` array
 * - `inngest.createFunction(config, trigger, handler)` → stores handler by ID
 *   so integration tests can invoke workflow logic directly
 *
 * The `capturedHandlers` map is keyed by function ID from createFunction config.
 */
export interface InngestEvent { name: string; data: unknown }

export function makeInngestMock(
  events: InngestEvent[],
  capturedHandlers: Map<string, (args: { event: unknown; step: unknown }) => Promise<unknown>>,
) {
  const inngestInstance = {
    send: vi.fn((event: InngestEvent | InngestEvent[]) => {
      const all = Array.isArray(event) ? event : [event];
      events.push(...all);
      return Promise.resolve({ ids: all.map((_, i) => `evt-${i}`) });
    }),
    createFunction: vi.fn(
      (
        config: { id: string },
        _trigger: unknown,
        handler: (args: { event: unknown; step: unknown }) => Promise<unknown>,
      ) => {
        capturedHandlers.set(config.id, handler);
        return { id: config.id };
      },
    ),
  };
  return inngestInstance;
}

/**
 * Service mesh fetch router.
 *
 * Stubs `globalThis.fetch` to route requests from backfill/connections/gateway
 * to in-process Hono apps instead of making real network calls.
 *
 * Port mapping (matches related-projects defaults):
 *   localhost:4108 → gatewayApp
 *   localhost:4109 → backfillApp
 *   localhost:4110 → connectionsApp
 *
 * Usage:
 *   const restore = installServiceRouter({ connectionsApp, gatewayApp, backfillApp });
 *   // ... run tests
 *   restore(); // restore original fetch
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHono = Hono<any>;

export interface ServiceApps {
  connectionsApp?: AnyHono;
  backfillApp?: AnyHono;
  gatewayApp?: AnyHono;
}

export function installServiceRouter(apps: ServiceApps): () => void {
  const { connectionsApp, backfillApp, gatewayApp } = apps;

  const portToApp: Record<string, AnyHono | undefined> = {
    "4108": gatewayApp,
    "4109": backfillApp,
    "4110": connectionsApp,
  };

  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const port = url.port;
    const app = portToApp[port];

    if (!app) {
      throw new Error(
        `[serviceRouter] No app registered for port ${port}. URL: ${url.toString()}`,
      );
    }

    // The connections app mounts routes at /services/connections/*.
    // When the tRPC console router calls it directly (via connectionsUrl that has no
    // /services prefix), the path arrives as /connections/... — we need to prepend
    // /services so it matches the Hono router.  Paths that already start with
    // /services/ (e.g. from the backfill orchestrator) are forwarded unchanged.
    let appPath = url.pathname + url.search;
    if (app === connectionsApp && !appPath.startsWith("/services/")) {
      appPath = "/services" + appPath;
    }

    // Forward to Hono's in-process request handler
    return app.request(appPath, init);
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}

/**
 * Creates a step mock for Inngest workflow testing.
 *
 * `step.run(name, fn)` executes `fn()` immediately (no deferral).
 * `step.sendEvent`, `step.waitForEvent`, `step.sleep` are vi.fn() stubs.
 *
 * @param overrides - Override individual step methods (e.g. to simulate waitForEvent returning a specific event)
 */
export function makeStep(
  overrides: Partial<{
    run: ReturnType<typeof vi.fn>;
    sendEvent: ReturnType<typeof vi.fn>;
    waitForEvent: ReturnType<typeof vi.fn>;
    sleep: ReturnType<typeof vi.fn>;
  }> = {},
) {
  return {
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
    sendEvent: vi.fn().mockResolvedValue(undefined),
    waitForEvent: vi.fn().mockResolvedValue(null),
    sleep: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Temporal fault decorator for step mocks.
 *
 * Wraps a step mock to advance vi.useFakeTimers() by a specified amount
 * after named steps complete. Useful for testing time-based expiry scenarios:
 * - Token expiry mid-pagination: advance 55+ minutes after "get-token"
 * - Redis cache TTL expiry: advance 25+ hours during a long backfill
 * - OAuth state TTL expiry: advance 601+ seconds during OAuth flow
 *
 * Requires vi.useFakeTimers() to be active in the calling test.
 *
 * @example
 *   vi.useFakeTimers();
 *   const step = withTimeFaults(makeStep(), [
 *     { afterStep: "get-token", advanceMs: 55 * 60_000 },
 *   ]);
 *   await entityHandler({ event, step });
 *   // Connector will receive an expired token and throw 401 mid-pagination
 */
export function withTimeFaults(
  step: ReturnType<typeof makeStep>,
  faults: { afterStep: string; advanceMs: number }[],
): ReturnType<typeof makeStep> {
  const originalRun = step.run;
  const wrappedRun = vi.fn(async (name: string, fn: () => unknown) => {
    const result: unknown = await originalRun(name, fn);
    const fault = faults.find((f) => f.afterStep === name);
    if (fault) {
      vi.advanceTimersByTime(fault.advanceMs);
    }
    return result;
  });
  return { ...step, run: wrappedRun };
}

/**
 * Minimal valid WorkspaceSettings for test fixtures.
 *
 * The orgWorkspaces.settings column requires a specific versioned JSONB structure.
 * Tests that need to insert workspaces should use this constant for the settings field
 * rather than `{}` (which fails TypeScript type checking).
 */
export const TEST_WORKSPACE_SETTINGS = {
  version: 1 as const,
  embedding: {
    indexName: "test-index",
    namespaceName: "test-namespace",
    embeddingDim: 1024,
    embeddingModel: "embed-english-v3.0",
    embeddingProvider: "cohere",
    pineconeMetric: "cosine",
    pineconeCloud: "aws",
    pineconeRegion: "us-east-1",
    chunkMaxTokens: 512,
    chunkOverlap: 50,
  },
};

/**
 * Creates a test API key in the database and returns the raw key + DB record.
 *
 * Used by Suite 8/9 tRPC tests to seed orgApiKeys for apiKeyProcedure tests.
 * Keys are org-scoped — no workspaceId required.
 *
 * Usage:
 *   const { rawKey, publicId } = await makeApiKeyFixture(db, {
 *     userId: "user_1", clerkOrgId: "org_1",
 *   });
 *   headers: { Authorization: `Bearer ${rawKey}` }
 */
export interface ApiKeyFixture {
  rawKey: string;       // "sk-lf-<nanoid>" — use in Authorization header
  id: string;           // alias for publicId
  publicId: string;
  clerkOrgId: string;
  userId: string;       // alias for createdByUserId
  createdByUserId: string;
  keyHash: string;
  keyPrefix: string;
  keySuffix: string;
  isActive: boolean;
  expiresAt: string | null;
}

export async function makeApiKeyFixture(
  db: TestDb,
  overrides: {
    userId: string;
    clerkOrgId?: string;
    isActive?: boolean;
    expiresAt?: Date | null;
  },
): Promise<ApiKeyFixture> {
  const { generateApiKey, hashApiKey } = await import("@repo/console-api-key");
  const { orgApiKeys } = await import("@db/console/schema");

  // Use crypto.randomUUID for unique IDs — avoids importing @repo/lib which isn't a direct dep
  const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 21);

  const rawKey = generateApiKey();
  const keyHash = await hashApiKey(rawKey);
  const expiresAtRaw = overrides.expiresAt;
  const expiresAt =
    expiresAtRaw instanceof Date
      ? expiresAtRaw.toISOString()
      : null;

  const publicId = uid();
  const clerkOrgId = overrides.clerkOrgId ?? `org_test_${uid()}`;

  const record = {
    publicId,
    clerkOrgId,
    createdByUserId: overrides.userId,
    name: "test-key",
    keyHash,
    keyPrefix: "sk-lf-",
    keySuffix: rawKey.slice(-4),
    isActive: overrides.isActive ?? true,
    expiresAt,
  };

  await db.insert(orgApiKeys).values(record);
  return {
    rawKey,
    id: publicId,
    userId: overrides.userId,
    ...record,
  };
}

/**
 * Event-ordering permutation engine.
 *
 * Inspired by FoundationDB / TigerBeetle deterministic simulation testing,
 * applied at the service-mesh layer.
 *
 * Given N concurrent side-effects (QStash deliveries, Inngest events, DB
 * mutations, Redis ops), runs every permutation of their delivery order and
 * asserts a final-state invariant after each.  If the invariant holds for all
 * N! orderings the system is provably order-independent for that scenario.
 *
 * For N > 5 (120 permutations), a random sample is drawn instead of
 * exhaustive enumeration.
 *
 * @example
 *   const result = await withEventPermutations({
 *     setup:  async () => { await db.insert(gwInstallations).values(inst); },
 *     effects: [
 *       { label: "cancel-backfill", deliver: async () => { ... } },
 *       { label: "clear-redis",     deliver: async () => { ... } },
 *       { label: "soft-delete-db",  deliver: async () => { ... } },
 *     ],
 *     invariant: async () => {
 *       expect(redisStore.has(key)).toBe(false);
 *       expect(instRow.status).toBe("revoked");
 *     },
 *     reset: async () => { await resetTestDb(); redisStore.clear(); },
 *   });
 *   expect(result.failures).toHaveLength(0);
 *   expect(result.permutationsRun).toBe(6); // 3! = 6
 */

export interface LabeledEffect {
  label: string;
  deliver: () => void | Promise<void>;
}

export interface PermutationResult {
  permutationsRun: number;
  passed: number;
  failures: {
    ordering: string[];
    error: Error;
  }[];
}

export interface PermutationConfig {
  /** Re-seed DB / Redis / mock state before each permutation */
  setup: () => void | Promise<void>;
  /** Concurrent effects whose delivery order will be permuted */
  effects: LabeledEffect[];
  /** Assert final-state correctness — called after all effects delivered */
  invariant: () => void | Promise<void>;
  /** Tear down state between permutations (TRUNCATE, store.clear, etc.) */
  reset: () => void | Promise<void>;
  /** Max permutations to run.  Default 120 (= 5!).  Random sample if N! exceeds this. */
  maxRuns?: number;
}

function* generatePermutations<T>(arr: T[]): Generator<T[]> {
  if (arr.length <= 1) {
    yield [...arr];
    return;
  }
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (item === undefined) continue;
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of generatePermutations(rest)) {
      yield [item, ...perm];
    }
  }
}

export async function withEventPermutations(
  config: PermutationConfig,
): Promise<PermutationResult> {
  const { setup, effects, invariant, reset, maxRuns = 120 } = config;

  const allPerms = [...generatePermutations(effects)];

  let permsToRun: typeof allPerms;
  if (allPerms.length <= maxRuns) {
    permsToRun = allPerms;
  } else {
    // Fisher-Yates shuffle, then take first maxRuns
    const shuffled = [...allPerms];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const a = shuffled[i];
      const b = shuffled[j];
      if (a !== undefined && b !== undefined) {
        shuffled[i] = b;
        shuffled[j] = a;
      }
    }
    permsToRun = shuffled.slice(0, maxRuns);
  }

  const result: PermutationResult = {
    permutationsRun: permsToRun.length,
    passed: 0,
    failures: [],
  };

  for (const perm of permsToRun) {
    await reset();
    await setup();

    try {
      for (const effect of perm) {
        await effect.deliver();
      }
      await invariant();
      result.passed++;
    } catch (error) {
      result.failures.push({
        ordering: perm.map((e) => e.label),
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  return result;
}
