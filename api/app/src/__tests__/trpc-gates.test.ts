import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";
import { isDiagnosticCause } from "../diagnostics";

// ----- module mocks (must precede the dynamic imports below) -----------------

const logDebugMock = vi.fn();
const logErrorMock = vi.fn();
const logInfoMock = vi.fn();
const logWarnMock = vi.fn();

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

// ----- a router that exposes the gates ---------------------------------------

const testRouter = createTRPCRouter({
  // Bare probes: the gate is the only thing between the call and the handler.
  viewerProbe: viewerProcedure.query(() => "viewer-ok"),
  orgProbe: orgProcedure.query(() => "org-ok"),
  setupProbe: setupProcedure.query(() => "setup-ok"),
  boundProbe: boundOrgProcedure.query(() => "bound-ok"),
  orgAdminProbe: orgAdminProcedure.query(() => "org-admin-ok"),
  boundOrgAdminProbe: boundOrgAdminProcedure.query(() => "bound-org-admin-ok"),
});

const createCaller = createCallerFactory(testRouter);

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
