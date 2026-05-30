import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getOrganizationMembershipListMock = vi.fn();

vi.mock("@vendor/clerk/server", () => ({
  auth: authMock,
  clerkClient: () =>
    Promise.resolve({
      users: {
        getOrganizationMembershipList: getOrganizationMembershipListMock,
      },
    }),
}));

const {
  ClerkOrgMembershipAccessError,
  assertCurrentUserIsOrgAdmin,
  findUserOrganizationMembership,
  listUserOrganizationMemberships,
} = await import("../auth/clerk-org-membership");

function membership(input: { id: string; role?: string; slug?: string }) {
  return {
    organization: {
      id: input.id,
      imageUrl: `https://img.example.com/${input.id}.png`,
      name: input.slug ?? input.id,
      slug: input.slug ?? input.id,
    },
    role: input.role ?? "org:member",
  };
}

describe("clerk org membership auth helper", () => {
  beforeEach(() => {
    authMock.mockReset();
    getOrganizationMembershipListMock.mockReset();
    authMock.mockResolvedValue({ userId: "user_1" });
  });

  it("lists every organization membership across Clerk pages", async () => {
    getOrganizationMembershipListMock
      .mockResolvedValueOnce({
        data: Array.from({ length: 100 }, (_, index) =>
          membership({ id: `org_${index}` })
        ),
        totalCount: 101,
      })
      .mockResolvedValueOnce({
        data: [membership({ id: "org_100", role: "org:admin" })],
        totalCount: 101,
      });

    await expect(
      listUserOrganizationMemberships({ userId: "user_1" })
    ).resolves.toHaveLength(101);
    expect(getOrganizationMembershipListMock).toHaveBeenNthCalledWith(1, {
      limit: 100,
      offset: 0,
      userId: "user_1",
    });
    expect(getOrganizationMembershipListMock).toHaveBeenNthCalledWith(2, {
      limit: 100,
      offset: 100,
      userId: "user_1",
    });
  });

  it("finds a membership by organization id beyond the first page", async () => {
    getOrganizationMembershipListMock
      .mockResolvedValueOnce({
        data: Array.from({ length: 100 }, (_, index) =>
          membership({ id: `org_other_${index}` })
        ),
        totalCount: 101,
      })
      .mockResolvedValueOnce({
        data: [membership({ id: "org_target", role: "org:admin" })],
        totalCount: 101,
      });

    await expect(
      findUserOrganizationMembership({
        organizationId: "org_target",
        userId: "user_1",
      })
    ).resolves.toMatchObject({
      organization: { id: "org_target" },
      role: "org:admin",
    });
  });

  it("finds a membership by organization slug beyond the first page", async () => {
    getOrganizationMembershipListMock
      .mockResolvedValueOnce({
        data: Array.from({ length: 100 }, (_, index) =>
          membership({ id: `org_other_${index}`, slug: `other-${index}` })
        ),
        totalCount: 101,
      })
      .mockResolvedValueOnce({
        data: [
          membership({ id: "org_target", role: "org:admin", slug: "acme" }),
        ],
        totalCount: 101,
      });

    await expect(
      findUserOrganizationMembership({
        organizationSlug: "acme",
        userId: "user_1",
      })
    ).resolves.toMatchObject({
      organization: { id: "org_target", slug: "acme" },
      role: "org:admin",
    });
  });

  it("asserts the current user is the expected organization admin beyond the first page", async () => {
    getOrganizationMembershipListMock
      .mockResolvedValueOnce({
        data: Array.from({ length: 100 }, (_, index) =>
          membership({ id: `org_other_${index}` })
        ),
        totalCount: 101,
      })
      .mockResolvedValueOnce({
        data: [membership({ id: "org_target", role: "org:admin" })],
        totalCount: 101,
      });

    await expect(
      assertCurrentUserIsOrgAdmin({
        clerkOrgId: "org_target",
        expectedUserId: "user_1",
      })
    ).resolves.toEqual({ userId: "user_1" });
  });

  it("throws UNAUTHENTICATED when no current user is present", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    await expect(
      assertCurrentUserIsOrgAdmin({ clerkOrgId: "org_target" })
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("throws EXPECTED_USER_MISMATCH when the callback user changed", async () => {
    await expect(
      assertCurrentUserIsOrgAdmin({
        clerkOrgId: "org_target",
        expectedUserId: "user_2",
      })
    ).rejects.toMatchObject({
      code: "EXPECTED_USER_MISMATCH",
    });
    expect(getOrganizationMembershipListMock).not.toHaveBeenCalled();
  });

  it("throws MISSING_MEMBERSHIP for non-members", async () => {
    getOrganizationMembershipListMock.mockResolvedValueOnce({
      data: [membership({ id: "org_other" })],
      totalCount: 1,
    });

    const result = assertCurrentUserIsOrgAdmin({ clerkOrgId: "org_target" });

    await expect(result).rejects.toBeInstanceOf(
      ClerkOrgMembershipAccessError
    );
    await expect(result).rejects.toMatchObject({
      code: "MISSING_MEMBERSHIP",
    });
  });

  it("throws NON_ADMIN for non-admin members", async () => {
    getOrganizationMembershipListMock.mockResolvedValueOnce({
      data: [membership({ id: "org_target", role: "org:member" })],
      totalCount: 1,
    });

    await expect(
      assertCurrentUserIsOrgAdmin({ clerkOrgId: "org_target" })
    ).rejects.toMatchObject({
      code: "NON_ADMIN",
    });
  });
});
