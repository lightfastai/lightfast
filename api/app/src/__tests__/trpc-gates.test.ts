import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";
import { isDiagnosticCause } from "../diagnostics";

// ----- module mocks (must precede the dynamic imports below) -----------------

// `@db/app`'s barrel re-exports the eager Neon `db`; stub the client module so
// the binding *helpers* used by `task.*` load without DB env. Handlers read the
// fake `db` injected via tRPC context, never this stub.
vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));

const getOrganizationMock = vi.fn();
const updateOrganizationMock = vi.fn();

vi.mock("@vendor/clerk/server", () => ({
  clerkClient: () =>
    Promise.resolve({
      organizations: {
        getOrganization: getOrganizationMock,
        updateOrganization: updateOrganizationMock,
      },
    }),
  auth: vi.fn(),
  verifyToken: vi.fn(),
  getUserOrgMemberships: vi.fn(),
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Pass-through the observability middleware — the gates are the SUT, not timing.
vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    ({ next }: { next: () => unknown }) =>
      next(),
}));

// `task.bind` refuses in production; pin a non-production env.
vi.mock("../env", () => ({ env: { VERCEL_ENV: "development" } }));

const {
  createTRPCRouter,
  createCallerFactory,
  setupProcedure,
  boundOrgProcedure,
} = await import("../trpc");
const { taskRouter } = await import("../router/(pending-not-allowed)/task");
const { orgApiKeysRouter } = await import(
  "../router/(pending-not-allowed)/org-api-keys"
);

// ----- a router that exposes the gates + the real setup/feature routers ------

const testRouter = createTRPCRouter({
  task: taskRouter,
  orgApiKeys: orgApiKeysRouter,
  // Bare probes: the gate is the only thing between the call and the handler.
  setupProbe: setupProcedure.query(() => "setup-ok"),
  boundProbe: boundOrgProcedure.query(() => "bound-ok"),
});

const createCaller = createCallerFactory(testRouter);

// ----- fake DB ---------------------------------------------------------------

/**
 * A stateful stand-in for the Drizzle client, scoped to a single org per test.
 * `select` returns the current active rows; `insert` appends one. Enough for
 * `isOrgBound` / `getActiveOrgBinding` / `upsertActiveOrgBinding` to run for
 * real against caller-visible state.
 */
function makeStatefulDb(seedActive = false) {
  const rows: Record<string, unknown>[] = [];
  if (seedActive) {
    rows.push({ id: 1, status: "active", clerkOrgId: "seed" });
  }
  const spies = { insert: vi.fn() };
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: (n: number) =>
            Promise.resolve(
              rows.filter((r) => r.status === "active").slice(0, n)
            ),
        }),
      }),
    }),
    insert: () => ({
      values: (v: Record<string, unknown>) => ({
        returning: () => {
          spies.insert(v);
          const row = {
            id: rows.length + 1,
            connectedAt: "2026-05-20T00:00:00.000Z",
            revokedAt: null,
            createdAt: "2026-05-20T00:00:00.000Z",
            updatedAt: "2026-05-20T00:00:00.000Z",
            ...v,
          };
          rows.push(row);
          return Promise.resolve([row]);
        },
      }),
    }),
  };
  return { db: db as unknown as Database, rows, spies };
}

// ----- caller helpers --------------------------------------------------------

function active(bindingStatus: "bound" | "unbound" | "revoked"): AuthIdentity {
  return {
    type: "active",
    userId: "user_test",
    orgId: "org_test",
    orgGate: { bindingStatus },
  };
}

const pending: AuthIdentity = { type: "pending", userId: "user_pending" };

function makeCaller(identity: AuthIdentity, db: Database = {} as Database) {
  return createCaller({
    auth: { identity },
    db,
    headers: new Headers(),
  });
}

beforeEach(() => {
  getOrganizationMock.mockReset();
  getOrganizationMock.mockResolvedValue({ publicMetadata: {} });
  updateOrganizationMock.mockReset();
  updateOrganizationMock.mockResolvedValue(undefined);
});

// ----- boundOrgProcedure -----------------------------------------------------

describe("boundOrgProcedure", () => {
  it("allows a bound active org", async () => {
    const caller = makeCaller(active("bound"));
    await expect(caller.boundProbe()).resolves.toBe("bound-ok");
  });

  it("throws ORG_SETUP_REQUIRED for an unbound active org", async () => {
    const caller = makeCaller(active("unbound"));

    const err = await caller.boundProbe().then(
      () => {
        throw new Error("expected boundProbe to reject");
      },
      (e: unknown) => e
    );

    expect(err).toMatchObject({ code: "FORBIDDEN" });
    if (!isDiagnosticCause((err as { cause: unknown }).cause)) {
      throw new Error("expected a diagnostic cause");
    }
    const cause = (
      err as { cause: { diagnostics: { code: string; repair?: unknown }[] } }
    ).cause;
    expect(cause.diagnostics[0]?.code).toBe("ORG_SETUP_REQUIRED");
    expect(cause.diagnostics[0]?.repair).toEqual({ id: "bind-source-control" });
  });

  it("throws ORG_SETUP_REQUIRED for a revoked active org", async () => {
    const caller = makeCaller(active("revoked"));
    await expect(caller.boundProbe()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("throws ORG_REQUIRED for a pending identity (no active org)", async () => {
    const caller = makeCaller(pending);

    const err = await caller.boundProbe().catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "FORBIDDEN" });
    if (!isDiagnosticCause((err as { cause: unknown }).cause)) {
      throw new Error("expected a diagnostic cause");
    }
    const cause = (err as { cause: { diagnostics: { code: string }[] } }).cause;
    expect(cause.diagnostics[0]?.code).toBe("ORG_REQUIRED");
  });
});

// ----- setupProcedure --------------------------------------------------------

describe("setupProcedure", () => {
  it("allows an unbound active org — the pre-bind setup surface", async () => {
    const caller = makeCaller(active("unbound"));
    await expect(caller.setupProbe()).resolves.toBe("setup-ok");
  });

  it("allows a bound active org too", async () => {
    const caller = makeCaller(active("bound"));
    await expect(caller.setupProbe()).resolves.toBe("setup-ok");
  });

  it("rejects a pending identity with ORG_REQUIRED", async () => {
    const caller = makeCaller(pending);
    await expect(caller.setupProbe()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

// ----- orgApiKeys is gated by boundOrgProcedure ------------------------------

describe("orgApiKeys", () => {
  it.each([
    "list",
    "create",
    "revoke",
    "delete",
  ] as const)("%s rejects an unbound active org before reaching its handler", async (op) => {
    const caller = makeCaller(active("unbound"));
    // The gate runs before input parsing, so an empty payload still rejects.
    const ops = caller.orgApiKeys as unknown as Record<
      string,
      (input?: unknown) => Promise<unknown>
    >;
    const invoke = ops[op];
    if (!invoke) {
      throw new Error(`orgApiKeys.${op} is not callable`);
    }

    await expect(invoke({})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ----- task router -----------------------------------------------------------

describe("task.status", () => {
  it("is callable before the org is bound and reports 'unbound'", async () => {
    const { db } = makeStatefulDb();
    const caller = makeCaller(active("unbound"), db);
    await expect(caller.task.status()).resolves.toEqual({
      bindingStatus: "unbound",
    });
  });

  it("reports 'bound' once the org has an active binding", async () => {
    const { db } = makeStatefulDb(true);
    const caller = makeCaller(active("bound"), db);
    await expect(caller.task.status()).resolves.toEqual({
      bindingStatus: "bound",
    });
  });
});

describe("task.bind", () => {
  it("binds the org and is idempotent once bound", async () => {
    const { db, spies } = makeStatefulDb();
    const caller = makeCaller(active("unbound"), db);

    const first = await caller.task.bind();
    const second = await caller.task.bind();

    expect(first).toEqual({ ok: true, bindingStatus: "bound" });
    expect(second).toEqual({ ok: true, bindingStatus: "bound" });
    // Idempotent: the second bind never inserts a competing active row.
    expect(spies.insert).toHaveBeenCalledTimes(1);

    // Status flips to bound and stays callable.
    await expect(caller.task.status()).resolves.toEqual({
      bindingStatus: "bound",
    });
  });

  it("mirrors 'bound' into Clerk org metadata after the DB write", async () => {
    const { db } = makeStatefulDb();
    const caller = makeCaller(active("unbound"), db);

    await caller.task.bind();

    expect(updateOrganizationMock).toHaveBeenCalledTimes(1);
    const firstCall = updateOrganizationMock.mock.calls[0];
    if (!firstCall) {
      throw new Error("updateOrganization was not called");
    }
    const [, arg] = firstCall;
    const binding = (
      arg as { publicMetadata: { lightfast: { binding: { status: string } } } }
    ).publicMetadata.lightfast.binding;
    expect(binding.status).toBe("bound");
  });
});
