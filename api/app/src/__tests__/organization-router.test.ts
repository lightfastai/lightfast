import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";

const getActiveOrgBindingMock = vi.fn();
const getCurrentOrgConnectorConnectionMock = vi.fn();
const authMock = vi.fn();
const createOrganizationMock = vi.fn();
const getOrganizationMock = vi.fn();
const getOrganizationMembershipListMock = vi.fn();
const updateOrganizationMock = vi.fn();
const startNamespaceOperationMock = vi.fn();
const reserveNamespaceForOperationMock = vi.fn();
const markNamespaceOperationClerkAppliedMock = vi.fn();
const finalizeNamespaceOperationMock = vi.fn();
const deletePreClerkNamespaceReservationMock = vi.fn();
const isClerkConflictErrorMock = vi.fn();

class MockNamespaceConflictError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "NamespaceConflictError";
  }
}

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  NamespaceConflictError: MockNamespaceConflictError,
  deletePreClerkNamespaceReservation: deletePreClerkNamespaceReservationMock,
  finalizeNamespaceOperation: finalizeNamespaceOperationMock,
  getActiveOrgBinding: getActiveOrgBindingMock,
  getCurrentOrgConnectorConnection: getCurrentOrgConnectorConnectionMock,
  markNamespaceOperationClerkApplied: markNamespaceOperationClerkAppliedMock,
  reserveNamespaceForOperation: reserveNamespaceForOperationMock,
  startNamespaceOperation: startNamespaceOperationMock,
}));

vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));

vi.mock("@vendor/clerk/server", () => ({
  auth: authMock,
  clerkClient: () =>
    Promise.resolve({
      organizations: {
        createOrganization: createOrganizationMock,
        getOrganization: getOrganizationMock,
        updateOrganization: updateOrganizationMock,
      },
      users: {
        getOrganizationMembershipList: getOrganizationMembershipListMock,
      },
    }),
}));

vi.mock("../auth/clerk-errors", () => ({
  isClerkConflictError: isClerkConflictErrorMock,
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

function operation(overrides: Record<string, unknown> = {}) {
  return {
    clerkOrgId: null,
    clerkUserId: "user_test",
    id: 1,
    operationType: "create_org_slug",
    ownerKind: "org",
    status: "started",
    toHandle: "acme",
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
  createOrganizationMock.mockReset();
  getOrganizationMock.mockReset();
  getOrganizationMembershipListMock.mockReset();
  getActiveOrgBindingMock.mockReset();
  getCurrentOrgConnectorConnectionMock.mockReset();
  updateOrganizationMock.mockReset();
  startNamespaceOperationMock.mockReset();
  reserveNamespaceForOperationMock.mockReset();
  markNamespaceOperationClerkAppliedMock.mockReset();
  finalizeNamespaceOperationMock.mockReset();
  deletePreClerkNamespaceReservationMock.mockReset();
  isClerkConflictErrorMock.mockReset();

  authMock.mockResolvedValue({
    has: () => true,
    orgId: "org_acme",
    userId: "user_test",
  });
  createOrganizationMock.mockResolvedValue({ id: "org_acme", slug: "acme" });
  startNamespaceOperationMock.mockResolvedValue(operation());
  reserveNamespaceForOperationMock.mockResolvedValue(
    operation({ status: "namespace_reserved" })
  );
  markNamespaceOperationClerkAppliedMock.mockResolvedValue(
    operation({ clerkOrgId: "org_acme", status: "clerk_applied" })
  );
  finalizeNamespaceOperationMock.mockResolvedValue(
    operation({ clerkOrgId: "org_acme", status: "finalized" })
  );
  isClerkConflictErrorMock.mockReturnValue(false);
  getCurrentOrgConnectorConnectionMock.mockResolvedValue({ status: "active" });
});

describe("organization.listUserOrganizations", () => {
  it("throws UNAUTHORIZED when the caller is unauthenticated", async () => {
    const result = caller(
      unauthenticatedIdentity
    ).viewer.organization.listUserOrganizations();

    await expect(result).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(getOrganizationMembershipListMock).not.toHaveBeenCalled();
  });

  it("lists organizations beyond Clerk's first page", async () => {
    getOrganizationMembershipListMock
      .mockResolvedValueOnce({
        data: Array.from({ length: 100 }, (_, index) => ({
          organization: {
            id: `org_other_${index}`,
            imageUrl: `https://img.example.com/other-${index}.png`,
            name: `Other ${index}`,
            slug: `other-${index}`,
          },
          role: "org:member",
        })),
        totalCount: 101,
      })
      .mockResolvedValueOnce({
        data: [
          {
            organization: {
              id: "org_2",
              imageUrl: "https://img.example.com/second.png",
              name: "Second Org",
              slug: "second-org",
            },
            role: "org:admin",
          },
        ],
        totalCount: 101,
      });

    const result = await caller().viewer.organization.listUserOrganizations();

    expect(result).toHaveLength(101);
    expect(result.at(-1)).toMatchObject({
      id: "org_2",
      role: "org:admin",
      slug: "second-org",
    });
  });
});

describe("organization.getBySlug", () => {
  it("throws UNAUTHORIZED when the caller is unauthenticated", async () => {
    await expect(
      caller({ type: "unauthenticated" }).viewer.organization.getBySlug({
        slug: "acme",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(getOrganizationMembershipListMock).not.toHaveBeenCalled();
    expect(getActiveOrgBindingMock).not.toHaveBeenCalled();
  });

  it("returns the user's matching Clerk org and DB binding gate", async () => {
    getOrganizationMembershipListMock.mockResolvedValue({
      data: [
        {
          organization: {
            id: "org_acme",
            imageUrl: "https://img.test/acme.png",
            name: "Acme Inc",
            slug: "acme",
          },
          role: "org:admin",
        },
      ],
    });
    getActiveOrgBindingMock.mockResolvedValue({
      metadata: {
        lightfastRepository: {
          fullName: "lightfast-emulated/.lightfast",
          id: "987",
          installationId: "1001",
          name: ".lightfast",
          verifiedAt: "2026-05-30T10:00:00.000Z",
        },
      },
      provider: "github",
      providerAccountLogin: "lightfast-emulated",
      providerInstallationId: "1001",
    });

    await expect(
      caller().viewer.organization.getBySlug({ slug: "acme" })
    ).resolves.toEqual({
      bindingStatus: "bound",
      nextSetupRequirement: null,
      org: {
        id: "org_acme",
        imageUrl: "https://img.test/acme.png",
        initials: "AI",
        name: "Acme Inc",
        slug: "acme",
      },
      role: "org:admin",
    });
    expect(getActiveOrgBindingMock).toHaveBeenCalledWith(
      expect.anything(),
      "org_acme"
    );
  });

  it("throws NOT_FOUND when the slug is not in the user's memberships", async () => {
    getOrganizationMembershipListMock.mockResolvedValue({
      data: [
        {
          organization: {
            id: "org_other",
            imageUrl: "",
            name: "Other",
            slug: "other",
          },
          role: "org:member",
        },
      ],
    });

    await expect(
      caller().viewer.organization.getBySlug({ slug: "acme" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Organization not found",
    });
    expect(getActiveOrgBindingMock).not.toHaveBeenCalled();
  });
});

describe("organization.create", () => {
  it("throws UNAUTHORIZED when the caller is unauthenticated", async () => {
    await expect(
      caller(unauthenticatedIdentity).viewer.organization.create({
        idempotencyKey: "idem_org_1",
        slug: "acme",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(startNamespaceOperationMock).not.toHaveBeenCalled();
    expect(createOrganizationMock).not.toHaveBeenCalled();
  });

  it("creates an organization through a reserved Lightfast namespace", async () => {
    await expect(
      caller().viewer.organization.create({
        idempotencyKey: "idem_org_1",
        slug: "Acme",
      })
    ).resolves.toEqual({
      organizationId: "org_acme",
      slug: "acme",
    });

    expect(startNamespaceOperationMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkUserId: "user_test",
        idempotencyKey: "idem_org_1",
        operationType: "create_org_slug",
        ownerKind: "org",
        toHandle: "acme",
      }
    );
    expect(reserveNamespaceForOperationMock).toHaveBeenCalledWith(
      expect.anything(),
      operation()
    );
    expect(createOrganizationMock).toHaveBeenCalledWith({
      createdBy: "user_test",
      name: "acme",
      slug: "acme",
    });
    expect(markNamespaceOperationClerkAppliedMock).toHaveBeenCalledWith(
      expect.anything(),
      operation({ status: "namespace_reserved" }),
      { clerkOrgId: "org_acme" }
    );
    expect(finalizeNamespaceOperationMock).toHaveBeenCalledWith(
      expect.anything(),
      operation({ clerkOrgId: "org_acme", status: "clerk_applied" })
    );
  });

  it("rejects namespace conflicts before creating the Clerk organization", async () => {
    startNamespaceOperationMock.mockRejectedValue(
      new MockNamespaceConflictError(
        "HANDLE_ALREADY_CLAIMED",
        "Handle acme is already claimed"
      )
    );

    await expect(
      caller().viewer.organization.create({
        idempotencyKey: "idem_org_1",
        slug: "acme",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: 'An organization with the name "acme" already exists',
    });

    expect(createOrganizationMock).not.toHaveBeenCalled();
  });

  it("deletes the pre-Clerk reservation when Clerk rejects the organization slug", async () => {
    const clerkError = new Error("organization slug already exists");
    createOrganizationMock.mockRejectedValue(clerkError);
    isClerkConflictErrorMock.mockReturnValue(true);
    deletePreClerkNamespaceReservationMock.mockResolvedValue(
      operation({ status: "failed" })
    );

    await expect(
      caller().viewer.organization.create({
        idempotencyKey: "idem_org_1",
        slug: "acme",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: 'An organization with the name "acme" already exists',
    });

    expect(deletePreClerkNamespaceReservationMock).toHaveBeenCalledWith(
      expect.anything(),
      operation({ status: "namespace_reserved" }),
      {
        errorCode: "CLERK_ORG_SLUG_CONFLICT",
        errorMessage: "Clerk rejected org slug acme as already claimed",
      }
    );
    expect(markNamespaceOperationClerkAppliedMock).not.toHaveBeenCalled();
    expect(finalizeNamespaceOperationMock).not.toHaveBeenCalled();
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
          orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
        },
        adminAccess()
      ).org.settings.organization.updateName({ slug: "acme", name: "acme-inc" })
    ).resolves.toEqual({
      id: "org_acme",
      name: "acme-inc",
      success: true,
    });

    expect(getOrganizationMembershipListMock).not.toHaveBeenCalled();
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
          orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
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
          orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
        },
        nonAdminAccess()
      ).org.settings.organization.updateName({ slug: "acme", name: "acme-inc" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(updateOrganizationMock).not.toHaveBeenCalled();
  });
});
