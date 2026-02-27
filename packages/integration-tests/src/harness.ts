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
 *
 * All methods operate on the shared `store` Map, so writes from one app are
 * immediately visible to reads in another app — simulating a shared Redis.
 */
export function makeRedisMock(store: Map<string, unknown>) {
  const mock = {
    hset: vi.fn((key: string, fields: Record<string, unknown>) => {
      const existing = (store.get(key) as Record<string, unknown>) ?? {};
      store.set(key, { ...existing, ...fields });
      return Promise.resolve(1);
    }),
    hgetall: vi.fn(<T = Record<string, string>>(key: string): Promise<T | null> => {
      const val = store.get(key);
      return Promise.resolve((val as T) ?? null);
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
      const allKeys = keys.flat() as string[];
      let count = 0;
      for (const k of allKeys) {
        if (store.delete(k)) count++;
      }
      return Promise.resolve(count);
    }),
    expire: vi.fn(() => Promise.resolve(1)),
    pipeline: vi.fn(() => {
      // Lazy-evaluated pipeline — stores ops and runs them in exec()
      const ops: Array<() => void> = [];
      const pipe = {
        hset: vi.fn((key: string, fields: Record<string, unknown>) => {
          ops.push(() => {
            const existing = (store.get(key) as Record<string, unknown>) ?? {};
            store.set(key, { ...existing, ...fields });
          });
          return pipe;
        }),
        expire: vi.fn(() => {
          // TTLs not tracked in the in-memory mock
          return pipe;
        }),
        exec: vi.fn(async () => {
          ops.forEach((op) => op());
          return [];
        }),
      };
      return pipe;
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
export type QStashMessage = {
  url: string;
  body: unknown;
  headers?: Record<string, string>;
};

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
export type InngestEvent = { name: string; data: unknown };

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
export interface ServiceApps {
  connectionsApp?: Hono;
  backfillApp?: Hono;
  gatewayApp?: Hono;
}

export function installServiceRouter(apps: ServiceApps): () => void {
  const { connectionsApp, backfillApp, gatewayApp } = apps;

  const portToApp: Record<string, Hono | undefined> = {
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

    // Forward to Hono's in-process request handler
    return app.request(url.pathname + url.search, init);
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
  faults: Array<{ afterStep: string; advanceMs: number }>,
): ReturnType<typeof makeStep> {
  const originalRun = step.run as ReturnType<typeof vi.fn>;
  const wrappedRun = vi.fn(async (name: string, fn: () => unknown) => {
    const result = await originalRun(name, fn);
    const fault = faults.find((f) => f.afterStep === name);
    if (fault) {
      vi.advanceTimersByTime(fault.advanceMs);
    }
    return result;
  });
  return { ...step, run: wrappedRun };
}
