import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";

const authMock = vi.fn();
const createOrganizationInvitationMock = vi.fn();
const deleteOrganizationMembershipMock = vi.fn();
const getOrganizationInvitationListMock = vi.fn();
const getOrganizationMembershipListMock = vi.fn();
const revokeOrganizationInvitationMock = vi.fn();
const updateOrganizationMembershipMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({ isOrgBound: vi.fn() }));

vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));

vi.mock("@vendor/clerk/server", () => ({
  auth: authMock,
  clerkClient: () =>
    Promise.resolve({
      organizations: {
        createOrganizationInvitation: createOrganizationInvitationMock,
        deleteOrganizationMembership: deleteOrganizationMembershipMock,
        getOrganizationInvitationList: getOrganizationInvitationListMock,
        getOrganizationMembershipList: getOrganizationMembershipListMock,
        revokeOrganizationInvitation: revokeOrganizationInvitationMock,
        updateOrganizationMembership: updateOrganizationMembershipMock,
      },
    }),
  verifyToken: vi.fn(),
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
const { orgMembersRouter } = await import(
  "../router/(pending-not-allowed)/org-members"
);

const testRouter = createTRPCRouter({
  orgMembers: orgMembersRouter,
});
const createCaller = createCallerFactory(testRouter);

const activeIdentity: AuthIdentity = {
  type: "active",
  userId: "user_current",
  orgId: "org_acme",
  orgGate: { bindingStatus: "bound" },
};
const pendingIdentity: AuthIdentity = {
  type: "pending",
  userId: "user_current",
};
const unauthenticatedIdentity: AuthIdentity = {
  type: "unauthenticated",
};

function caller(identity = activeIdentity) {
  return callerWithAccess(identity, adminAccess());
}

function adminAccess(overrides: { orgId?: string; userId?: string } = {}) {
  return {
    kind: "clerk-session" as const,
    userId: overrides.userId ?? "user_current",
    orgId: overrides.orgId ?? "org_acme",
    has: ({ role }: { role?: string }) => role === "org:admin",
  };
}

function nonAdminAccess() {
  return {
    kind: "clerk-session" as const,
    userId: "user_current",
    orgId: "org_acme",
    has: () => false,
  };
}

function callerWithAccess(
  identity = activeIdentity,
  access?: ReturnType<typeof adminAccess> | ReturnType<typeof nonAdminAccess>
) {
  return createCaller({
    auth: access ? { identity, access } : { identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

function expectMutationMocksNotCalled() {
  expect(createOrganizationInvitationMock).not.toHaveBeenCalled();
  expect(updateOrganizationMembershipMock).not.toHaveBeenCalled();
  expect(deleteOrganizationMembershipMock).not.toHaveBeenCalled();
  expect(revokeOrganizationInvitationMock).not.toHaveBeenCalled();
}

beforeEach(() => {
  authMock.mockReset();
  createOrganizationInvitationMock.mockReset();
  deleteOrganizationMembershipMock.mockReset();
  getOrganizationInvitationListMock.mockReset();
  getOrganizationMembershipListMock.mockReset();
  revokeOrganizationInvitationMock.mockReset();
  updateOrganizationMembershipMock.mockReset();

  authMock.mockResolvedValue({
    has: () => true,
    orgId: "org_acme",
    userId: "user_current",
  });
  getOrganizationMembershipListMock.mockResolvedValue({
    data: [
      {
        permissions: [],
      },
    ],
    totalCount: 1,
  });
});

describe("orgMembers.list", () => {
  it("returns members and pending invitations for the active organization", async () => {
    getOrganizationMembershipListMock.mockResolvedValue({
      data: [
        {
          createdAt: 1_700_000_000_000,
          id: "mem_1",
          permissions: [],
          publicUserData: {
            firstName: "Ada",
            imageUrl: "https://img.test/ada.png",
            lastName: "Lovelace",
            userId: "user_current",
            identifier: "ada@example.com",
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

    await expect(caller().orgMembers.list()).resolves.toEqual({
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
});

describe("orgMembers mutations", () => {
  it("rejects privileged mutations when caller has no active organization", async () => {
    const noOrgCaller = caller(pendingIdentity);

    await expect(
      noOrgCaller.orgMembers.invite({ emailAddress: "new@example.com" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      noOrgCaller.orgMembers.updateRole({
        role: "org:admin",
        userId: "user_target",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      noOrgCaller.orgMembers.remove({ userId: "user_target" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      noOrgCaller.orgMembers.revokeInvitation({ invitationId: "inv_1" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expectMutationMocksNotCalled();
  });

  it("rejects privileged mutations when caller is unauthenticated", async () => {
    const unauthenticatedCaller = caller(unauthenticatedIdentity);

    await expect(
      unauthenticatedCaller.orgMembers.invite({
        emailAddress: "new@example.com",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      unauthenticatedCaller.orgMembers.updateRole({
        role: "org:admin",
        userId: "user_target",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      unauthenticatedCaller.orgMembers.remove({ userId: "user_target" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      unauthenticatedCaller.orgMembers.revokeInvitation({
        invitationId: "inv_1",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expectMutationMocksNotCalled();
  });

  it("rejects direct mutation attempts from non-admin members", async () => {
    await expect(
      callerWithAccess(activeIdentity, nonAdminAccess()).orgMembers.invite({
        emailAddress: "new@example.com",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createOrganizationInvitationMock).not.toHaveBeenCalled();
  });

  it("rejects privileged mutations when Clerk active org differs from tRPC context", async () => {
    await expect(
      callerWithAccess(
        activeIdentity,
        adminAccess({ orgId: "org_other" })
      ).orgMembers.invite({ emailAddress: "new@example.com" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createOrganizationInvitationMock).not.toHaveBeenCalled();
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
      caller().orgMembers.invite({ emailAddress: "new@example.com" })
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

  it("updates a member role as an admin", async () => {
    updateOrganizationMembershipMock.mockResolvedValue({});

    await expect(
      caller().orgMembers.updateRole({
        role: "org:admin",
        userId: "user_target",
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
      caller().orgMembers.remove({ userId: "user_target" })
    ).resolves.toEqual({ success: true });
    expect(deleteOrganizationMembershipMock).toHaveBeenCalledWith({
      organizationId: "org_acme",
      userId: "user_target",
    });
  });

  it("rejects attempts to remove the current admin member", async () => {
    deleteOrganizationMembershipMock.mockResolvedValue({});

    await expect(
      caller().orgMembers.remove({ userId: "user_current" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(deleteOrganizationMembershipMock).not.toHaveBeenCalled();
  });

  it("revokes a pending invitation as an admin", async () => {
    revokeOrganizationInvitationMock.mockResolvedValue({});

    await expect(
      caller().orgMembers.revokeInvitation({ invitationId: "inv_1" })
    ).resolves.toEqual({ success: true });
    expect(revokeOrganizationInvitationMock).toHaveBeenCalledWith({
      invitationId: "inv_1",
      organizationId: "org_acme",
      requestingUserId: "user_current",
    });
  });
});
