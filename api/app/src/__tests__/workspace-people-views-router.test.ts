import type { Database, PeopleView } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";

const listPeopleViewsMock = vi.fn();
const createPeopleViewMock = vi.fn();
const deletePeopleViewMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  // people router deps imported by workspace-people.ts
  listPeople: vi.fn(),
  getPersonByPublicId: vi.fn(),
  // people views deps
  listPeopleViews: listPeopleViewsMock,
  createPeopleView: createPeopleViewMock,
  deletePeopleView: deletePeopleViewMock,
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
const { workspacePeopleRouter } = await import(
  "../router/(pending-not-allowed)/workspace-people"
);

const testRouter = createTRPCRouter({ people: workspacePeopleRouter });
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

const viewRow: PeopleView = {
  id: 3,
  publicId: "peoview_123e4567-e89b-12d3-a456-426614174000",
  clerkOrgId: "org_test",
  createdByUserId: "user_test",
  name: "X handles",
  config: {
    filters: {
      providers: ["x"],
      types: ["handle"],
    },
  },
  createdAt: new Date("2026-05-31T01:00:00.000Z"),
  updatedAt: new Date("2026-05-31T01:00:00.000Z"),
};

function caller(identity: AuthIdentity = activeIdentity) {
  return createCaller({
    auth: { identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

beforeEach(() => {
  listPeopleViewsMock.mockReset().mockResolvedValue([viewRow]);
  createPeopleViewMock.mockReset().mockResolvedValue(viewRow);
  deletePeopleViewMock.mockReset().mockResolvedValue(true);
});

describe("workspacePeopleRouter.views.list", () => {
  it("scopes to the authenticated org + user", async () => {
    await expect(caller().people.views.list()).resolves.toEqual([viewRow]);
    expect(listPeopleViewsMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
    });
  });

  it("rejects unauthenticated callers", async () => {
    await expect(
      caller(unauthenticatedIdentity).people.views.list()
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(listPeopleViewsMock).not.toHaveBeenCalled();
  });

  it("rejects pending (no active org) callers", async () => {
    await expect(
      caller(pendingIdentity).people.views.list()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listPeopleViewsMock).not.toHaveBeenCalled();
  });

  it("rejects unbound organizations", async () => {
    await expect(
      caller({
        ...activeIdentity,
        orgGate: {
          bindingStatus: "unbound",
          nextSetupRequirement: "github_org",
        },
      }).people.views.list()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listPeopleViewsMock).not.toHaveBeenCalled();
  });
});

describe("workspacePeopleRouter.views.create", () => {
  it("creates a view scoped to the org + user and trims the name", async () => {
    await expect(
      caller().people.views.create({
        name: "  X handles  ",
        config: viewRow.config,
      })
    ).resolves.toEqual(viewRow);

    expect(createPeopleViewMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      name: "X handles",
      config: viewRow.config,
    });
  });

  it("rejects an empty name", async () => {
    await expect(
      caller().people.views.create({ name: "   ", config: viewRow.config })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createPeopleViewMock).not.toHaveBeenCalled();
  });

  it("rejects unknown provider values in config", async () => {
    await expect(
      caller().people.views.create({
        name: "Bad",
        config: {
          filters: {
            providers: ["telegram" as unknown as "x"],
            types: [],
          },
        },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createPeopleViewMock).not.toHaveBeenCalled();
  });
});

describe("workspacePeopleRouter.views.delete", () => {
  it("deletes a view scoped to the org + user", async () => {
    await expect(
      caller().people.views.delete({ publicId: viewRow.publicId })
    ).resolves.toEqual({ success: true });
    expect(deletePeopleViewMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      publicId: viewRow.publicId,
    });
  });

  it("throws NOT_FOUND when nothing was deleted", async () => {
    deletePeopleViewMock.mockResolvedValueOnce(false);
    await expect(
      caller().people.views.delete({ publicId: "peoview_missing" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
