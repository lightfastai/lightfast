import type { Person } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";
import { actorFromAuthIdentity } from "../domain";
import { getPersonCommand, listPeopleCommand } from "../domain/people";

const mocks = vi.hoisted(() => ({
  getPersonByPublicId: vi.fn(),
  listPeople: vi.fn(),
}));

vi.mock("@db/app", () => ({
  getPersonByPublicId: mocks.getPersonByPublicId,
  listPeople: mocks.listPeople,
}));

const activeIdentity: Extract<AuthIdentity, { type: "active" }> = {
  type: "active",
  userId: "user_test",
  orgId: "org_test",
  orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
};

const unboundIdentity: Extract<AuthIdentity, { type: "active" }> = {
  ...activeIdentity,
  orgGate: { bindingStatus: "unbound", nextSetupRequirement: "github_org" },
};

const personRow: Person = {
  clerkOrgId: "org_test",
  clerkUserId: null,
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  displayName: "Jeevan Pillay",
  firstSeenSignalId: "signal_first",
  id: 7,
  identityKey: "identity_key",
  identityProvider: "x",
  identityType: "handle",
  identityValue: "@jeevanp",
  lastSeenSignalId: "signal_last",
  memberRole: null,
  memberStatus: null,
  memberSyncedAt: null,
  metadata: {},
  normalizedIdentityValue: "jeevanp",
  personSource: "signal",
  publicId: "person_123e4567-e89b-12d3-a456-426614174000",
  seenCount: 3,
  updatedAt: new Date("2026-05-27T01:01:00.000Z"),
};

function ctx(identity: AuthIdentity = activeIdentity) {
  return {
    actor: actorFromAuthIdentity(identity, "web"),
    request: { id: "req_test", source: "tanstack" as const },
  };
}

function deps() {
  return {
    getPersonByPublicId: mocks.getPersonByPublicId,
    listPeople: mocks.listPeople,
  };
}

describe("people domain commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listPeople.mockResolvedValue({
      items: [personRow],
      nextCursor: { createdAt: personRow.createdAt, id: personRow.id },
    });
    mocks.getPersonByPublicId.mockResolvedValue(personRow);
  });

  it("lists people scoped to the bound actor and forwards filters", async () => {
    await expect(
      listPeopleCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: {
          cursor: { createdAt: personRow.createdAt, id: personRow.id },
          limit: 25,
          memberStatuses: ["active"],
          providers: ["x"],
          search: "jeevan",
          sources: ["signal"],
          types: ["handle"],
        },
      })
    ).resolves.toEqual({
      items: [personRow],
      nextCursor: { createdAt: personRow.createdAt, id: personRow.id },
    });

    expect(mocks.listPeople).toHaveBeenCalledWith({
      clerkOrgId: "org_test",
      cursor: { createdAt: personRow.createdAt, id: personRow.id },
      limit: 25,
      memberStatuses: ["active"],
      providers: ["x"],
      search: "jeevan",
      sources: ["signal"],
      types: ["handle"],
    });
  });

  it("normalizes empty filter arrays and blank search before listing", async () => {
    await listPeopleCommand.run({
      ctx: ctx(),
      deps: deps(),
      input: {
        memberStatuses: [],
        providers: [],
        search: "   ",
        sources: [],
        types: [],
      },
    });

    expect(mocks.listPeople).toHaveBeenCalledWith({
      clerkOrgId: "org_test",
      cursor: undefined,
      limit: undefined,
      memberStatuses: undefined,
      providers: undefined,
      search: undefined,
      sources: undefined,
      types: undefined,
    });
  });

  it("loads a person by public id in the actor organization", async () => {
    await expect(
      getPersonCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { publicId: personRow.publicId },
      })
    ).resolves.toEqual(personRow);

    expect(mocks.getPersonByPublicId).toHaveBeenCalledWith({
      clerkOrgId: "org_test",
      publicId: personRow.publicId,
    });
  });

  it("throws a domain not found error when a person is missing", async () => {
    mocks.getPersonByPublicId.mockResolvedValueOnce(undefined);

    await expect(
      getPersonCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { publicId: "person_missing" },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "PERSON_NOT_FOUND",
        kind: "not_found",
      })
    );
  });

  it("requires a bound organization", async () => {
    await expect(
      listPeopleCommand.run({
        ctx: ctx(unboundIdentity),
        deps: deps(),
        input: {},
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "ORG_SETUP_REQUIRED",
        kind: "authz",
      })
    );

    expect(mocks.listPeople).not.toHaveBeenCalled();
  });
});
