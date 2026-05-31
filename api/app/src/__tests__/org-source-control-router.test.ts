import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";

const getActiveOrgBindingMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  getActiveOrgBinding: getActiveOrgBindingMock,
}));

vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));

vi.mock("@vendor/clerk/server", () => ({
  auth: vi.fn(),
  clerkClient: vi.fn(),
}));

vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    ({ next }: { next: () => unknown }) =>
      next(),
}));

const { createCallerFactory, createTRPCRouter } = await import("../trpc");
const { orgSourceControlRouter } = await import(
  "../router/(pending-not-allowed)/org-source-control"
);

const testRouter = createTRPCRouter({
  org: createTRPCRouter({
    settings: createTRPCRouter({
      sourceControl: orgSourceControlRouter,
    }),
  }),
});
const createCaller = createCallerFactory(testRouter);

function activeIdentity(overrides: Partial<AuthIdentity> = {}): AuthIdentity {
  return {
    type: "active",
    userId: "user_test",
    orgId: "org_acme",
    orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
    ...overrides,
  } as AuthIdentity;
}

const pendingIdentity: AuthIdentity = {
  type: "pending",
  userId: "user_test",
};

const unauthenticatedIdentity: AuthIdentity = {
  type: "unauthenticated",
};

function caller(identity = activeIdentity()) {
  return createCaller({
    auth: { identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

beforeEach(() => {
  getActiveOrgBindingMock.mockReset();
});

describe("org.settings.sourceControl.get", () => {
  it("rejects pending identities before loading binding data", async () => {
    await expect(
      caller(pendingIdentity).org.settings.sourceControl.get()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(getActiveOrgBindingMock).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated identities before loading binding data", async () => {
    await expect(
      caller(unauthenticatedIdentity).org.settings.sourceControl.get()
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(getActiveOrgBindingMock).not.toHaveBeenCalled();
  });

  it("returns an empty read-only connection when the active org is unbound", async () => {
    getActiveOrgBindingMock.mockResolvedValue(undefined);

    await expect(caller().org.settings.sourceControl.get()).resolves.toEqual({
      binding: null,
      status: "unbound",
    });

    expect(getActiveOrgBindingMock).toHaveBeenCalledWith(
      expect.anything(),
      "org_acme"
    );
  });

  it("returns the active source-control binding with matching .lightfast proof", async () => {
    const connectedAt = new Date("2026-05-29T01:02:03.000Z");
    const verifiedAt = "2026-05-30T10:00:00.000Z";
    getActiveOrgBindingMock.mockResolvedValue({
      clerkOrgId: "org_acme",
      connectedAt,
      connectedByUserId: "user_admin",
      createdAt: connectedAt,
      id: 3,
      metadata: {
        installationPayload: { private: true },
        lightfastRepository: {
          fullName: "lightfast-emulated/.lightfast",
          id: "987",
          installationId: "1001",
          name: ".lightfast",
          verifiedAt,
        },
      },
      provider: "github",
      providerAccountId: "987654",
      providerAccountLogin: "lightfast-emulated",
      providerInstallationId: "1001",
      revokedAt: null,
      status: "active",
      updatedAt: connectedAt,
    });

    await expect(caller().org.settings.sourceControl.get()).resolves.toEqual({
      binding: {
        accountLogin: "lightfast-emulated",
        connectedAt,
        lightfastRepository: {
          fullName: "lightfast-emulated/.lightfast",
          id: "987",
          verifiedAt: new Date(verifiedAt),
        },
        provider: "github",
        providerLabel: "GitHub",
      },
      status: "bound",
    });
  });

  it("does not expose stale .lightfast proof for another installation", async () => {
    const connectedAt = new Date("2026-05-29T01:02:03.000Z");
    getActiveOrgBindingMock.mockResolvedValue({
      clerkOrgId: "org_acme",
      connectedAt,
      connectedByUserId: "user_admin",
      createdAt: connectedAt,
      id: 3,
      metadata: {
        lightfastRepository: {
          fullName: "lightfast-emulated/.lightfast",
          id: "987",
          installationId: "old_installation",
          name: ".lightfast",
          verifiedAt: "2026-05-30T10:00:00.000Z",
        },
      },
      provider: "github",
      providerAccountId: "987654",
      providerAccountLogin: "lightfast-emulated",
      providerInstallationId: "1001",
      revokedAt: null,
      status: "active",
      updatedAt: connectedAt,
    });

    await expect(caller().org.settings.sourceControl.get()).resolves.toEqual({
      binding: expect.objectContaining({
        accountLogin: "lightfast-emulated",
        lightfastRepository: null,
      }),
      status: "bound",
    });
  });
});
