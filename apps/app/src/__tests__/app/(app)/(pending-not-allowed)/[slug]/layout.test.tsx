import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Kids {
  children?: React.ReactNode;
}

const fetchQueryMock = vi.fn();
const getBySlugQueryOptionsMock = vi.fn((input: { slug: string }) => ({
  queryKey: [["viewer", "organization", "getBySlug"], input],
}));
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("@repo/app-trpc/server", () => ({
  getQueryClient: () => ({ fetchQuery: fetchQueryMock }),
  HydrateClient: ({ children }: Kids) => <>{children}</>,
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
    return <header>{left}</header>;
  }

  return { AuthenticatedTopbar };
});

vi.mock("~/components/errors/org-page-error-boundary", () => ({
  OrgPageErrorBoundary: ({ children }: Kids) => <>{children}</>,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

const { default: OrgLayout } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/layout"
);

function containsComponentNamed(node: unknown, componentName: string): boolean {
  if (!React.isValidElement(node)) {
    return false;
  }

  const type = node.type;
  if (typeof type === "function" && type.name === componentName) {
    return true;
  }

  const props = node.props as { children?: React.ReactNode };
  return React.Children.toArray(props.children).some((child) =>
    containsComponentNamed(child, componentName)
  );
}

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
    getBySlugQueryOptionsMock.mockClear();
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

  it("returns a UI-less membership boundary when org access is allowed", async () => {
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

    expect(containsComponentNamed(element, "AuthenticatedTopbar")).toBe(false);
    expect(containsComponentNamed(element, "AppSidebar")).toBe(false);
    expect(getBySlugQueryOptionsMock).toHaveBeenCalledWith({ slug: "acme" });
  });
});
