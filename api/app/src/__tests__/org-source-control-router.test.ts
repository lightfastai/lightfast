import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";

const getActiveOrgBindingMock = vi.fn();
const isOrgBoundMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  getActiveOrgBinding: getActiveOrgBindingMock,
  isOrgBound: isOrgBoundMock,
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
    orgGate: { bindingStatus: "bound" },
    ...overrides,
  } as AuthIdentity;
}

function caller(identity = activeIdentity()) {
  return createCaller({
    auth: { identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

beforeEach(() => {
  getActiveOrgBindingMock.mockReset();
  isOrgBoundMock.mockReset();
});

describe("org.settings.sourceControl.get", () => {
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

  it("returns the active source-control binding without provider metadata", async () => {
    const connectedAt = new Date("2026-05-29T01:02:03.000Z");
    getActiveOrgBindingMock.mockResolvedValue({
      clerkOrgId: "org_acme",
      connectedAt,
      connectedByUserId: "user_admin",
      createdAt: connectedAt,
      id: 3,
      metadata: { installationPayload: { private: true } },
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
        provider: "github",
        providerLabel: "GitHub",
      },
      status: "bound",
    });
  });
});
