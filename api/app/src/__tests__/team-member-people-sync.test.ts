import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClerkOrganizationMembership } from "../services/team-members/people-sync";

const syncOrgTeamMemberPeopleMock = vi.fn();
const markFormerTeamMembersMissingFromSyncMock = vi.fn();

vi.mock("@db/app", () => ({
  markFormerTeamMembersMissingFromSync:
    markFormerTeamMembersMissingFromSyncMock,
  syncOrgTeamMemberPeople: syncOrgTeamMemberPeopleMock,
}));

const { listAcceptedOrgMemberships, syncTeamMembersForOrg } = await import(
  "../services/team-members/people-sync"
);

function membership(
  overrides: Partial<ClerkOrganizationMembership> = {}
): ClerkOrganizationMembership {
  return {
    publicUserData: {
      firstName: "Ada",
      hasImage: false,
      identifier: "ada@example.com",
      imageUrl: "",
      lastName: "Lovelace",
      userId: "user_ada",
    },
    role: "org:member",
    ...overrides,
  };
}

function membershipForUser(userId: string) {
  return membership({
    publicUserData: {
      firstName: "Grace",
      hasImage: false,
      identifier: "grace@example.com",
      imageUrl: "",
      lastName: "Hopper",
      userId,
    },
  });
}

function clerkWithPages(pages: ClerkOrganizationMembership[][]) {
  const getOrganizationMembershipList = vi.fn(
    ({ offset = 0 }: { offset?: number }) => {
      const pageIndex = offset;
      const data = pages[pageIndex] ?? [];
      return Promise.resolve({ data, totalCount: pages.flat().length });
    }
  );
  return {
    organizations: { getOrganizationMembershipList },
  };
}

beforeEach(() => {
  syncOrgTeamMemberPeopleMock.mockReset().mockResolvedValue({
    activeIdentityKeys: ["identity_ada"],
    membersSeen: 1,
    membersSkippedNoEmail: 0,
    membersUpserted: 1,
    people: [],
  });
  markFormerTeamMembersMissingFromSyncMock.mockReset().mockResolvedValue(0);
});

describe("listAcceptedOrgMemberships", () => {
  it("pages through every Clerk organization membership page", async () => {
    const clerk = clerkWithPages([
      [membership()],
      [membershipForUser("user_grace")],
    ]);

    await expect(
      listAcceptedOrgMemberships(clerk, {
        clerkOrgId: "org_test",
        pageSize: 1,
      })
    ).resolves.toHaveLength(2);

    expect(
      clerk.organizations.getOrganizationMembershipList
    ).toHaveBeenCalledWith({ limit: 1, offset: 0, organizationId: "org_test" });
    expect(
      clerk.organizations.getOrganizationMembershipList
    ).toHaveBeenCalledWith({ limit: 1, offset: 1, organizationId: "org_test" });
  });
});

describe("syncTeamMembersForOrg", () => {
  it("syncs accepted memberships and marks former rows only after fetch success", async () => {
    const db = {} as Database;
    const syncedAt = new Date("2026-06-06T02:00:00.000Z");
    const clerk = clerkWithPages([[membership()]]);

    await expect(
      syncTeamMembersForOrg({
        clerk,
        clerkOrgId: "org_test",
        db,
        syncedAt,
      })
    ).resolves.toEqual({
      clerkOrgId: "org_test",
      membersMarkedFormer: 0,
      membersSeen: 1,
      membersSkippedNoEmail: 0,
      membersUpserted: 1,
      status: "synced",
    });

    expect(syncOrgTeamMemberPeopleMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      members: [
        {
          clerkUserId: "user_ada",
          displayName: "Ada Lovelace",
          emailAddress: "ada@example.com",
          role: "org:member",
        },
      ],
      syncedAt,
    });
    expect(markFormerTeamMembersMissingFromSyncMock).toHaveBeenCalledWith(db, {
      activeIdentityKeys: ["identity_ada"],
      clerkOrgId: "org_test",
      syncedAt,
    });
  });

  it("passes blank-email memberships to the DB sync primitive and surfaces skipped counts", async () => {
    const db = {} as Database;
    const syncedAt = new Date("2026-06-06T02:00:00.000Z");
    const clerk = clerkWithPages([
      [
        membership({
          publicUserData: {
            firstName: "No",
            hasImage: false,
            identifier: "   ",
            imageUrl: "",
            lastName: "Email",
            userId: "user_no_email",
          },
        }),
      ],
    ]);
    syncOrgTeamMemberPeopleMock.mockResolvedValueOnce({
      activeIdentityKeys: ["identity_active"],
      membersSeen: 1,
      membersSkippedNoEmail: 1,
      membersUpserted: 0,
      people: [],
    });
    markFormerTeamMembersMissingFromSyncMock.mockResolvedValueOnce(2);

    await expect(
      syncTeamMembersForOrg({
        clerk,
        clerkOrgId: "org_test",
        db,
        syncedAt,
      })
    ).resolves.toEqual({
      clerkOrgId: "org_test",
      membersMarkedFormer: 2,
      membersSeen: 1,
      membersSkippedNoEmail: 1,
      membersUpserted: 0,
      status: "synced",
    });

    expect(syncOrgTeamMemberPeopleMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      members: [
        {
          clerkUserId: "user_no_email",
          displayName: "No Email",
          emailAddress: "",
          role: "org:member",
        },
      ],
      syncedAt,
    });
    expect(markFormerTeamMembersMissingFromSyncMock).toHaveBeenCalledWith(db, {
      activeIdentityKeys: ["identity_active"],
      clerkOrgId: "org_test",
      syncedAt,
    });
    expect(
      syncOrgTeamMemberPeopleMock.mock.invocationCallOrder[0]
    ).toBeLessThan(
      markFormerTeamMembersMissingFromSyncMock.mock.invocationCallOrder[0] ?? 0
    );
  });

  it("does not mark former rows when Clerk fetch fails", async () => {
    const clerk = {
      organizations: {
        getOrganizationMembershipList: vi.fn(async () => {
          throw new Error("clerk unavailable");
        }),
      },
    };

    await expect(
      syncTeamMembersForOrg({
        clerk,
        clerkOrgId: "org_test",
        db: {} as Database,
        syncedAt: new Date("2026-06-06T02:00:00.000Z"),
      })
    ).rejects.toThrow("clerk unavailable");

    expect(markFormerTeamMembersMissingFromSyncMock).not.toHaveBeenCalled();
  });
});
