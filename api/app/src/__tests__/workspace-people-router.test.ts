import type { Database, Person } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";

const listPeopleMock = vi.fn();
const getPersonByPublicIdMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  listPeople: listPeopleMock,
  getPersonByPublicId: getPersonByPublicIdMock,
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

const pendingIdentity: AuthIdentity = {
  type: "pending",
  userId: "user_test",
};

const unauthenticatedIdentity: AuthIdentity = {
  type: "unauthenticated",
};

const personRow: Person = {
  id: 7,
  publicId: "person_123e4567-e89b-12d3-a456-426614174000",
  clerkOrgId: "org_test",
  displayName: "Jeevan Pillay",
  identityProvider: "x",
  identityType: "handle",
  identityValue: "@jeevanp",
  normalizedIdentityValue: "jeevanp",
  identityKey: "identity_key",
  firstSeenSignalId: "signal_first",
  lastSeenSignalId: "signal_last",
  seenCount: 3,
  metadata: {},
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  updatedAt: new Date("2026-05-27T01:01:00.000Z"),
};

function caller(identity: AuthIdentity = activeIdentity) {
  return createCaller({
    auth: { identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

function activeIdentityForOrg(orgId: string): ActiveAuthIdentity {
  return {
    ...activeIdentity,
    orgId,
  };
}

beforeEach(() => {
  listPeopleMock.mockReset();
  listPeopleMock.mockResolvedValue({
    items: [personRow],
    nextCursor: { createdAt: personRow.createdAt, id: personRow.id },
  });
  getPersonByPublicIdMock.mockReset();
  getPersonByPublicIdMock.mockResolvedValue(personRow);
});

describe("workspacePeopleRouter.list", () => {
  it("forwards filters and returns native DB rows unchanged", async () => {
    await expect(
      caller().people.list({
        cursor: { createdAt: new Date("2026-05-27T01:00:00.000Z"), id: 7 },
        limit: 25,
        search: "jeevan",
      })
    ).resolves.toEqual({
      items: [personRow],
      nextCursor: { createdAt: personRow.createdAt, id: personRow.id },
    });

    expect(listPeopleMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      cursor: { createdAt: new Date("2026-05-27T01:00:00.000Z"), id: 7 },
      limit: 25,
      providers: undefined,
      search: "jeevan",
      types: undefined,
    });
  });

  it("normalizes blank search to an unfiltered list request", async () => {
    await expect(
      caller().people.list({ search: "   " })
    ).resolves.toMatchObject({
      items: [personRow],
    });

    expect(listPeopleMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      cursor: undefined,
      limit: undefined,
      providers: undefined,
      search: undefined,
      types: undefined,
    });
  });

  it("rejects non-date cursor values before querying", async () => {
    await expect(
      caller().people.list({
        cursor: { createdAt: 123 as unknown as Date, id: 7 },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(listPeopleMock).not.toHaveBeenCalled();
  });

  it("rejects unbound organizations", async () => {
    await expect(
      caller({
        ...activeIdentity,
        orgGate: {
          bindingStatus: "unbound",
          nextSetupRequirement: "github_org",
        },
      }).people.list({})
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listPeopleMock).not.toHaveBeenCalled();
  });

  it("rejects when no active org is selected", async () => {
    await expect(caller(pendingIdentity).people.list({})).rejects.toMatchObject(
      {
        code: "FORBIDDEN",
      }
    );
    expect(listPeopleMock).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers", async () => {
    await expect(
      caller(unauthenticatedIdentity).people.list({})
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(listPeopleMock).not.toHaveBeenCalled();
  });

  it("rejects unbound organizations", async () => {
    await expect(
      caller({
        ...activeIdentity,
        orgGate: {
          bindingStatus: "unbound",
          nextSetupRequirement: "github_org",
        },
      }).people.list({})
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listPeopleMock).not.toHaveBeenCalled();
  });

  it("scopes list queries to the authenticated organization", async () => {
    await expect(
      caller(activeIdentityForOrg("org_other")).people.list({})
    ).resolves.toMatchObject({ items: [personRow] });

    expect(listPeopleMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_other",
      cursor: undefined,
      limit: undefined,
      providers: undefined,
      search: undefined,
      types: undefined,
    });
  });
});

describe("workspacePeopleRouter.list filters", () => {
  it("forwards provider and type filters to the db helper", async () => {
    await caller().people.list({ providers: ["x"], types: ["handle"] });

    expect(listPeopleMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      cursor: undefined,
      limit: undefined,
      providers: ["x"],
      search: undefined,
      types: ["handle"],
    });
  });

  it("rejects unknown provider values", async () => {
    await expect(
      caller().people.list({
        providers: ["telegram" as unknown as "x"],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(listPeopleMock).not.toHaveBeenCalled();
  });
});

describe("workspacePeopleRouter.get", () => {
  it("returns the org-scoped person", async () => {
    await expect(
      caller().people.get({ publicId: personRow.publicId })
    ).resolves.toEqual(personRow);

    expect(getPersonByPublicIdMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      publicId: personRow.publicId,
    });
  });

  it("throws NOT_FOUND when the person is missing", async () => {
    getPersonByPublicIdMock.mockResolvedValueOnce(undefined);

    await expect(
      caller().people.get({ publicId: "person_missing" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects unbound organizations", async () => {
    await expect(
      caller({
        ...activeIdentity,
        orgGate: {
          bindingStatus: "unbound",
          nextSetupRequirement: "github_org",
        },
      }).people.get({ publicId: personRow.publicId })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getPersonByPublicIdMock).not.toHaveBeenCalled();
  });
});
