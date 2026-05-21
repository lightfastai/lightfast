import { describe, expect, it } from "vitest";

import {
  createOptimisticInvitation,
  insertInvitation,
  isOptimisticInvitation,
  type OrgMembersData,
  removeInvitation,
  removeMember,
  replaceInvitation,
  restoreInvitation,
  restoreMember,
  updateMemberRole,
} from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/members/_components/org-member-cache";

const ada: OrgMembersData["members"][number] = {
  createdAt: 1_700_000_000_000,
  emailAddress: "ada@example.com",
  firstName: "Ada",
  id: "mem_ada",
  imageUrl: "",
  isCurrentUser: true,
  lastName: "Lovelace",
  name: "Ada Lovelace",
  role: "org:admin",
  updatedAt: 1_700_000_000_000,
  userId: "user_ada",
};

const grace: OrgMembersData["members"][number] = {
  createdAt: 1_700_000_001_000,
  emailAddress: "grace@example.com",
  firstName: "Grace",
  id: "mem_grace",
  imageUrl: "",
  isCurrentUser: false,
  lastName: "Hopper",
  name: "Grace Hopper",
  role: "org:member",
  updatedAt: 1_700_000_001_000,
  userId: "user_grace",
};

const invite: OrgMembersData["invitations"][number] = {
  createdAt: 1_700_000_002_000,
  emailAddress: "new@example.com",
  expiresAt: 1_700_086_400_000,
  id: "inv_new",
  role: "org:member",
  roleName: "Member",
  status: "pending",
  updatedAt: 1_700_000_002_000,
};

function data(): OrgMembersData {
  return {
    invitations: [invite],
    members: [ada, grace],
  };
}

describe("org member cache helpers", () => {
  it("creates and replaces optimistic invitations", () => {
    const optimistic = createOptimisticInvitation({
      emailAddress: "newer@example.com",
      id: "optimistic:test",
      now: 1_700_000_010_000,
      role: "org:admin",
    });

    expect(isOptimisticInvitation(optimistic)).toBe(true);
    expect(optimistic).toMatchObject({
      createdAt: 1_700_000_010_000,
      emailAddress: "newer@example.com",
      expiresAt: 1_700_000_010_000,
      id: "optimistic:test",
      role: "org:admin",
      roleName: "Admin",
      status: "pending" as const,
      updatedAt: 1_700_000_010_000,
    });

    const withOptimistic = insertInvitation(data(), optimistic);
    expect(withOptimistic!.invitations.map((item) => item.id)).toEqual([
      "optimistic:test",
      "inv_new",
    ]);

    const replacement = {
      ...invite,
      emailAddress: "newer@example.com",
      id: "inv_real",
      role: "org:admin",
      roleName: "Admin",
    };
    const replaced = replaceInvitation(
      withOptimistic!,
      "optimistic:test",
      replacement
    );

    expect(replaced!.invitations.map((item) => item.id)).toEqual([
      "inv_real",
      "inv_new",
    ]);
  });

  it("removes optimistic invitations on failed invite rollback", () => {
    const optimistic = createOptimisticInvitation({
      emailAddress: "rollback@example.com",
      id: "optimistic:rollback",
      now: 1_700_000_010_000,
      role: "org:member",
    });
    const withOptimistic = insertInvitation(data(), optimistic);

    expect(removeInvitation(withOptimistic, "optimistic:rollback")).toEqual(
      data()
    );
  });

  it("updates and rolls back a member role by user id", () => {
    const updated = updateMemberRole(data(), "user_grace", "org:admin");
    expect(
      updated!.members.find((member) => member.userId === "user_grace")?.role
    ).toBe("org:admin");

    const rolledBack = updateMemberRole(updated, "user_grace", "org:member");
    expect(rolledBack).toEqual(data());
  });

  it("removes and restores a member at the captured index", () => {
    const removed = removeMember(data(), "user_ada");

    expect(removed.removedMember).toEqual(ada);
    expect(removed.removedIndex).toBe(0);
    expect(removed.data!.members.map((member) => member.userId)).toEqual([
      "user_grace",
    ]);

    expect(
      restoreMember(removed.data, removed.removedMember, removed.removedIndex)
    ).toEqual(data());
  });

  it("removes and restores an invitation at the captured index", () => {
    const withoutInvite = removeInvitation(data(), "inv_new");

    expect(withoutInvite!.invitations).toEqual([]);
    expect(restoreInvitation(withoutInvite!, invite, 0)).toEqual(data());
  });
});
