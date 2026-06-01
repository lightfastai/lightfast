import type { Database, SignalView } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";

const listSignalViewsMock = vi.fn();
const createSignalViewMock = vi.fn();
const deleteSignalViewMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  // signals deps imported by workspace-signals.ts
  listSignals: vi.fn(),
  listWorkspaceSignals: vi.fn(),
  getSignalByPublicId: vi.fn(),
  // signal views deps
  listSignalViews: listSignalViewsMock,
  createSignalView: createSignalViewMock,
  deleteSignalView: deleteSignalViewMock,
}));
vi.mock("../signals/create-signal", () => ({
  createAndQueueSignal: vi.fn(),
  isSignalCreateQueueError: () => false,
}));
vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));
vi.mock("@vendor/observability/log/next", () => ({
  log: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    ({ next }: { next: () => unknown }) =>
      next(),
}));

const { createCallerFactory, createTRPCRouter } = await import("../trpc");
const { workspaceSignalsRouter } = await import(
  "../router/(pending-not-allowed)/workspace-signals"
);

const testRouter = createTRPCRouter({ signals: workspaceSignalsRouter });
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

const viewRow: SignalView = {
  id: 3,
  publicId: "sigview_123e4567-e89b-12d3-a456-426614174000",
  clerkOrgId: "org_test",
  createdByUserId: "user_test",
  name: "My follow-ups",
  config: {
    filters: {
      kinds: ["follow_up"],
      priorities: [],
      dispositions: [],
      peopleRouted: false,
    },
  },
  createdAt: new Date("2026-05-30T01:00:00.000Z"),
  updatedAt: new Date("2026-05-30T01:00:00.000Z"),
};

function caller(identity: AuthIdentity = activeIdentity) {
  return createCaller({
    auth: { identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

beforeEach(() => {
  listSignalViewsMock.mockReset().mockResolvedValue([viewRow]);
  createSignalViewMock.mockReset().mockResolvedValue(viewRow);
  deleteSignalViewMock.mockReset().mockResolvedValue(true);
});

describe("workspaceSignalsRouter.views.list", () => {
  it("scopes to the authenticated org + user", async () => {
    await expect(caller().signals.views.list()).resolves.toEqual([viewRow]);
    expect(listSignalViewsMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
    });
  });

  it("rejects unauthenticated callers", async () => {
    await expect(
      caller(unauthenticatedIdentity).signals.views.list()
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(listSignalViewsMock).not.toHaveBeenCalled();
  });

  it("rejects pending (no active org) callers", async () => {
    await expect(
      caller(pendingIdentity).signals.views.list()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listSignalViewsMock).not.toHaveBeenCalled();
  });

  it("rejects unbound organizations", async () => {
    await expect(
      caller({
        ...activeIdentity,
        orgGate: {
          bindingStatus: "unbound",
          nextSetupRequirement: "github_org",
        },
      }).signals.views.list()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listSignalViewsMock).not.toHaveBeenCalled();
  });
});

describe("workspaceSignalsRouter.views.create", () => {
  it("creates a view scoped to the org + user and trims the name", async () => {
    await expect(
      caller().signals.views.create({
        name: "  My follow-ups  ",
        config: viewRow.config,
      })
    ).resolves.toEqual(viewRow);

    expect(createSignalViewMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      name: "My follow-ups",
      config: viewRow.config,
    });
  });

  it("rejects an empty name", async () => {
    await expect(
      caller().signals.views.create({ name: "   ", config: viewRow.config })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createSignalViewMock).not.toHaveBeenCalled();
  });
});

describe("workspaceSignalsRouter.views.delete", () => {
  it("deletes a view scoped to the org + user", async () => {
    await expect(
      caller().signals.views.delete({ publicId: viewRow.publicId })
    ).resolves.toEqual({ success: true });
    expect(deleteSignalViewMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      publicId: viewRow.publicId,
    });
  });

  it("throws NOT_FOUND when nothing was deleted", async () => {
    deleteSignalViewMock.mockResolvedValueOnce(false);
    await expect(
      caller().signals.views.delete({ publicId: "sigview_missing" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
