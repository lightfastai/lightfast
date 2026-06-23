import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExecutionContext } from "../domain";
import {
  inviteOrgMemberCommand,
  listOrgMembersCommand,
  type OrgMembersCommandDeps,
  removeOrgMemberCommand,
  revokeOrgInvitationCommand,
  updateOrgMemberRoleCommand,
} from "../domain/org-members";

const createOrganizationInvitationMock = vi.fn();
const deleteOrganizationMembershipMock = vi.fn();
const getOrganizationInvitationListMock = vi.fn();
const getOrganizationMembershipListMock = vi.fn();
const revokeOrganizationInvitationMock = vi.fn();
const updateOrganizationMembershipMock = vi.fn();
const isClerkConflictErrorMock = vi.fn();

const activeCtx: ExecutionContext = {
  actor: {
    kind: "clerkUser",
    orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
    orgId: "org_acme",
    orgRole: "admin",
    source: "web",
    userId: "user_current",
  },
};

const nonAdminCtx: ExecutionContext = {
  actor: {
    kind: "clerkUser",
    orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
    orgId: "org_acme",
    source: "web",
    userId: "user_current",
  },
};

const pendingCtx: ExecutionContext = {
  actor: {
    kind: "clerkUser",
    source: "web",
    userId: "user_current",
  },
};

function createDeps() {
  return {
    isClerkConflictError: isClerkConflictErrorMock,
    organizations: {
      createOrganizationInvitation: createOrganizationInvitationMock,
      deleteOrganizationMembership: deleteOrganizationMembershipMock,
      getOrganizationInvitationList: getOrganizationInvitationListMock,
      getOrganizationMembershipList: getOrganizationMembershipListMock,
      revokeOrganizationInvitation: revokeOrganizationInvitationMock,
      updateOrganizationMembership: updateOrganizationMembershipMock,
    },
  } satisfies OrgMembersCommandDeps;
}

let deps: ReturnType<typeof createDeps>;

function expectMutationMocksNotCalled() {
  expect(createOrganizationInvitationMock).not.toHaveBeenCalled();
  expect(updateOrganizationMembershipMock).not.toHaveBeenCalled();
  expect(deleteOrganizationMembershipMock).not.toHaveBeenCalled();
  expect(revokeOrganizationInvitationMock).not.toHaveBeenCalled();
}

beforeEach(() => {
  createOrganizationInvitationMock.mockReset();
  deleteOrganizationMembershipMock.mockReset();
  getOrganizationInvitationListMock.mockReset();
  getOrganizationMembershipListMock.mockReset();
  revokeOrganizationInvitationMock.mockReset();
  updateOrganizationMembershipMock.mockReset();
  isClerkConflictErrorMock.mockReset().mockReturnValue(false);
  deps = createDeps();
});

describe("listOrgMembersCommand", () => {
  it("returns members and pending invitations for the active organization", async () => {
    getOrganizationMembershipListMock.mockResolvedValue({
      data: [
        {
          createdAt: 1_700_000_000_000,
          id: "mem_1",
          permissions: [],
          publicUserData: {
            firstName: "Ada",
            identifier: "ada@example.com",
            imageUrl: "https://img.test/ada.png",
            lastName: "Lovelace",
            userId: "user_current",
          },
          role: "org:admin",
          updatedAt: 1_700_000_001_000,
        },
      ],
      totalCount: 1,
    });
    getOrganizationInvitationListMock.mockResolvedValue({
      data: [
        {
          createdAt: 1_700_000_002_000,
          emailAddress: "grace@example.com",
          expiresAt: 1_700_086_400_000,
          id: "inv_1",
          role: "org:member",
          roleName: "Member",
          status: "pending",
          updatedAt: 1_700_000_003_000,
        },
      ],
      totalCount: 1,
    });

    await expect(
      listOrgMembersCommand.run({ ctx: activeCtx, deps, input: {} })
    ).resolves.toEqual({
      invitations: [
        {
          createdAt: 1_700_000_002_000,
          emailAddress: "grace@example.com",
          expiresAt: 1_700_086_400_000,
          id: "inv_1",
          role: "org:member",
          roleName: "Member",
          status: "pending",
          updatedAt: 1_700_000_003_000,
        },
      ],
      members: [
        {
          createdAt: 1_700_000_000_000,
          emailAddress: "ada@example.com",
          firstName: "Ada",
          id: "mem_1",
          imageUrl: "https://img.test/ada.png",
          isCurrentUser: true,
          lastName: "Lovelace",
          name: "Ada Lovelace",
          role: "org:admin",
          updatedAt: 1_700_000_001_000,
          userId: "user_current",
        },
      ],
    });
    expect(getOrganizationMembershipListMock).toHaveBeenCalledWith({
      limit: 100,
      offset: 0,
      organizationId: "org_acme",
    });
    expect(getOrganizationInvitationListMock).toHaveBeenCalledWith({
      limit: 100,
      offset: 0,
      organizationId: "org_acme",
      status: ["pending"],
    });
  });

  it("fetches all member and invitation pages", async () => {
    const members = Array.from({ length: 101 }, (_, index) => ({
      createdAt: 1_700_000_000_000 + index,
      id: `mem_${index}`,
      permissions: [],
      publicUserData: {
        firstName: "Member",
        identifier: `member-${index}@example.com`,
        imageUrl: "",
        lastName: String(index),
        userId: `user_${index}`,
      },
      role: "org:member",
      updatedAt: 1_700_000_001_000 + index,
    }));
    const invitations = Array.from({ length: 101 }, (_, index) => ({
      createdAt: 1_700_000_002_000 + index,
      emailAddress: `invite-${index}@example.com`,
      expiresAt: null,
      id: `inv_${index}`,
      role: "org:member",
      roleName: "Member",
      status: "pending",
      updatedAt: 1_700_000_003_000 + index,
    }));
    getOrganizationMembershipListMock
      .mockResolvedValueOnce({ data: members.slice(0, 100), totalCount: 101 })
      .mockResolvedValueOnce({ data: members.slice(100), totalCount: 101 });
    getOrganizationInvitationListMock
      .mockResolvedValueOnce({
        data: invitations.slice(0, 100),
        totalCount: 101,
      })
      .mockResolvedValueOnce({
        data: invitations.slice(100),
        totalCount: 101,
      });

    const result = await listOrgMembersCommand.run({
      ctx: activeCtx,
      deps,
      input: {},
    });

    expect(result.members).toHaveLength(101);
    expect(result.invitations).toHaveLength(101);
    expect(getOrganizationMembershipListMock).toHaveBeenNthCalledWith(2, {
      limit: 100,
      offset: 100,
      organizationId: "org_acme",
    });
    expect(getOrganizationInvitationListMock).toHaveBeenNthCalledWith(2, {
      limit: 100,
      offset: 100,
      organizationId: "org_acme",
      status: ["pending"],
    });
  });
});

describe("org member mutation commands", () => {
  it("rejects privileged mutations when caller has no active organization", async () => {
    await expect(
      inviteOrgMemberCommand.run({
        ctx: pendingCtx,
        deps,
        input: { emailAddress: "new@example.com", role: "org:member" },
      })
    ).rejects.toMatchObject({ code: "ORG_REQUIRED", kind: "authz" });
    await expect(
      updateOrgMemberRoleCommand.run({
        ctx: pendingCtx,
        deps,
        input: { role: "org:admin", userId: "user_target" },
      })
    ).rejects.toMatchObject({ code: "ORG_REQUIRED", kind: "authz" });
    await expect(
      removeOrgMemberCommand.run({
        ctx: pendingCtx,
        deps,
        input: { userId: "user_target" },
      })
    ).rejects.toMatchObject({ code: "ORG_REQUIRED", kind: "authz" });
    await expect(
      revokeOrgInvitationCommand.run({
        ctx: pendingCtx,
        deps,
        input: { invitationId: "inv_1" },
      })
    ).rejects.toMatchObject({ code: "ORG_REQUIRED", kind: "authz" });
    expectMutationMocksNotCalled();
  });

  it.each([
    {
      name: "invite",
      run: () =>
        inviteOrgMemberCommand.run({
          ctx: nonAdminCtx,
          deps,
          input: { emailAddress: "new@example.com", role: "org:member" },
        }),
    },
    {
      name: "update role",
      run: () =>
        updateOrgMemberRoleCommand.run({
          ctx: nonAdminCtx,
          deps,
          input: { role: "org:admin", userId: "user_target" },
        }),
    },
    {
      name: "remove member",
      run: () =>
        removeOrgMemberCommand.run({
          ctx: nonAdminCtx,
          deps,
          input: { userId: "user_target" },
        }),
    },
    {
      name: "revoke invitation",
      run: () =>
        revokeOrgInvitationCommand.run({
          ctx: nonAdminCtx,
          deps,
          input: { invitationId: "inv_1" },
        }),
    },
  ])("rejects direct $name mutation attempts from non-admin members", async ({
    run,
  }) => {
    await expect(run()).rejects.toMatchObject({
      code: "PERMISSION_REQUIRED",
      kind: "authz",
    });
    expectMutationMocksNotCalled();
  });

  it("sends an organization invitation as an admin", async () => {
    createOrganizationInvitationMock.mockResolvedValue({
      createdAt: 1_700_000_000_000,
      emailAddress: "new@example.com",
      expiresAt: 1_700_086_400_000,
      id: "inv_new",
      role: "org:member",
      roleName: "Member",
      status: "pending",
      updatedAt: 1_700_000_001_000,
    });

    await expect(
      inviteOrgMemberCommand.run({
        ctx: activeCtx,
        deps,
        input: { emailAddress: "new@example.com", role: "org:member" },
      })
    ).resolves.toEqual({
      createdAt: 1_700_000_000_000,
      emailAddress: "new@example.com",
      expiresAt: 1_700_086_400_000,
      id: "inv_new",
      role: "org:member",
      roleName: "Member",
      status: "pending",
      updatedAt: 1_700_000_001_000,
    });
    expect(createOrganizationInvitationMock).toHaveBeenCalledWith({
      emailAddress: "new@example.com",
      inviterUserId: "user_current",
      organizationId: "org_acme",
      role: "org:member",
    });
  });

  it("maps duplicate invitation Clerk errors to a domain conflict", async () => {
    const conflict = new Error("duplicate invitation");
    createOrganizationInvitationMock.mockRejectedValue(conflict);
    isClerkConflictErrorMock.mockReturnValue(true);

    await expect(
      inviteOrgMemberCommand.run({
        ctx: activeCtx,
        deps,
        input: { emailAddress: "new@example.com", role: "org:member" },
      })
    ).rejects.toMatchObject({
      code: "ORG_MEMBER_INVITATION_EXISTS",
      kind: "conflict",
    });
  });

  it("updates a member role as an admin", async () => {
    updateOrganizationMembershipMock.mockResolvedValue({});

    await expect(
      updateOrgMemberRoleCommand.run({
        ctx: activeCtx,
        deps,
        input: { role: "org:admin", userId: "user_target" },
      })
    ).resolves.toEqual({ success: true });
    expect(updateOrganizationMembershipMock).toHaveBeenCalledWith({
      organizationId: "org_acme",
      role: "org:admin",
      userId: "user_target",
    });
  });

  it("removes a member as an admin", async () => {
    deleteOrganizationMembershipMock.mockResolvedValue({});

    await expect(
      removeOrgMemberCommand.run({
        ctx: activeCtx,
        deps,
        input: { userId: "user_target" },
      })
    ).resolves.toEqual({ success: true });
    expect(deleteOrganizationMembershipMock).toHaveBeenCalledWith({
      organizationId: "org_acme",
      userId: "user_target",
    });
  });

  it("rejects attempts to remove the current admin member", async () => {
    deleteOrganizationMembershipMock.mockResolvedValue({});

    await expect(
      removeOrgMemberCommand.run({
        ctx: activeCtx,
        deps,
        input: { userId: "user_current" },
      })
    ).rejects.toMatchObject({
      code: "CANNOT_REMOVE_CURRENT_MEMBER",
      kind: "validation",
    });
    expect(deleteOrganizationMembershipMock).not.toHaveBeenCalled();
  });

  it("revokes a pending invitation as an admin", async () => {
    revokeOrganizationInvitationMock.mockResolvedValue({});

    await expect(
      revokeOrgInvitationCommand.run({
        ctx: activeCtx,
        deps,
        input: { invitationId: "inv_1" },
      })
    ).resolves.toEqual({ success: true });
    expect(revokeOrganizationInvitationMock).toHaveBeenCalledWith({
      invitationId: "inv_1",
      organizationId: "org_acme",
      requestingUserId: "user_current",
    });
  });
});
