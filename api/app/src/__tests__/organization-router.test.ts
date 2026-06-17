import type { Database } from "@db/app";
import { ClerkAPIResponseError } from "@vendor/clerk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";

const getActiveOrgBindingMock = vi.fn();
const getCurrentOrgConnectorConnectionMock = vi.fn();
const authMock = vi.fn();
const createOrganizationDomainMock = vi.fn();
const deleteOrganizationDomainMock = vi.fn();
const getOrganizationDomainListMock = vi.fn();
const getOrganizationMembershipListMock = vi.fn();
const updateOrganizationDomainMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  getActiveOrgBinding: getActiveOrgBindingMock,
  getCurrentOrgConnectorConnection: getCurrentOrgConnectorConnectionMock,
}));

vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));

vi.mock("@vendor/clerk/server", () => ({
  auth: authMock,
  clerkClient: () =>
    Promise.resolve({
      organizations: {
        createOrganizationDomain: createOrganizationDomainMock,
        deleteOrganizationDomain: deleteOrganizationDomainMock,
        getOrganizationDomainList: getOrganizationDomainListMock,
        updateOrganizationDomain: updateOrganizationDomainMock,
      },
      users: {
        getOrganizationMembershipList: getOrganizationMembershipListMock,
      },
    }),
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
const { orgSettingsOrganizationRouter } = await import(
  "../router/(pending-allowed)/organization"
);

const testRouter = createTRPCRouter({
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

function activeIdentity(
  overrides: { orgId?: string; userId?: string } = {}
): AuthIdentity {
  return {
    type: "active",
    userId: overrides.userId ?? "user_test",
    orgId: overrides.orgId ?? "org_acme",
    orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
  };
}

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

function organizationDomain(overrides: Record<string, unknown> = {}) {
  return {
    affiliationEmailAddress: null,
    createdAt: 1_765_000_000_000,
    enrollmentMode: "automatic_invitation",
    id: "orgdmn_acme",
    name: "acme.com",
    organizationId: "org_acme",
    totalPendingInvitations: 0,
    totalPendingSuggestions: 0,
    updatedAt: 1_765_000_000_000,
    verification: { status: "verified" },
    ...overrides,
  };
}

function clerkOrganizationDomainsNotEnabledError() {
  return new ClerkAPIResponseError("Forbidden", {
    clerkTraceId: "trace_org_domains_disabled",
    data: [
      {
        code: "organization_domains_not_enabled",
        long_message:
          "This instance does not have domains enabled for organizations.",
        message: "organization domains not enabled",
      },
    ],
    retryAfter: undefined,
    status: 403,
  });
}

function organizationMembership(overrides: Record<string, unknown> = {}) {
  return {
    organization: {
      id: "org_acme",
      imageUrl: "https://img.test/acme.png",
      name: "Acme Inc",
      slug: "acme",
    },
    role: "org:admin",
    ...overrides,
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
  createOrganizationDomainMock.mockReset();
  deleteOrganizationDomainMock.mockReset();
  getOrganizationDomainListMock.mockReset();
  getOrganizationMembershipListMock.mockReset();
  getActiveOrgBindingMock.mockReset();
  getCurrentOrgConnectorConnectionMock.mockReset();
  updateOrganizationDomainMock.mockReset();

  authMock.mockResolvedValue({
    has: () => true,
    orgId: "org_acme",
    userId: "user_test",
  });
  getOrganizationMembershipListMock.mockResolvedValue({
    data: [organizationMembership()],
    totalCount: 1,
  });
  createOrganizationDomainMock.mockResolvedValue(
    organizationDomain({ id: "orgdmn_new", name: "new.com" })
  );
  deleteOrganizationDomainMock.mockResolvedValue({});
  getOrganizationDomainListMock.mockResolvedValue({ data: [] });
  updateOrganizationDomainMock.mockResolvedValue(
    organizationDomain({ id: "orgdmn_lightfast", name: "lightfast.ai" })
  );
  getCurrentOrgConnectorConnectionMock.mockResolvedValue({ status: "active" });
});

describe("organization domains", () => {
  it("lists domains for the requested organization slug", async () => {
    getOrganizationDomainListMock.mockResolvedValue({
      data: [
        organizationDomain({
          enrollmentMode: undefined,
          enrollment_mode: "automatic_invitation",
          id: "orgdmn_lightfast",
          name: "Lightfast.AI",
          verification: { status: "verified" },
        }),
      ],
    });

    await expect(
      caller().org.settings.organization.listDomains({ slug: "acme" })
    ).resolves.toEqual({
      domains: [
        {
          enrollmentMode: "automatic_invitation",
          id: "orgdmn_lightfast",
          name: "lightfast.ai",
          verificationStatus: "verified",
        },
      ],
      enabled: true,
    });

    expect(getOrganizationDomainListMock).toHaveBeenCalledWith({
      limit: 100,
      organizationId: "org_acme",
    });
  });

  it("returns an empty list when Clerk organization domains are unavailable", async () => {
    getOrganizationDomainListMock.mockRejectedValue(
      clerkOrganizationDomainsNotEnabledError()
    );

    await expect(
      caller().org.settings.organization.listDomains({ slug: "acme" })
    ).resolves.toEqual({ domains: [], enabled: false });
  });

  it("rejects domain updates when Clerk organization domains are unavailable", async () => {
    getOrganizationDomainListMock.mockRejectedValue(
      clerkOrganizationDomainsNotEnabledError()
    );

    await expect(
      caller(
        activeIdentity(),
        adminAccess()
      ).org.settings.organization.updateDomains({
        domains: ["acme.com"],
        slug: "acme",
      })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    expect(createOrganizationDomainMock).not.toHaveBeenCalled();
    expect(deleteOrganizationDomainMock).not.toHaveBeenCalled();
    expect(updateOrganizationDomainMock).not.toHaveBeenCalled();
  });

  it("reconciles auto-join domains for the requested admin organization slug", async () => {
    getOrganizationDomainListMock
      .mockResolvedValueOnce({
        data: [
          organizationDomain({
            id: "orgdmn_acme",
            name: "acme.com",
          }),
          organizationDomain({
            enrollmentMode: undefined,
            enrollment_mode: "manual_invitation",
            id: "orgdmn_lightfast",
            name: "lightfast.ai",
          }),
          organizationDomain({
            id: "orgdmn_old",
            name: "old.com",
          }),
        ],
      })
      .mockResolvedValueOnce({
        data: [
          organizationDomain({
            id: "orgdmn_acme",
            name: "acme.com",
          }),
          organizationDomain({
            id: "orgdmn_lightfast",
            name: "lightfast.ai",
          }),
          organizationDomain({
            id: "orgdmn_new",
            name: "new.com",
          }),
        ],
      });

    await expect(
      caller(
        activeIdentity(),
        adminAccess()
      ).org.settings.organization.updateDomains({
        domains: [" Lightfast.AI ", "new.com", "acme.com", "lightfast.ai"],
        slug: "acme",
      })
    ).resolves.toEqual([
      {
        enrollmentMode: "automatic_invitation",
        id: "orgdmn_acme",
        name: "acme.com",
        verificationStatus: "verified",
      },
      {
        enrollmentMode: "automatic_invitation",
        id: "orgdmn_lightfast",
        name: "lightfast.ai",
        verificationStatus: "verified",
      },
      {
        enrollmentMode: "automatic_invitation",
        id: "orgdmn_new",
        name: "new.com",
        verificationStatus: "verified",
      },
    ]);

    expect(updateOrganizationDomainMock).toHaveBeenCalledWith({
      domainId: "orgdmn_lightfast",
      enrollmentMode: "automatic_invitation",
      organizationId: "org_acme",
      verified: true,
    });
    expect(createOrganizationDomainMock).toHaveBeenCalledWith({
      enrollmentMode: "automatic_invitation",
      name: "new.com",
      organizationId: "org_acme",
      verified: true,
    });
    const createCallOrder =
      createOrganizationDomainMock.mock.invocationCallOrder[0];
    const deleteCallOrder =
      deleteOrganizationDomainMock.mock.invocationCallOrder[0];
    expect(createCallOrder).toBeDefined();
    expect(deleteCallOrder).toBeDefined();
    expect(createCallOrder!).toBeLessThan(deleteCallOrder!);
    expect(deleteOrganizationDomainMock).toHaveBeenCalledWith({
      domainId: "orgdmn_old",
      organizationId: "org_acme",
    });
  });

  it("rejects domain updates when the caller has no active organization", async () => {
    await expect(
      caller().org.settings.organization.updateDomains({
        domains: ["acme.com"],
        slug: "acme",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(getOrganizationDomainListMock).not.toHaveBeenCalled();
    expect(createOrganizationDomainMock).not.toHaveBeenCalled();
    expect(deleteOrganizationDomainMock).not.toHaveBeenCalled();
    expect(updateOrganizationDomainMock).not.toHaveBeenCalled();
  });

  it("rejects domain updates when the active organization differs from the requested slug", async () => {
    await expect(
      caller(
        activeIdentity({ orgId: "org_other" }),
        adminAccess({ orgId: "org_other" })
      ).org.settings.organization.updateDomains({
        domains: ["acme.com"],
        slug: "acme",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(createOrganizationDomainMock).not.toHaveBeenCalled();
    expect(deleteOrganizationDomainMock).not.toHaveBeenCalled();
    expect(updateOrganizationDomainMock).not.toHaveBeenCalled();
  });

  it("rejects domain updates without the admin role", async () => {
    await expect(
      caller(
        activeIdentity(),
        nonAdminAccess()
      ).org.settings.organization.updateDomains({
        domains: ["acme.com"],
        slug: "acme",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(createOrganizationDomainMock).not.toHaveBeenCalled();
    expect(deleteOrganizationDomainMock).not.toHaveBeenCalled();
    expect(updateOrganizationDomainMock).not.toHaveBeenCalled();
  });
});
