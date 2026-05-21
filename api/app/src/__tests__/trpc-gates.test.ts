import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";
import { isDiagnosticCause } from "../diagnostics";

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({}));

vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));

const apiKeysCreateMock = vi.fn();
const apiKeysDeleteMock = vi.fn();
const apiKeysGetMock = vi.fn();
const apiKeysListMock = vi.fn();
const apiKeysRevokeMock = vi.fn();

vi.mock("@vendor/clerk/server", () => ({
  clerkClient: () =>
    Promise.resolve({
      apiKeys: {
        create: apiKeysCreateMock,
        delete: apiKeysDeleteMock,
        get: apiKeysGetMock,
        list: apiKeysListMock,
        revoke: apiKeysRevokeMock,
      },
    }),
  auth: vi.fn(),
  verifyToken: vi.fn(),
  getUserOrgMemberships: vi.fn(),
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    ({ next }: { next: () => unknown }) =>
      next(),
}));

const trpcModule = await import("../trpc");
const { createTRPCRouter, createCallerFactory, pendingNotAllowedProcedure } =
  trpcModule;
const { orgApiKeysRouter } = await import(
  "../router/(pending-not-allowed)/org-api-keys"
);

const testRouter = createTRPCRouter({
  orgApiKeys: orgApiKeysRouter,
  activeProbe: pendingNotAllowedProcedure.query(() => "active-ok"),
});

const createCaller = createCallerFactory(testRouter);

const active: AuthIdentity = {
  type: "active",
  userId: "user_test",
  orgId: "org_test",
};

const pending: AuthIdentity = { type: "pending", userId: "user_pending" };

function makeCaller(identity: AuthIdentity, db: Database = {} as Database) {
  return createCaller({
    auth: { identity },
    db,
    headers: new Headers(),
  });
}

beforeEach(() => {
  apiKeysCreateMock.mockReset();
  apiKeysCreateMock.mockResolvedValue({
    id: "ak_test",
    name: "Test key",
    secret: "lf_test_secret",
    subject: "org_test",
  });
  apiKeysDeleteMock.mockReset();
  apiKeysDeleteMock.mockResolvedValue(undefined);
  apiKeysGetMock.mockReset();
  apiKeysGetMock.mockResolvedValue({ id: "ak_test", subject: "org_test" });
  apiKeysListMock.mockReset();
  apiKeysListMock.mockResolvedValue({ data: [] });
  apiKeysRevokeMock.mockReset();
  apiKeysRevokeMock.mockResolvedValue({ id: "ak_test", subject: "org_test" });
});

describe("removed source-control setup gates", () => {
  it("does not export setupProcedure or boundOrgProcedure", () => {
    expect("setupProcedure" in trpcModule).toBe(false);
    expect("boundOrgProcedure" in trpcModule).toBe(false);
  });
});

describe("pendingNotAllowedProcedure", () => {
  it("allows an active org without a source-control binding gate", async () => {
    await expect(makeCaller(active).activeProbe()).resolves.toBe("active-ok");
  });

  it("rejects a pending identity with ORG_REQUIRED", async () => {
    const err = await makeCaller(pending)
      .activeProbe()
      .catch((e: unknown) => e);

    expect(err).toMatchObject({ code: "FORBIDDEN" });
    if (!isDiagnosticCause((err as { cause: unknown }).cause)) {
      throw new Error("expected a diagnostic cause");
    }
    const cause = (err as { cause: { diagnostics: { code: string }[] } }).cause;
    expect(cause.diagnostics[0]?.code).toBe("ORG_REQUIRED");
  });
});

describe("orgApiKeys", () => {
  it("allows an active org to list keys without source-control setup", async () => {
    await expect(makeCaller(active).orgApiKeys.list()).resolves.toEqual([]);
    expect(apiKeysListMock).toHaveBeenCalledWith({
      includeInvalid: true,
      subject: "org_test",
    });
  });

  it("allows an active org to create keys without source-control setup", async () => {
    await expect(
      makeCaller(active).orgApiKeys.create({ name: "Test key" })
    ).resolves.toMatchObject({
      id: "ak_test",
      secret: "lf_test_secret",
      subject: "org_test",
    });
  });

  it("allows an active org to revoke keys without source-control setup", async () => {
    await expect(
      makeCaller(active).orgApiKeys.revoke({ keyId: "ak_test" })
    ).resolves.toEqual({ success: true });
  });

  it("allows an active org to delete keys without source-control setup", async () => {
    await expect(
      makeCaller(active).orgApiKeys.delete({ keyId: "ak_test" })
    ).resolves.toEqual({ success: true });
  });
});
