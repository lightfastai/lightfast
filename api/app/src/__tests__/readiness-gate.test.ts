import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthContext, AuthReadiness } from "../auth/context";

// Stub the vendor surface so importing trpc.ts (which imports resolveAuth) does
// not pull real Clerk env or hit Postgres. The tests bypass `resolveAuth`
// entirely by feeding a stub context into the caller / handler.
vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));

vi.mock("@vendor/clerk/server", () => ({
  auth: vi.fn(),
  verifyToken: vi.fn(),
  getUserOrgMemberships: vi.fn(),
}));

vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("../auth/lightfast-tasks/repo", () => ({
  listClearedTasks: vi.fn(),
  markTaskCleared: vi.fn(),
}));

const logInfoMock = vi.fn();
vi.mock("@vendor/observability/log/next", () => ({
  log: { info: (...args: unknown[]) => logInfoMock(...args) },
}));

// Bypass the observability middleware's request-timing telemetry so it does
// not require a real configuration shim in the test harness.
vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    async ({ next }: { next: () => Promise<unknown> }) =>
      next(),
}));

const {
  activeIdentityProcedure,
  createCallerFactory,
  createTRPCRouter,
  pendingNotAllowedProcedure,
} = await import("../trpc");

// Minimal test surface — one procedure per ladder rung so the assertions can
// isolate which gate fired. Handlers return a sentinel so success paths are
// distinguishable from accidental rejection.
const testRouter = createTRPCRouter({
  fullyReady: pendingNotAllowedProcedure.query(() => "ok-ready"),
  activeOnly: activeIdentityProcedure.query(() => "ok-active"),
});

const createCaller = createCallerFactory(testRouter);

function makeCtx(auth: AuthContext) {
  return { auth, db: {}, headers: new Headers() } as never;
}

const ACTIVE_USER = "user_active";
const ACTIVE_ORG = "org_active";

const ACTIVE_IDENTITY = {
  type: "active",
  userId: ACTIVE_USER,
  orgId: ACTIVE_ORG,
} as const;

const PENDING_IDENTITY = {
  type: "pending",
  userId: "user_pending",
} as const;

// Declared as `AuthReadiness` (not `as const`) so the `remaining` array stays
// mutable and slots into AuthContext without a readonly-vs-mutable mismatch.
const READINESS_PENDING: AuthReadiness = {
  type: "pending",
  current: "connect-github",
  remaining: ["connect-github"],
};

const READINESS_CLEARED: AuthReadiness = { type: "cleared" };

beforeEach(() => {
  logInfoMock.mockReset();
});

describe("pendingNotAllowedProcedure readiness gate (middleware contract)", () => {
  it("throws FORBIDDEN with the structured lightfast-tasks cause when readiness is pending", async () => {
    const caller = createCaller(
      makeCtx({ identity: ACTIVE_IDENTITY, readiness: READINESS_PENDING })
    );

    await expect(caller.fullyReady()).rejects.toMatchObject({
      code: "FORBIDDEN",
      cause: {
        kind: "LIGHTFAST_TASKS_PENDING",
        current: "connect-github",
        remaining: ["connect-github"],
      },
    });

    // Log emission carries enough context to correlate denials with an org.
    expect(logInfoMock).toHaveBeenCalledWith(
      "[readiness] denied",
      expect.objectContaining({
        orgId: ACTIVE_ORG,
        current: "connect-github",
        remaining: ["connect-github"],
      })
    );
  });

  it("allows the handler to run when readiness is cleared", async () => {
    const caller = createCaller(
      makeCtx({ identity: ACTIVE_IDENTITY, readiness: READINESS_CLEARED })
    );

    await expect(caller.fullyReady()).resolves.toBe("ok-ready");
    expect(logInfoMock).not.toHaveBeenCalled();
  });

  it("emits a null `current` cause when readiness somehow reaches n/a on an active identity (defensive)", async () => {
    const caller = createCaller(
      makeCtx({
        identity: ACTIVE_IDENTITY,
        readiness: { type: "n/a" },
      })
    );

    await expect(caller.fullyReady()).rejects.toMatchObject({
      code: "FORBIDDEN",
      cause: {
        kind: "LIGHTFAST_TASKS_PENDING",
        current: null,
        remaining: [],
      },
    });
  });
});

describe("activeIdentityProcedure (readiness opt-out)", () => {
  it("runs the handler even when readiness is pending", async () => {
    const caller = createCaller(
      makeCtx({ identity: ACTIVE_IDENTITY, readiness: READINESS_PENDING })
    );

    await expect(caller.activeOnly()).resolves.toBe("ok-active");
    expect(logInfoMock).not.toHaveBeenCalled();
  });

  it("still rejects pending identity (the identity gate is independent)", async () => {
    const caller = createCaller(
      makeCtx({ identity: PENDING_IDENTITY, readiness: { type: "n/a" } })
    );

    await expect(caller.activeOnly()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("Organization required"),
    });
  });
});

describe("identity gate fires before readiness gate", () => {
  it("throws the identity-shaped FORBIDDEN (not a tasks-pending payload) when identity is pending", async () => {
    const caller = createCaller(
      makeCtx({ identity: PENDING_IDENTITY, readiness: READINESS_PENDING })
    );

    await expect(caller.fullyReady()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("Organization required"),
    });
    // The readiness middleware never ran — no LIGHTFAST_TASKS_PENDING cause.
    await expect(caller.fullyReady()).rejects.toMatchObject({
      cause: undefined,
    });
  });
});

describe("errorFormatter wire shape (HTTP transport)", () => {
  async function fetchProcedure(
    proc: "fullyReady" | "activeOnly",
    auth: AuthContext
  ): Promise<{ status: number; body: unknown }> {
    const url = new URL(
      `http://localhost/api/trpc/${proc}?batch=1&input=${encodeURIComponent(
        JSON.stringify({ "0": { json: null, meta: { values: ["undefined"] } } })
      )}`
    );
    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      router: testRouter,
      req: new Request(url),
      createContext: () => ({ auth, db: {}, headers: new Headers() }) as never,
    });
    const text = await response.text();
    return { status: response.status, body: JSON.parse(text) };
  }

  // tRPC v11 + superjson serializes the error envelope as
  // `{ error: { json: { code, message, data: { ..., lightfastTasksPending } } } }`.
  // Bearer clients reach `lightfastTasksPending` via the same path; the assertion
  // mirrors that contract.
  interface BatchWireError {
    error?: {
      json?: {
        data?: {
          code?: string;
          httpStatus?: number;
          lightfastTasksPending?: {
            current: string | null;
            remaining: string[];
          } | null;
        };
      };
    };
  }

  it("surfaces data.lightfastTasksPending on the wire when readiness is pending", async () => {
    const { status, body } = await fetchProcedure("fullyReady", {
      identity: ACTIVE_IDENTITY,
      readiness: READINESS_PENDING,
    });

    expect(status).toBe(403);
    const batch = body as BatchWireError[];
    const errorData = batch[0]?.error?.json?.data;
    expect(errorData).toMatchObject({
      code: "FORBIDDEN",
      httpStatus: 403,
      lightfastTasksPending: {
        current: "connect-github",
        remaining: ["connect-github"],
      },
    });
  });

  it("emits lightfastTasksPending: null on unrelated errors (e.g. identity gate)", async () => {
    const { status, body } = await fetchProcedure("fullyReady", {
      identity: PENDING_IDENTITY,
      readiness: READINESS_PENDING,
    });

    expect(status).toBe(403);
    const batch = body as BatchWireError[];
    expect(batch[0]?.error?.json?.data?.lightfastTasksPending).toBeNull();
  });
});
