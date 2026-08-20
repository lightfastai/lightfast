import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class NamespaceConflictError extends Error {}

  const command = () => ({ input: { parse: (value: unknown) => value } });

  return {
    command,
    db: { kind: "mock-db" },
    getActiveNamespaceByHandle: vi.fn(),
    NamespaceConflictError,
    setResponseHeader: vi.fn(),
  };
});

vi.mock("@db/app", () => ({
  deletePreClerkNamespaceReservation: vi.fn(),
  finalizeNamespaceOperation: vi.fn(),
  getActiveNamespaceByHandle: mocks.getActiveNamespaceByHandle,
  markNamespaceOperationClerkApplied: vi.fn(),
  NamespaceConflictError: mocks.NamespaceConflictError,
  reserveNamespaceForOperation: vi.fn(),
  startNamespaceOperation: vi.fn(),
}));

vi.mock("@db/app/client", () => ({ db: mocks.db }));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    handler: (handler: (input?: unknown) => unknown) => (input?: unknown) =>
      handler(input),
    inputValidator: (validator: { parse: (input: unknown) => unknown }) => ({
      handler:
        (handler: (input: { data: unknown }) => unknown) =>
        (input: { data: unknown }) =>
          handler({ data: validator.parse(input.data) }),
    }),
  }),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://lightfast.ai/not-a-real-route"),
  setResponseHeader: mocks.setResponseHeader,
}));

vi.mock("@vendor/clerk/server", () => ({
  clerkClient: vi.fn(),
}));

vi.mock("@vendor/observability/error/next", () => ({
  parseError: vi.fn(),
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: vi.fn(),
}));

vi.mock("../auth/clerk-errors", () => ({
  isClerkConflictError: vi.fn(),
  isClerkOrganizationDomainsNotEnabled: vi.fn(),
}));

vi.mock("../auth/clerk-org-membership", () => ({
  listUserOrganizationMemberships: vi.fn(),
}));

vi.mock("../auth/identity", () => ({
  resolveAuthContextFromClerk: vi.fn(),
}));

vi.mock("../auth/organization-access", () => ({
  getOrgAccessBySlug: vi.fn(),
  isOrgAccessError: vi.fn(),
}));

vi.mock("../domain", () => ({
  actorFromAuthIdentity: vi.fn(),
  isDomainError: vi.fn(),
}));

vi.mock("../domain/organizations", () => ({
  createOrganizationCommand: mocks.command(),
  getOrganizationBySlugCommand: mocks.command(),
  listOrganizationDomainsCommand: mocks.command(),
  listUserOrganizationsCommand: mocks.command(),
  updateOrganizationDomainsCommand: mocks.command(),
  updateOrganizationNameCommand: mocks.command(),
}));

const organizationsAdapter = await import("../adapters/tanstack/organizations");

describe("organization route TanStack adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts only active organization namespaces as top-level app routes", async () => {
    const organizationRouteExists =
      organizationsAdapter.organizationRouteExists;

    expect(organizationRouteExists).toBeTypeOf("function");

    mocks.getActiveNamespaceByHandle.mockResolvedValueOnce(undefined);
    await expect(
      organizationRouteExists?.({ data: { slug: "not-a-real-route" } })
    ).resolves.toBe(false);

    mocks.getActiveNamespaceByHandle.mockResolvedValueOnce({
      kind: "user",
      status: "active",
    });
    await expect(
      organizationRouteExists?.({ data: { slug: "existing-user" } })
    ).resolves.toBe(false);

    mocks.getActiveNamespaceByHandle.mockResolvedValueOnce({
      kind: "org",
      status: "active",
    });
    await expect(
      organizationRouteExists?.({ data: { slug: "existing-team" } })
    ).resolves.toBe(true);

    expect(mocks.getActiveNamespaceByHandle).toHaveBeenNthCalledWith(
      1,
      mocks.db,
      "not-a-real-route"
    );
  });
});
