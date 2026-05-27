import { render, screen } from "@testing-library/react";
import type React from "react";
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
    expect(getBySlugQueryOptionsMock).toHaveBeenCalledWith({ slug: "acme" });
  });
});
