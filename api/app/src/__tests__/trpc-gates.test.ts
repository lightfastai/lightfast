import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";
import { isDiagnosticCause } from "../diagnostics";

// ----- module mocks (must precede the dynamic imports below) -----------------

// Stub the shared db export so the binding helpers used by `task.*` stay
// isolated from runtime DB env. Handlers read the fake `db` injected via tRPC
// context, never this stub.
vi.mock("@db/app/client", () => ({ db: {} }));

const getOrganizationMock = vi.fn();
const updateOrganizationMock = vi.fn();
const logDebugMock = vi.fn();
const logErrorMock = vi.fn();
const logInfoMock = vi.fn();
const logWarnMock = vi.fn();

vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));

vi.mock("@vendor/clerk/server", () => ({
  toPlainClerkResource: structuredClone,
  clerkClient: () =>
    Promise.resolve({
      organizations: {
        getOrganization: getOrganizationMock,
        updateOrganization: updateOrganizationMock,
      },
    }),
  auth: vi.fn(),
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: {
    debug: logDebugMock,
    error: logErrorMock,
    info: logInfoMock,
    warn: logWarnMock,
  },
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
  viewerProcedure,
  orgProcedure,
  setupProcedure,
  boundOrgProcedure,
  orgAdminProcedure,
  boundOrgAdminProcedure,
} = await import("../trpc");
const { taskRouter } = await import("../router/(pending-not-allowed)/task");

// ----- a router that exposes the gates + the real setup/feature routers ------

const testRouter = createTRPCRouter({
  task: taskRouter,
  // Bare probes: the gate is the only thing between the call and the handler.
  viewerProbe: viewerProcedure.query(() => "viewer-ok"),
  orgProbe: orgProcedure.query(() => "org-ok"),
  setupProbe: setupProcedure.query(() => "setup-ok"),
  boundProbe: boundOrgProcedure.query(() => "bound-ok"),
  orgAdminProbe: orgAdminProcedure.query(() => "org-admin-ok"),
  boundOrgAdminProbe: boundOrgAdminProcedure.query(() => "bound-org-admin-ok"),
});

const createCaller = createCallerFactory(testRouter);

// ----- fake DB ---------------------------------------------------------------

/**
 * A stateful stand-in for the Drizzle client, scoped to a single org per test.
 * `select` returns the current active rows; `insert` appends one. Enough for
 * `getActiveOrgBinding` to run for real against caller-visible state.
 */
function makeStatefulDb(seedRows: Record<string, unknown>[] = []) {
  const rows: Record<string, unknown>[] = [...seedRows];
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
        $returningId: () => {
          spies.insert(v);
          const row = {
            id: rows.length + 1,
            connectedAt: new Date("2026-05-20T00:00:00.000Z"),
            revokedAt: null,
            createdAt: new Date("2026-05-20T00:00:00.000Z"),
            updatedAt: new Date("2026-05-20T00:00:00.000Z"),
            ...v,
          };
          rows.push(row);
          return Promise.resolve([{ id: row.id }]);
        },
      }),
    }),
  };
  return { db: db as unknown as Database, rows, spies };
}

function activeGitHubBinding(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    status: "active",
    clerkOrgId: "org_test",
    provider: "github",
    providerAccountLogin: "acme",
    providerInstallationId: "1001",
    metadata: {},
    ...overrides,
  };
}

// ----- caller helpers --------------------------------------------------------

function active(bindingStatus: "bound" | "unbound"): AuthIdentity {
  const orgGate =
    bindingStatus === "bound"
      ? ({ bindingStatus: "bound", nextSetupRequirement: null } as const)
      : ({
          bindingStatus: "unbound",
          nextSetupRequirement: "github_org",
        } as const);
  return {
    type: "active",
    userId: "user_test",
    orgId: "org_test",
    orgGate,
  };
}

const pending: AuthIdentity = { type: "pending", userId: "user_pending" };

function adminAccess(overrides: { orgId?: string; userId?: string } = {}) {
  return {
    kind: "clerk-session" as const,
    userId: overrides.userId ?? "user_test",
    orgId: overrides.orgId ?? "org_test",
    has: ({ role }: { role?: string }) => role === "org:admin",
  };
}

function nonAdminAccess() {
  return {
    kind: "clerk-session" as const,
    userId: "user_test",
    orgId: "org_test",
    has: () => false,
  };
}

function makeCaller(
  identity: AuthIdentity,
  db: Database = {} as Database,
  access?: ReturnType<typeof adminAccess> | ReturnType<typeof nonAdminAccess>
) {
  return createCaller({
    auth: access ? { identity, access } : { identity },
    db,
    headers: new Headers(),
  });
}

beforeEach(() => {
  getOrganizationMock.mockReset();
  getOrganizationMock.mockResolvedValue({ publicMetadata: {} });
  updateOrganizationMock.mockReset();
  updateOrganizationMock.mockResolvedValue(undefined);
  logDebugMock.mockReset();
  logErrorMock.mockReset();
  logInfoMock.mockReset();
  logWarnMock.mockReset();
});

// ----- viewerProcedure --------------------------------------------------------

describe("viewerProcedure", () => {
  it("allows a pending identity", async () => {
    const caller = makeCaller(pending);
    await expect(caller.viewerProbe()).resolves.toBe("viewer-ok");
  });

  it("allows an active identity", async () => {
    const caller = makeCaller(active("unbound"));
    await expect(caller.viewerProbe()).resolves.toBe("viewer-ok");
  });

  it("rejects unauthenticated callers", async () => {
    const caller = makeCaller({ type: "unauthenticated" });
    await expect(caller.viewerProbe()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

// ----- orgProcedure -----------------------------------------------------------

describe("orgProcedure", () => {
  it("allows an active org even before binding", async () => {
    const caller = makeCaller(active("unbound"));
    await expect(caller.orgProbe()).resolves.toBe("org-ok");
  });

  it("rejects pending identities with ORG_REQUIRED", async () => {
    const caller = makeCaller(pending);
    const err = await caller.orgProbe().catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "FORBIDDEN" });
    if (!isDiagnosticCause((err as { cause: unknown }).cause)) {
      throw new Error("expected a diagnostic cause");
    }
    const cause = (err as { cause: { diagnostics: { code: string }[] } }).cause;
    expect(cause.diagnostics[0]?.code).toBe("ORG_REQUIRED");
  });
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
    expect(cause.diagnostics[0]?.repair).toEqual({ id: "setup-github-org" });
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

// ----- orgAdminProcedure ------------------------------------------------------

describe("orgAdminProcedure", () => {
  it("allows a matching Clerk org admin session", async () => {
    const caller = makeCaller(active("unbound"), {} as Database, adminAccess());
    await expect(caller.orgAdminProbe()).resolves.toBe("org-admin-ok");
  });

  it("fails closed when the caller has no Clerk session access", async () => {
    const caller = makeCaller(active("unbound"));
    await expect(caller.orgAdminProbe()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects a non-admin Clerk session", async () => {
    const caller = makeCaller(
      active("unbound"),
      {} as Database,
      nonAdminAccess()
    );
    await expect(caller.orgAdminProbe()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects a Clerk session for a different active org", async () => {
    const caller = makeCaller(
      active("unbound"),
      {} as Database,
      adminAccess({ orgId: "org_other" })
    );
    await expect(caller.orgAdminProbe()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("boundOrgAdminProcedure", () => {
  it("requires both a bound org and matching admin session", async () => {
    const caller = makeCaller(active("bound"), {} as Database, adminAccess());
    await expect(caller.boundOrgAdminProbe()).resolves.toBe(
      "bound-org-admin-ok"
    );
  });

  it("rejects matching admins before org setup is complete", async () => {
    const caller = makeCaller(active("unbound"), {} as Database, adminAccess());
    await expect(caller.boundOrgAdminProbe()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

// ----- task router -----------------------------------------------------------

describe("task.status", () => {
  it("is callable before setup and reports the first missing requirement", async () => {
    const { db } = makeStatefulDb();
    const caller = makeCaller(active("unbound"), db);
    await expect(caller.task.status()).resolves.toEqual({
      bindingStatus: "unbound",
      nextSetupRequirement: "github_org",
    });
  });

  it("does not treat a GitHub org binding without .lightfast proof as bound", async () => {
    const { db } = makeStatefulDb([activeGitHubBinding()]);
    const caller = makeCaller(active("unbound"), db);
    await expect(caller.task.status()).resolves.toEqual({
      bindingStatus: "unbound",
      nextSetupRequirement: "github_lightfast_repo",
    });
  });

  it("reports bound only after both setup requirements are satisfied", async () => {
    const { db } = makeStatefulDb([
      activeGitHubBinding({
        metadata: {
          lightfastRepository: {
            fullName: "acme/.lightfast",
            id: "987",
            installationId: "1001",
            name: ".lightfast",
            verifiedAt: "2026-05-30T10:00:00.000Z",
          },
        },
      }),
    ]);
    const caller = makeCaller(active("bound"), db);
    await expect(caller.task.status()).resolves.toEqual({
      bindingStatus: "bound",
      nextSetupRequirement: null,
    });
  });
});

describe("task.bind", () => {
  it("does not create legacy placeholder bindings", async () => {
    const { db, spies } = makeStatefulDb();
    const caller = makeCaller(active("unbound"), db);

    await expect(caller.task.bind()).rejects.toMatchObject({
      code: "NOT_IMPLEMENTED",
    });
    expect(spies.insert).not.toHaveBeenCalled();
    expect(updateOrganizationMock).not.toHaveBeenCalled();
    await expect(caller.task.status()).resolves.toEqual({
      bindingStatus: "unbound",
      nextSetupRequirement: "github_org",
    });
  });
});
