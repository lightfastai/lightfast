import type { Database, DecisionView } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";

const listProviderRoutineCallsMock = vi.fn();
const listDecisionViewsMock = vi.fn();
const createDecisionViewMock = vi.fn();
const deleteDecisionViewMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  listProviderRoutineCalls: listProviderRoutineCallsMock,
  listDecisionViews: listDecisionViewsMock,
  createDecisionView: createDecisionViewMock,
  deleteDecisionView: deleteDecisionViewMock,
}));
vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));
vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    ({ next }: { next: () => unknown }) =>
      next(),
}));

const { createCallerFactory, createTRPCRouter } = await import("../trpc");
const { decisionsRouter } = await import(
  "../router/(pending-not-allowed)/decisions"
);

const testRouter = createTRPCRouter({ decisions: decisionsRouter });
const createCaller = createCallerFactory(testRouter);

type ActiveAuthIdentity = Extract<AuthIdentity, { type: "active" }>;
const activeIdentity: ActiveAuthIdentity = {
  type: "active",
  userId: "user_test",
  orgId: "org_test",
  orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
};
const pendingIdentity: AuthIdentity = { type: "pending", userId: "user_test" };
const unauthenticatedIdentity: AuthIdentity = { type: "unauthenticated" };

const viewRow: DecisionView = {
  id: 3,
  publicId: "decview_123e4567-e89b-12d3-a456-426614174000",
  clerkOrgId: "org_test",
  createdByUserId: "user_test",
  name: "Failed Linear",
  config: {
    filters: {
      providers: ["linear"],
      statuses: ["failed"],
    },
  },
  createdAt: new Date("2026-06-06T01:00:00.000Z"),
  updatedAt: new Date("2026-06-06T01:00:00.000Z"),
};

function caller(identity: AuthIdentity = activeIdentity) {
  return createCaller({
    auth: { identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

beforeEach(() => {
  listProviderRoutineCallsMock.mockReset();
  listDecisionViewsMock.mockReset().mockResolvedValue([viewRow]);
  createDecisionViewMock.mockReset().mockResolvedValue(viewRow);
  deleteDecisionViewMock.mockReset().mockResolvedValue(true);
});

describe("decisionsRouter.views.list", () => {
  it("scopes to the authenticated org + user", async () => {
    await expect(caller().decisions.views.list()).resolves.toEqual([viewRow]);
    expect(listDecisionViewsMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
    });
  });

  it("rejects unauthenticated callers", async () => {
    await expect(
      caller(unauthenticatedIdentity).decisions.views.list()
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(listDecisionViewsMock).not.toHaveBeenCalled();
  });

  it("rejects pending (no active org) callers", async () => {
    await expect(
      caller(pendingIdentity).decisions.views.list()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listDecisionViewsMock).not.toHaveBeenCalled();
  });
});

describe("decisionsRouter.views.create", () => {
  it("creates a view scoped to the org + user and trims the name", async () => {
    await expect(
      caller().decisions.views.create({
        name: "  Failed Linear  ",
        config: viewRow.config,
      })
    ).resolves.toEqual(viewRow);

    expect(createDecisionViewMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      name: "Failed Linear",
      config: viewRow.config,
    });
  });

  it("rejects an empty name", async () => {
    await expect(
      caller().decisions.views.create({ name: "   ", config: viewRow.config })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createDecisionViewMock).not.toHaveBeenCalled();
  });

  it("rejects unknown provider values in config", async () => {
    await expect(
      caller().decisions.views.create({
        name: "Bad",
        config: {
          filters: {
            providers: ["github" as unknown as "linear"],
            statuses: [],
          },
        },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createDecisionViewMock).not.toHaveBeenCalled();
  });
});

describe("decisionsRouter.views.delete", () => {
  it("deletes a view scoped to the org + user", async () => {
    await expect(
      caller().decisions.views.delete({ publicId: viewRow.publicId })
    ).resolves.toEqual({ success: true });
    expect(deleteDecisionViewMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      publicId: viewRow.publicId,
    });
  });

  it("throws NOT_FOUND when nothing was deleted", async () => {
    deleteDecisionViewMock.mockResolvedValueOnce(false);
    await expect(
      caller().decisions.views.delete({ publicId: "decview_missing" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
