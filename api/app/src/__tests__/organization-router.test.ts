import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";

const getUserOrgMembershipsMock = vi.fn();
const isOrgBoundMock = vi.fn();
const authMock = vi.fn();
const getOrganizationMock = vi.fn();
const updateOrganizationMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({ isOrgBound: isOrgBoundMock }));

vi.mock("@vendor/clerk/server", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
  auth: authMock,
  clerkClient: () =>
    Promise.resolve({
      organizations: {
        createOrganization: vi.fn(),
        getOrganization: getOrganizationMock,
        updateOrganization: updateOrganizationMock,
      },
      users: { getOrganizationMembershipList: vi.fn() },
    }),
  getUserOrgMemberships: getUserOrgMembershipsMock,
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
const { organizationRouter, orgSettingsOrganizationRouter } = await import(
  "../router/(pending-allowed)/organization"
);

const testRouter = createTRPCRouter({
  viewer: createTRPCRouter({
    organization: organizationRouter,
  }),
  org: createTRPCRouter({
    settings: createTRPCRouter({
      organization: orgSettingsOrganizationRouter,
    }),
  }),
});
const createCaller = createCallerFactory(testRouter);

const pendingIdentity: AuthIdentity = {
  type: "pending",
  userId: "user_test",
};
const unauthenticatedIdentity: AuthIdentity = {
  type: "unauthenticated",
};

function adminAccess(overrides: { orgId?: string; userId?: string } = {}) {
  return {
    kind: "clerk-session" as const,
    userId: overrides.userId ?? "user_test",
    orgId: overrides.orgId ?? "org_acme",
    has: ({ role }: { role?: string }) => role === "org:admin",
  };
}

function nonAdminAccess() {
  return {
    kind: "clerk-session" as const,
    userId: "user_test",
    orgId: "org_acme",
    has: () => false,
  };
}

function caller(
  identity = pendingIdentity,
  access?: ReturnType<typeof adminAccess> | ReturnType<typeof nonAdminAccess>
) {
  return createCaller({
    auth: access ? { identity, access } : { identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

beforeEach(() => {
  authMock.mockReset();
  getOrganizationMock.mockReset();
  getUserOrgMembershipsMock.mockReset();
  isOrgBoundMock.mockReset();
  updateOrganizationMock.mockReset();

  authMock.mockResolvedValue({
    has: () => true,
    orgId: "org_acme",
    userId: "user_test",
  });
});

describe("organization.getBySlug", () => {
  it("throws UNAUTHORIZED when the caller is unauthenticated", async () => {
    await expect(
      caller({ type: "unauthenticated" }).viewer.organization.getBySlug({
        slug: "acme",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(getUserOrgMembershipsMock).not.toHaveBeenCalled();
    expect(isOrgBoundMock).not.toHaveBeenCalled();
  });

  it("returns the user's matching Clerk org and DB binding gate", async () => {
    getUserOrgMembershipsMock.mockResolvedValue([
      {
        imageUrl: "https://img.test/acme.png",
        organizationId: "org_acme",
        organizationName: "Acme Inc",
        organizationSlug: "acme",
        role: "org:admin",
      },
    ]);
    isOrgBoundMock.mockResolvedValue(true);

    await expect(
      caller().viewer.organization.getBySlug({ slug: "acme" })
    ).resolves.toEqual({
      bindingStatus: "bound",
      org: {
        id: "org_acme",
        imageUrl: "https://img.test/acme.png",
        initials: "AI",
        name: "Acme Inc",
        slug: "acme",
      },
      role: "org:admin",
    });
    expect(isOrgBoundMock).toHaveBeenCalledWith(expect.anything(), "org_acme");
  });

  it("throws NOT_FOUND when the slug is not in the user's memberships", async () => {
    getUserOrgMembershipsMock.mockResolvedValue([
      {
        imageUrl: "",
        organizationId: "org_other",
        organizationName: "Other",
        organizationSlug: "other",
        role: "org:member",
      },
    ]);

    await expect(
      caller().viewer.organization.getBySlug({ slug: "acme" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Organization not found",
    });
    expect(isOrgBoundMock).not.toHaveBeenCalled();
  });
});

describe("organization.updateName", () => {
  it("rejects organization rename when caller has no active organization", async () => {
    await expect(
      caller().org.settings.organization.updateName({
        slug: "acme",
        name: "acme-inc",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(getOrganizationMock).not.toHaveBeenCalled();
    expect(updateOrganizationMock).not.toHaveBeenCalled();
  });

  it("rejects organization rename when caller is unauthenticated", async () => {
    await expect(
      caller(unauthenticatedIdentity).org.settings.organization.updateName({
        slug: "acme",
        name: "acme-inc",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(getOrganizationMock).not.toHaveBeenCalled();
    expect(updateOrganizationMock).not.toHaveBeenCalled();
  });

  it("renames the active organization when Clerk has the admin role", async () => {
    getOrganizationMock.mockResolvedValue({ id: "org_acme" });
    updateOrganizationMock.mockResolvedValue({});

    await expect(
      caller(
        {
          type: "active",
          userId: "user_test",
          orgId: "org_acme",
          orgGate: { bindingStatus: "bound" },
        },
        adminAccess()
      ).org.settings.organization.updateName({ slug: "acme", name: "acme-inc" })
    ).resolves.toEqual({
      id: "org_acme",
      name: "acme-inc",
      success: true,
    });

    expect(getUserOrgMembershipsMock).not.toHaveBeenCalled();
    expect(updateOrganizationMock).toHaveBeenCalledWith("org_acme", {
      name: "acme-inc",
      slug: "acme-inc",
    });
  });

  it("rejects organization rename when Clerk active org differs from the target org", async () => {
    getOrganizationMock.mockResolvedValue({ id: "org_acme" });
    await expect(
      caller(
        {
          type: "active",
          userId: "user_test",
          orgId: "org_acme",
          orgGate: { bindingStatus: "bound" },
        },
        adminAccess({ orgId: "org_other" })
      ).org.settings.organization.updateName({ slug: "acme", name: "acme-inc" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(updateOrganizationMock).not.toHaveBeenCalled();
  });

  it("rejects organization rename without the admin role", async () => {
    getOrganizationMock.mockResolvedValue({ id: "org_acme" });
    await expect(
      caller(
        {
          type: "active",
          userId: "user_test",
          orgId: "org_acme",
          orgGate: { bindingStatus: "bound" },
        },
        nonAdminAccess()
      ).org.settings.organization.updateName({ slug: "acme", name: "acme-inc" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(updateOrganizationMock).not.toHaveBeenCalled();
  });
});
