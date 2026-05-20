import React from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

interface Kids {
  children?: React.ReactNode;
}

vi.mock("@repo/app-trpc/server", () => ({
  HydrateClient: ({ children }: Kids) => <>{children}</>,
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

vi.mock("~/components/team-switcher", () => ({
  TeamSwitcher: () => null,
  TeamSwitcherSkeleton: () => null,
}));

vi.mock("~/lib/org-access-clerk", () => ({
  requireOrgAccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { requireOrgAccess } = await import("~/lib/org-access-clerk");
const { default: OrgLayout } = await import("./layout");

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
  });

  it("returns the authenticated 404 shell when org access is denied", async () => {
    (requireOrgAccess as Mock).mockRejectedValue(
      new Error("Access denied to this organization.")
    );

    const element = await invoke("acme");

    expect(containsComponentNamed(element, "AuthenticatedTopbar")).toBe(true);
    expect(containsComponentNamed(element, "OrgAccessNotFound")).toBe(true);
    expect(containsComponentNamed(element, "AppSidebar")).toBe(false);
  });

  it("returns the authenticated 404 shell when the org slug does not exist", async () => {
    (requireOrgAccess as Mock).mockRejectedValue(
      new Error("Organization not found: acme")
    );

    const element = await invoke("acme");

    expect(containsComponentNamed(element, "AuthenticatedTopbar")).toBe(true);
    expect(containsComponentNamed(element, "OrgAccessNotFound")).toBe(true);
    expect(containsComponentNamed(element, "AppSidebar")).toBe(false);
  });

  it("returns the org sidebar shell when org access is allowed", async () => {
    (requireOrgAccess as Mock).mockResolvedValue({
      org: {
        id: "org_123",
        imageUrl: "",
        name: "Acme",
        slug: "acme",
      },
      role: "org:member",
    });

    const element = await invoke("acme");

    expect(containsComponentNamed(element, "AuthenticatedTopbar")).toBe(true);
    expect(containsComponentNamed(element, "AppSidebar")).toBe(true);
    expect(containsComponentNamed(element, "OrgAccessNotFound")).toBe(false);
  });
});
