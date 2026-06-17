import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";
import { OrgAccessError } from "../auth/organization-access";
import { actorFromAuthIdentity } from "../domain";
import {
  createDefaultOrganizationCommandDeps,
  createOrganizationCommand,
  getOrganizationBySlugCommand,
  listOrganizationDomainsCommand,
  listUserOrganizationsCommand,
  updateOrganizationDomainsCommand,
  updateOrganizationNameCommand,
} from "../domain/organizations";

const listUserOrganizationMembershipsMock = vi.fn();
const getOrgAccessBySlugMock = vi.fn();
const startNamespaceOperationMock = vi.fn();
const reserveNamespaceForOperationMock = vi.fn();
const markNamespaceOperationClerkAppliedMock = vi.fn();
const finalizeNamespaceOperationMock = vi.fn();
const deletePreClerkNamespaceReservationMock = vi.fn();
const createOrganizationMock = vi.fn();
const createOrganizationDomainMock = vi.fn();
const deleteOrganizationDomainMock = vi.fn();
const getOrganizationMock = vi.fn();
const getOrganizationDomainListMock = vi.fn();
const updateOrganizationMock = vi.fn();
const updateOrganizationDomainMock = vi.fn();
const isClerkConflictErrorMock = vi.fn();
const isClerkOrganizationDomainsNotEnabledMock = vi.fn();
const logInfoMock = vi.fn();
const logErrorMock = vi.fn();
const logWarnMock = vi.fn();

const { MockNamespaceConflictError } = vi.hoisted(() => ({
  MockNamespaceConflictError: class MockNamespaceConflictError extends Error {
    readonly code: string;

    constructor(code: string, message: string) {
      super(message);
      this.name = "NamespaceConflictError";
      this.code = code;
    }
  },
}));

vi.mock("@db/app", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@db/app")>()),
  NamespaceConflictError: MockNamespaceConflictError,
}));

const pendingIdentity: AuthIdentity = {
  type: "pending",
  userId: "user_test",
};

const activeIdentity: Extract<AuthIdentity, { type: "active" }> = {
  type: "active",
  userId: "user_test",
  orgId: "org_acme",
  orgGate: { bindingStatus: "unbound", nextSetupRequirement: "github_org" },
};

function ctx(
  identity: AuthIdentity = activeIdentity,
  { admin = false }: { admin?: boolean } = {}
) {
  return {
    actor: {
      ...actorFromAuthIdentity(identity, "web"),
      ...(admin ? { orgRole: "admin" } : {}),
    },
    request: { id: "req_test", source: "tanstack" as const },
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

function membership(overrides: Record<string, unknown> = {}) {
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

function deps() {
  return createDefaultOrganizationCommandDeps({
    clerk: {
      organizations: {
        createOrganization: createOrganizationMock,
        createOrganizationDomain: createOrganizationDomainMock,
        deleteOrganizationDomain: deleteOrganizationDomainMock,
        getOrganization: getOrganizationMock,
        getOrganizationDomainList: getOrganizationDomainListMock,
        updateOrganization: updateOrganizationMock,
        updateOrganizationDomain: updateOrganizationDomainMock,
      },
    },
    db: {} as Database,
    deletePreClerkNamespaceReservation: deletePreClerkNamespaceReservationMock,
    finalizeNamespaceOperation: finalizeNamespaceOperationMock,
    getOrgAccessBySlug: getOrgAccessBySlugMock,
    isClerkConflictError: isClerkConflictErrorMock,
    isClerkOrganizationDomainsNotEnabled:
      isClerkOrganizationDomainsNotEnabledMock,
    listUserOrganizationMemberships: listUserOrganizationMembershipsMock,
    log: { error: logErrorMock, info: logInfoMock, warn: logWarnMock },
    markNamespaceOperationClerkApplied: markNamespaceOperationClerkAppliedMock,
    reserveNamespaceForOperation: reserveNamespaceForOperationMock,
    startNamespaceOperation: startNamespaceOperationMock,
  });
}

beforeEach(() => {
  listUserOrganizationMembershipsMock.mockReset();
  listUserOrganizationMembershipsMock.mockResolvedValue([membership()]);
  getOrgAccessBySlugMock.mockReset();
  getOrgAccessBySlugMock.mockResolvedValue({
    bindingStatus: "unbound",
    nextSetupRequirement: "github_org",
    org: {
      id: "org_acme",
      imageUrl: "https://img.test/acme.png",
      initials: "AI",
      name: "Acme Inc",
      slug: "acme",
    },
    role: "org:admin",
  });
  startNamespaceOperationMock.mockReset();
  startNamespaceOperationMock.mockResolvedValue(operation());
  reserveNamespaceForOperationMock.mockReset();
  reserveNamespaceForOperationMock.mockResolvedValue(
    operation({ status: "namespace_reserved" })
  );
  markNamespaceOperationClerkAppliedMock.mockReset();
  markNamespaceOperationClerkAppliedMock.mockResolvedValue(
    operation({ clerkOrgId: "org_acme", status: "clerk_applied" })
  );
  finalizeNamespaceOperationMock.mockReset();
  finalizeNamespaceOperationMock.mockResolvedValue(
    operation({ clerkOrgId: "org_acme", status: "finalized" })
  );
  deletePreClerkNamespaceReservationMock.mockReset();
  createOrganizationMock.mockReset();
  createOrganizationMock.mockResolvedValue({ id: "org_acme", slug: "acme" });
  createOrganizationDomainMock.mockReset();
  createOrganizationDomainMock.mockResolvedValue(
    organizationDomain({ id: "orgdmn_new", name: "new.com" })
  );
  deleteOrganizationDomainMock.mockReset();
  deleteOrganizationDomainMock.mockResolvedValue({});
  getOrganizationMock.mockReset();
  getOrganizationMock.mockResolvedValue({ id: "org_acme" });
  getOrganizationDomainListMock.mockReset();
  getOrganizationDomainListMock.mockResolvedValue({ data: [] });
  updateOrganizationMock.mockReset();
  updateOrganizationMock.mockResolvedValue({});
  updateOrganizationDomainMock.mockReset();
  updateOrganizationDomainMock.mockResolvedValue(
    organizationDomain({ id: "orgdmn_lightfast", name: "lightfast.ai" })
  );
  isClerkConflictErrorMock.mockReset();
  isClerkConflictErrorMock.mockReturnValue(false);
  isClerkOrganizationDomainsNotEnabledMock.mockReset();
  isClerkOrganizationDomainsNotEnabledMock.mockReturnValue(false);
  logInfoMock.mockReset();
  logErrorMock.mockReset();
  logWarnMock.mockReset();
});

describe("organization domain commands", () => {
  it("lists memberships for a pending Clerk user", async () => {
    await expect(
      listUserOrganizationsCommand.run({
        ctx: ctx(pendingIdentity),
        deps: deps(),
        input: {},
      })
    ).resolves.toEqual([
      {
        id: "org_acme",
        imageUrl: "https://img.test/acme.png",
        initials: "AI",
        name: "Acme Inc",
        role: "org:admin",
        slug: "acme",
      },
    ]);

    expect(listUserOrganizationMembershipsMock).toHaveBeenCalledWith({
      userId: "user_test",
    });
  });

  it("loads organization access by slug for the signed-in user", async () => {
    await expect(
      getOrganizationBySlugCommand.run({
        ctx: ctx(pendingIdentity),
        deps: deps(),
        input: { slug: "acme" },
      })
    ).resolves.toMatchObject({
      bindingStatus: "unbound",
      nextSetupRequirement: "github_org",
      org: { id: "org_acme", slug: "acme" },
    });

    expect(getOrgAccessBySlugMock).toHaveBeenCalledWith({
      db: expect.anything(),
      slug: "acme",
      userId: "user_test",
    });
  });

  it("maps inaccessible slugs to a domain not found error", async () => {
    getOrgAccessBySlugMock.mockRejectedValueOnce(new OrgAccessError());

    await expect(
      getOrganizationBySlugCommand.run({
        ctx: ctx(pendingIdentity),
        deps: deps(),
        input: { slug: "missing" },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "ORG_NOT_FOUND",
        kind: "not_found",
      })
    );
  });

  it("creates an organization through a reserved Lightfast namespace", async () => {
    await expect(
      createOrganizationCommand.run({
        ctx: ctx(pendingIdentity),
        deps: deps(),
        input: { idempotencyKey: "idem_org_1", slug: "Acme" },
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
    expect(createOrganizationMock).toHaveBeenCalledWith({
      createdBy: "user_test",
      name: "acme",
      slug: "acme",
    });
    expect(finalizeNamespaceOperationMock).toHaveBeenCalledWith(
      expect.anything(),
      operation({ clerkOrgId: "org_acme", status: "clerk_applied" })
    );
  });

  it("requires active org admin authority to rename an organization", async () => {
    await expect(
      updateOrganizationNameCommand.run({
        ctx: ctx(activeIdentity, { admin: true }),
        deps: deps(),
        input: { slug: "acme", name: "acme-inc" },
      })
    ).resolves.toEqual({
      id: "org_acme",
      name: "acme-inc",
      success: true,
    });

    expect(updateOrganizationMock).toHaveBeenCalledWith("org_acme", {
      name: "acme-inc",
      slug: "acme-inc",
    });

    await expect(
      updateOrganizationNameCommand.run({
        ctx: ctx(activeIdentity),
        deps: deps(),
        input: { slug: "acme", name: "acme-inc" },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "PERMISSION_REQUIRED",
        kind: "authz",
      })
    );
  });

  it("lists organization domains for an accessible slug", async () => {
    getOrganizationDomainListMock.mockResolvedValueOnce({
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
      listOrganizationDomainsCommand.run({
        ctx: ctx(pendingIdentity),
        deps: deps(),
        input: { slug: "acme" },
      })
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

    expect(getOrgAccessBySlugMock).toHaveBeenCalledWith({
      db: expect.anything(),
      slug: "acme",
      userId: "user_test",
    });
    expect(getOrganizationDomainListMock).toHaveBeenCalledWith({
      limit: 100,
      organizationId: "org_acme",
    });
  });

  it("returns disabled organization domains when Clerk does not support them", async () => {
    const error = new Error("domains unavailable");
    isClerkOrganizationDomainsNotEnabledMock.mockReturnValue(true);
    getOrganizationDomainListMock.mockRejectedValueOnce(error);

    await expect(
      listOrganizationDomainsCommand.run({
        ctx: ctx(pendingIdentity),
        deps: deps(),
        input: { slug: "acme" },
      })
    ).resolves.toEqual({ domains: [], enabled: false });

    expect(logWarnMock).toHaveBeenCalledWith(
      "[organization] domains unavailable",
      expect.objectContaining({ organizationId: "org_acme" })
    );
  });

  it("reconciles organization domains for the active admin organization", async () => {
    getOrganizationDomainListMock
      .mockResolvedValueOnce({
        data: [
          organizationDomain({ id: "orgdmn_acme", name: "acme.com" }),
          organizationDomain({
            enrollmentMode: undefined,
            enrollment_mode: "manual_invitation",
            id: "orgdmn_lightfast",
            name: "lightfast.ai",
          }),
          organizationDomain({ id: "orgdmn_old", name: "old.com" }),
        ],
      })
      .mockResolvedValueOnce({
        data: [
          organizationDomain({ id: "orgdmn_acme", name: "acme.com" }),
          organizationDomain({
            id: "orgdmn_lightfast",
            name: "lightfast.ai",
          }),
          organizationDomain({ id: "orgdmn_new", name: "new.com" }),
        ],
      });

    await expect(
      updateOrganizationDomainsCommand.run({
        ctx: ctx(activeIdentity, { admin: true }),
        deps: deps(),
        input: {
          domains: [" Lightfast.AI ", "new.com", "acme.com", "lightfast.ai"],
          slug: "acme",
        },
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
    expect(createOrganizationDomainMock).toHaveBeenCalledTimes(1);
    expect(deleteOrganizationDomainMock).toHaveBeenCalledWith({
      domainId: "orgdmn_old",
      organizationId: "org_acme",
    });
  });

  it("rejects organization domain updates for a different active org", async () => {
    await expect(
      updateOrganizationDomainsCommand.run({
        ctx: ctx(
          {
            ...activeIdentity,
            orgId: "org_other",
          },
          { admin: true }
        ),
        deps: deps(),
        input: { domains: ["acme.com"], slug: "acme" },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "ORG_NOT_FOUND",
        kind: "not_found",
      })
    );

    expect(createOrganizationDomainMock).not.toHaveBeenCalled();
    expect(deleteOrganizationDomainMock).not.toHaveBeenCalled();
    expect(updateOrganizationDomainMock).not.toHaveBeenCalled();
  });
});
