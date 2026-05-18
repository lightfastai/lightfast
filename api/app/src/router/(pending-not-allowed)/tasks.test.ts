import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthContext, AuthReadiness } from "../../auth/context";

// Same vendor stubs as readiness-gate.test.ts — importing trpc.ts pulls
// observability + clerk + drizzle modules that we don't want to load real
// env or hit Postgres for. The tests bypass `resolveAuth` by feeding a stub
// context straight into the caller.
vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));

vi.mock("@vendor/clerk/server", () => ({
  auth: vi.fn(),
  verifyToken: vi.fn(),
  getUserOrgMemberships: vi.fn(),
}));

vi.mock("@db/app/client", () => ({ db: {} }));

const markTaskClearedMock = vi.fn();
const listClearedTasksMock = vi.fn();
vi.mock("../../auth/lightfast-tasks/repo", () => ({
  listClearedTasks: (...args: unknown[]) => listClearedTasksMock(...args),
  markTaskCleared: (...args: unknown[]) => markTaskClearedMock(...args),
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: { info: vi.fn() },
}));

vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    async ({ next }: { next: () => Promise<unknown> }) =>
      next(),
}));

const { createCallerFactory, createTRPCRouter } = await import("../../trpc");
const { tasksRouter } = await import("./tasks");

const router = createTRPCRouter({ tasks: tasksRouter });
const createCaller = createCallerFactory(router);

function makeCtx(auth: AuthContext) {
  return { auth, db: {}, headers: new Headers() } as never;
}

const ACTIVE_IDENTITY = {
  type: "active",
  userId: "user_active",
  orgId: "org_active",
} as const;

const READINESS_PENDING_CONNECT_GITHUB: AuthReadiness = {
  type: "pending",
  current: "connect-github",
  remaining: ["connect-github"],
};

const READINESS_CLEARED: AuthReadiness = { type: "cleared" };

beforeEach(() => {
  markTaskClearedMock.mockReset();
  listClearedTasksMock.mockReset();
});

describe("tasks.getStatus", () => {
  it("reports `connect-github` as not cleared when readiness is pending on it", async () => {
    const caller = createCaller(
      makeCtx({
        identity: ACTIVE_IDENTITY,
        readiness: READINESS_PENDING_CONNECT_GITHUB,
      })
    );

    await expect(caller.tasks.getStatus()).resolves.toEqual([
      {
        key: "connect-github",
        label: "Connect GitHub",
        required: true,
        cleared: false,
      },
    ]);
    expect(listClearedTasksMock).not.toHaveBeenCalled();
  });

  it("reports every task as cleared when readiness is cleared", async () => {
    const caller = createCaller(
      makeCtx({ identity: ACTIVE_IDENTITY, readiness: READINESS_CLEARED })
    );

    await expect(caller.tasks.getStatus()).resolves.toEqual([
      {
        key: "connect-github",
        label: "Connect GitHub",
        required: true,
        cleared: true,
      },
    ]);
  });
});

describe("tasks.completeConnectGithub", () => {
  it("calls markTaskCleared with the org id and the connect-github key", async () => {
    const caller = createCaller(
      makeCtx({
        identity: ACTIVE_IDENTITY,
        readiness: READINESS_PENDING_CONNECT_GITHUB,
      })
    );

    await expect(caller.tasks.completeConnectGithub()).resolves.toEqual({
      ok: true,
    });

    expect(markTaskClearedMock).toHaveBeenCalledTimes(1);
    expect(markTaskClearedMock).toHaveBeenCalledWith(
      "org_active",
      "connect-github"
    );
  });

  it("invokes markTaskCleared again on a repeat call — idempotency lives in the DB layer (composite PK + ON CONFLICT DO NOTHING)", async () => {
    const caller = createCaller(
      makeCtx({
        identity: ACTIVE_IDENTITY,
        readiness: READINESS_PENDING_CONNECT_GITHUB,
      })
    );

    await caller.tasks.completeConnectGithub();
    await caller.tasks.completeConnectGithub();

    expect(markTaskClearedMock).toHaveBeenCalledTimes(2);
    expect(markTaskClearedMock).toHaveBeenNthCalledWith(
      1,
      "org_active",
      "connect-github"
    );
    expect(markTaskClearedMock).toHaveBeenNthCalledWith(
      2,
      "org_active",
      "connect-github"
    );
  });
});
