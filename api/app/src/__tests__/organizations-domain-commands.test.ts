import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";
import { OrgAccessError } from "../auth/organization-access";
import { actorFromAuthIdentity } from "../domain";
import {
  createDefaultOrganizationCommandDeps,
  createOrganizationCommand,
  getOrganizationBySlugCommand,
  listUserOrganizationsCommand,
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
const getOrganizationMock = vi.fn();
const updateOrganizationMock = vi.fn();
const isClerkConflictErrorMock = vi.fn();
const logInfoMock = vi.fn();
const logErrorMock = vi.fn();

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

function deps() {
  return createDefaultOrganizationCommandDeps({
    clerk: {
      organizations: {
        createOrganization: createOrganizationMock,
        getOrganization: getOrganizationMock,
        updateOrganization: updateOrganizationMock,
      },
    },
    db: {} as Database,
    deletePreClerkNamespaceReservation: deletePreClerkNamespaceReservationMock,
    finalizeNamespaceOperation: finalizeNamespaceOperationMock,
    getOrgAccessBySlug: getOrgAccessBySlugMock,
    isClerkConflictError: isClerkConflictErrorMock,
    listUserOrganizationMemberships: listUserOrganizationMembershipsMock,
    log: { error: logErrorMock, info: logInfoMock },
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
  getOrganizationMock.mockReset();
  getOrganizationMock.mockResolvedValue({ id: "org_acme" });
  updateOrganizationMock.mockReset();
  updateOrganizationMock.mockResolvedValue({});
  isClerkConflictErrorMock.mockReset();
  isClerkConflictErrorMock.mockReturnValue(false);
  logInfoMock.mockReset();
  logErrorMock.mockReset();
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
});
