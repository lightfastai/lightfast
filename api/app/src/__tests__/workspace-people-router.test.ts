import type { Database, Person } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";

const listPeopleMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  listPeople: listPeopleMock,
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

const activeIdentity: AuthIdentity = {
  type: "active",
  userId: "user_test",
  orgId: "org_test",
  orgGate: { bindingStatus: "bound" },
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

beforeEach(() => {
  listPeopleMock.mockReset();
  listPeopleMock.mockResolvedValue({
    items: [personRow],
    nextCursor: { createdAt: personRow.createdAt, id: personRow.id },
  });
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
      search: "jeevan",
    });
  });

  it("rejects unbound organizations", async () => {
    await expect(
      caller({
        ...activeIdentity,
        orgGate: { bindingStatus: "unbound" },
      }).people.list({})
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listPeopleMock).not.toHaveBeenCalled();
  });
});
