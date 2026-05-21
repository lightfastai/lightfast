import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";

const getUserOrgMembershipsMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));

vi.mock("@vendor/clerk/server", () => ({
  auth: vi.fn(),
  clerkClient: () =>
    Promise.resolve({
      organizations: {
        createOrganization: vi.fn(),
        getOrganization: vi.fn(),
        updateOrganization: vi.fn(),
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
  getUserOrgMembershipsMock.mockReset();
});

describe("organization.getBySlug", () => {
  it("throws UNAUTHORIZED when the caller is unauthenticated", async () => {
    await expect(
      caller({ type: "unauthenticated" }).organization.getBySlug({
        slug: "acme",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(getUserOrgMembershipsMock).not.toHaveBeenCalled();
  });

  it("returns the user's matching Clerk org", async () => {
    getUserOrgMembershipsMock.mockResolvedValue([
      {
        imageUrl: "https://img.test/acme.png",
        organizationId: "org_acme",
        organizationName: "Acme Inc",
        organizationSlug: "acme",
        role: "org:admin",
      },
    ]);
    await expect(
      caller().organization.getBySlug({ slug: "acme" })
    ).resolves.toEqual({
      org: {
        id: "org_acme",
        imageUrl: "https://img.test/acme.png",
        initials: "AI",
        name: "Acme Inc",
        slug: "acme",
      },
      role: "org:admin",
    });
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
  });
});
