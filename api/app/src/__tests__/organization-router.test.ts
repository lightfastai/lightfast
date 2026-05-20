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

vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));

vi.mock("@vendor/clerk/server", () => ({
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
const { organizationRouter } = await import(
  "../router/(pending-allowed)/organization"
);

const testRouter = createTRPCRouter({
  organization: organizationRouter,
});
const createCaller = createCallerFactory(testRouter);

const pendingIdentity: AuthIdentity = {
  type: "pending",
  userId: "user_test",
};

function caller(identity = pendingIdentity) {
  return createCaller({
    auth: { identity },
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
      caller({ type: "unauthenticated" }).organization.getBySlug({
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
      caller().organization.getBySlug({ slug: "acme" })
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
      caller().organization.getBySlug({ slug: "acme" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Organization not found",
    });
    expect(isOrgBoundMock).not.toHaveBeenCalled();
  });
});

describe("organization.updateName", () => {
  it("renames the active organization when Clerk has the admin role", async () => {
    getOrganizationMock.mockResolvedValue({ id: "org_acme" });
    updateOrganizationMock.mockResolvedValue({});

    await expect(
      caller({
        type: "active",
        userId: "user_test",
        orgId: "org_acme",
        orgGate: { bindingStatus: "bound" },
      }).organization.updateName({ slug: "acme", name: "acme-inc" })
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
    authMock.mockResolvedValue({
      has: ({ role }: { role?: string }) => role === "org:admin",
      orgId: "org_other",
      userId: "user_test",
    });

    await expect(
      caller({
        type: "active",
        userId: "user_test",
        orgId: "org_acme",
        orgGate: { bindingStatus: "bound" },
      }).organization.updateName({ slug: "acme", name: "acme-inc" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(updateOrganizationMock).not.toHaveBeenCalled();
  });

  it("rejects organization rename without the admin role", async () => {
    getOrganizationMock.mockResolvedValue({ id: "org_acme" });
    authMock.mockResolvedValue({
      has: ({ role }: { role?: string }) => role !== "org:admin",
      orgId: "org_acme",
      userId: "user_test",
    });

    await expect(
      caller({
        type: "active",
        userId: "user_test",
        orgId: "org_acme",
        orgGate: { bindingStatus: "bound" },
      }).organization.updateName({ slug: "acme", name: "acme-inc" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(updateOrganizationMock).not.toHaveBeenCalled();
  });
});
