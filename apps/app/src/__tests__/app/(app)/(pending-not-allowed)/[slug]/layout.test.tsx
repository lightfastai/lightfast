import { render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Kids {
  children?: React.ReactNode;
}

const fetchQueryMock = vi.fn();
const getActiveNamespaceByHandleMock = vi.fn();
const getBySlugQueryOptionsMock = vi.fn((input: { slug: string }) => ({
  queryKey: [["viewer", "organization", "getBySlug"], input],
}));
let headerPathname = "/acme";
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("@db/app", () => ({
  getActiveNamespaceByHandle: getActiveNamespaceByHandleMock,
}));

vi.mock("~/trpc/server", () => ({
  getQueryClient: () => ({ fetchQuery: fetchQueryMock }),
  trpc: {
    viewer: {
      organization: {
        getBySlug: { queryOptions: getBySlugQueryOptionsMock },
      },
    },
  },
}));

vi.mock("@repo/ui/components/ui/sidebar", () => ({
  SidebarInset: ({ children }: Kids) => <>{children}</>,
  SidebarProvider: ({ children }: Kids) => <>{children}</>,
  SidebarTrigger: () => null,
}));

vi.mock("@vendor/observability/error/next", () => ({
  parseError: (error: unknown) => error,
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: {
    debug: vi.fn(),
  },
}));

vi.mock("~/components/app-sidebar", () => {
  function AppSidebar() {
    return <aside data-testid="app-sidebar" />;
  }

  return { AppSidebar };
});

vi.mock("~/components/authenticated-topbar", () => {
  function AuthenticatedTopbar({ left }: { left?: React.ReactNode }) {
    return <header data-testid="authenticated-topbar">{left}</header>;
  }

  return { AuthenticatedTopbar };
});

vi.mock("~/components/errors/org-page-error-boundary", () => ({
  OrgPageErrorBoundary: ({ children }: Kids) => <>{children}</>,
}));

vi.mock("~/components/shell-data-boundary", () => ({
  ShellDataBoundary: ({ children }: Kids) => (
    <section data-testid="shell-data-boundary">{children}</section>
  ),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("next/headers", () => ({
  headers: () =>
    Promise.resolve({
      get: (name: string) =>
        name.toLowerCase() === "x-lightfast-pathname" ? headerPathname : null,
    }),
}));

const { default: OrgLayout } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/layout"
);

function invoke(slug = "acme") {
  return OrgLayout({
    children: <div>Workspace</div>,
    params: Promise.resolve({ slug }),
  });
}

describe("[slug]/layout — membership/slug access gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchQueryMock.mockReset();
    getActiveNamespaceByHandleMock.mockReset();
    getBySlugQueryOptionsMock.mockClear();
    headerPathname = "/acme";
    getActiveNamespaceByHandleMock.mockResolvedValue({
      activeOperationId: null,
      claimedClerkOrgId: "org_123",
      claimedClerkUserId: null,
      clerkOrgId: "org_123",
      clerkUserId: null,
      createdAt: new Date(),
      handle: "acme",
      id: 10,
      kind: "org",
      status: "active",
      updatedAt: new Date(),
    });
  });

  it("sends denied org access to the route not-found boundary", async () => {
    fetchQueryMock.mockRejectedValue(new Error("Organization not found"));

    await expect(invoke("acme")).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalledOnce();
  });

  it("sends nonexistent org slugs to the route not-found boundary", async () => {
    fetchQueryMock.mockRejectedValue(new Error("Organization not found"));

    await expect(invoke("acme")).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalledOnce();
  });

  it("falls back to Clerk org access while namespace backfill is pending", async () => {
    getActiveNamespaceByHandleMock.mockResolvedValue(undefined);
    fetchQueryMock.mockResolvedValue({
      bindingStatus: "bound",
      org: {
        id: "org_legacy",
        imageUrl: "",
        name: "Legacy Team",
        slug: "legacy-team",
      },
      role: "org:admin",
    });

    const element = await invoke("legacy-team");

    render(element);

    expect(getActiveNamespaceByHandleMock).toHaveBeenCalledWith(
      expect.anything(),
      "legacy-team"
    );
    expect(getBySlugQueryOptionsMock).toHaveBeenCalledWith({
      slug: "legacy-team",
    });
    expect(screen.getByTestId("shell-data-boundary")).toHaveTextContent(
      "Workspace"
    );
  });

  it("sends missing namespaces denied by Clerk org access to not-found", async () => {
    getActiveNamespaceByHandleMock.mockResolvedValue(undefined);
    fetchQueryMock.mockRejectedValue(new Error("Organization not found"));

    await expect(invoke("missing")).rejects.toThrow("NEXT_NOT_FOUND");

    expect(getBySlugQueryOptionsMock).toHaveBeenCalledWith({ slug: "missing" });
    expect(notFoundMock).toHaveBeenCalledOnce();
  });

  it("returns a UI-less membership boundary with shell data when org access is allowed", async () => {
    fetchQueryMock.mockResolvedValue({
      bindingStatus: "unbound",
      org: {
        id: "org_123",
        imageUrl: "",
        name: "Acme",
        slug: "acme",
      },
      role: "org:member",
    });

    const element = await invoke("acme");

    render(element);

    expect(screen.getByTestId("shell-data-boundary")).toHaveTextContent(
      "Workspace"
    );
    expect(
      screen.queryByTestId("authenticated-topbar")
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("app-sidebar")).not.toBeInTheDocument();
    expect(getActiveNamespaceByHandleMock).toHaveBeenCalledWith(
      expect.anything(),
      "acme"
    );
    expect(getBySlugQueryOptionsMock).toHaveBeenCalledWith({ slug: "acme" });
  });

  it("renders a user namespace root without trying org membership access", async () => {
    getActiveNamespaceByHandleMock.mockResolvedValue({
      activeOperationId: null,
      claimedClerkOrgId: null,
      claimedClerkUserId: "user_123",
      clerkOrgId: null,
      clerkUserId: "user_123",
      createdAt: new Date(),
      handle: "ada-dev",
      id: 20,
      kind: "user",
      status: "active",
      updatedAt: new Date(),
    });
    headerPathname = "/ada-dev";

    const element = await invoke("ada-dev");

    render(element);

    expect(screen.getByRole("heading", { name: "@ada-dev" })).toBeVisible();
    expect(fetchQueryMock).not.toHaveBeenCalled();
  });

  it("sends nested user namespace paths to not-found", async () => {
    getActiveNamespaceByHandleMock.mockResolvedValue({
      activeOperationId: null,
      claimedClerkOrgId: null,
      claimedClerkUserId: "user_123",
      clerkOrgId: null,
      clerkUserId: "user_123",
      createdAt: new Date(),
      handle: "ada-dev",
      id: 20,
      kind: "user",
      status: "active",
      updatedAt: new Date(),
    });
    headerPathname = "/ada-dev/settings";

    await expect(invoke("ada-dev")).rejects.toThrow("NEXT_NOT_FOUND");

    expect(fetchQueryMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledOnce();
  });
});
