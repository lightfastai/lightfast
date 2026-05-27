import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";
import { isDiagnosticCause } from "../diagnostics";

// ----- module mocks (must precede the dynamic imports below) -----------------

// `@db/app`'s barrel re-exports the eager database client; stub it so
// the binding *helpers* used by `task.*` load without DB env. Handlers read the
// fake `db` injected via tRPC context, never this stub.
vi.mock("@db/app/client", () => ({ db: {} }));

const getOrganizationMock = vi.fn();
const updateOrganizationMock = vi.fn();
const apisListKeysMock = vi.fn();
const identitiesCreateIdentityMock = vi.fn();
const keysCreateKeyMock = vi.fn();
const keysDeleteKeyMock = vi.fn();
const keysGetKeyMock = vi.fn();
const keysUpdateKeyMock = vi.fn();
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

vi.mock("@vendor/unkey/server", () => ({
  unkeyEnv: { UNKEY_API_ID: "api_test", UNKEY_ROOT_KEY: "unkey_test" },
  getUnkeyClient: () => ({
    apis: { listKeys: apisListKeysMock },
    identities: { createIdentity: identitiesCreateIdentityMock },
    keys: {
      createKey: keysCreateKeyMock,
      deleteKey: keysDeleteKeyMock,
      getKey: keysGetKeyMock,
      updateKey: keysUpdateKeyMock,
    },
  }),
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
const { orgApiKeysRouter } = await import(
  "../router/(pending-not-allowed)/org-api-keys"
);

// ----- a router that exposes the gates + the real setup/feature routers ------

const testRouter = createTRPCRouter({
  task: taskRouter,
  orgApiKeys: orgApiKeysRouter,
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
  apisListKeysMock.mockReset();
  apisListKeysMock.mockResolvedValue({ data: [] });
  identitiesCreateIdentityMock.mockReset();
  identitiesCreateIdentityMock.mockResolvedValue({
    data: { externalId: "org_test", id: "identity_test" },
    meta: { requestId: "req_identity" },
  });
  keysCreateKeyMock.mockReset();
  keysCreateKeyMock.mockResolvedValue({
    data: {
      key: "lf_secret_value",
      keyId: "key_test",
    },
    meta: { requestId: "req_create" },
  });
  keysDeleteKeyMock.mockReset();
  keysDeleteKeyMock.mockResolvedValue({ data: {}, meta: { requestId: "req" } });
  keysGetKeyMock.mockReset();
  keysGetKeyMock.mockResolvedValue({
    data: {
      createdAt: 1_700_000_000_000,
      enabled: true,
      identity: { externalId: "org_test", id: "identity_test" },
      keyId: "key_test",
      lastUsedAt: undefined,
      meta: { createdByUserId: "user_test" },
      name: "Test key",
      start: "lf_live",
      updatedAt: 1_700_000_000_000,
    },
    meta: { requestId: "req_get" },
  });
  keysUpdateKeyMock.mockReset();
  keysUpdateKeyMock.mockResolvedValue({
    data: {
      createdAt: 1_700_000_000_000,
      enabled: false,
      identity: { externalId: "org_test", id: "identity_test" },
      keyId: "key_test",
      meta: { createdByUserId: "user_test" },
      name: "Test key",
      start: "lf_live",
      updatedAt: 1_700_000_000_000,
    },
    meta: { requestId: "req_update" },
  });
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

// ----- orgApiKeys is active-org settings surface -----------------------------

describe("orgApiKeys", () => {
  it("allows an unbound active org to list keys", async () => {
    const caller = makeCaller(active("unbound"));
    await expect(caller.orgApiKeys.list()).resolves.toEqual([]);
    expect(apisListKeysMock).toHaveBeenCalledWith({
      apiId: "api_test",
      decrypt: false,
      externalId: "org_test",
      limit: 100,
    });
  });

  it("allows an unbound active org to create keys", async () => {
    const caller = makeCaller(active("unbound"), {} as Database, adminAccess());
    await expect(
      caller.orgApiKeys.create({ name: "Test key" })
    ).resolves.toMatchObject({
      key: "lf_secret_value",
      keyId: "key_test",
    });
    expect(identitiesCreateIdentityMock).toHaveBeenCalledWith({
      externalId: "org_test",
      meta: { clerkOrgId: "org_test" },
    });
    expect(keysCreateKeyMock).toHaveBeenCalledWith({
      apiId: "api_test",
      externalId: "org_test",
      meta: { createdByUserId: "user_test", source: "dashboard" },
      name: "Test key",
      prefix: "lf",
      recoverable: false,
    });
  });

  it("treats existing Unkey org identities as success when creating keys", async () => {
    const conflict = new Error("identity already exists") as Error & {
      statusCode: number;
    };
    conflict.statusCode = 409;
    identitiesCreateIdentityMock.mockRejectedValueOnce(conflict);
    const caller = makeCaller(active("unbound"), {} as Database, adminAccess());

    await expect(
      caller.orgApiKeys.create({ name: "Test key" })
    ).resolves.toMatchObject({
      key: "lf_secret_value",
      keyId: "key_test",
    });
    expect(keysCreateKeyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: "org_test",
        name: "Test key",
      })
    );
  });

  it("allows an unbound active org to revoke keys", async () => {
    const caller = makeCaller(active("unbound"), {} as Database, adminAccess());
    await expect(
      caller.orgApiKeys.revoke({ keyId: "key_test" })
    ).resolves.toEqual({ success: true });
    expect(keysUpdateKeyMock).toHaveBeenCalledWith({
      enabled: false,
      keyId: "key_test",
    });
  });

  it("does not revoke another org's key", async () => {
    keysGetKeyMock.mockResolvedValueOnce({
      data: {
        createdAt: 1_700_000_000_000,
        enabled: true,
        identity: { externalId: "org_other", id: "identity_other" },
        keyId: "key_other",
        name: "Other key",
        start: "lf_other",
      },
      meta: { requestId: "req_get" },
    });
    const caller = makeCaller(active("unbound"), {} as Database, adminAccess());

    await expect(
      caller.orgApiKeys.revoke({ keyId: "key_other" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(keysGetKeyMock).toHaveBeenCalledWith({
      decrypt: false,
      keyId: "key_other",
    });
    expect(keysUpdateKeyMock).not.toHaveBeenCalled();
  });

  it("allows an unbound active org to delete keys", async () => {
    const caller = makeCaller(active("unbound"), {} as Database, adminAccess());
    await expect(
      caller.orgApiKeys.delete({ keyId: "key_test" })
    ).resolves.toEqual({ success: true });
    expect(keysDeleteKeyMock).toHaveBeenCalledWith({
      keyId: "key_test",
      permanent: false,
    });
  });

  it("rejects API key writes without a matching admin session", async () => {
    const caller = makeCaller(active("unbound"));
    await expect(
      caller.orgApiKeys.create({ name: "Test key" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(keysCreateKeyMock).not.toHaveBeenCalled();
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

  it("returns success when the Clerk metadata mirror fails after the DB write", async () => {
    const { db, spies } = makeStatefulDb();
    const caller = makeCaller(active("unbound"), db);
    const mirrorError = new Error("clerk unavailable");
    updateOrganizationMock.mockRejectedValueOnce(mirrorError);

    await expect(caller.task.bind()).resolves.toEqual({
      ok: true,
      bindingStatus: "bound",
    });

    expect(spies.insert).toHaveBeenCalledTimes(1);
    expect(logWarnMock).toHaveBeenCalledWith(
      "[task] org binding mirror failed",
      expect.objectContaining({
        clerkOrgId: "org_test",
        error: mirrorError,
        userId: "user_test",
      })
    );
    await expect(caller.task.status()).resolves.toEqual({
      bindingStatus: "bound",
    });
  });
});
