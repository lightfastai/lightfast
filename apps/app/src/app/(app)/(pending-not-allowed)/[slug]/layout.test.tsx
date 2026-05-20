import React from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@repo/app-trpc/server", () => ({
  HydrateClient: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
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

describe("org layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the authenticated header shell when org access is denied", async () => {
    (requireOrgAccess as Mock).mockRejectedValue(new Error("denied"));

    const element = await OrgLayout({
      children: <div>Workspace</div>,
      params: Promise.resolve({ slug: "missing-team" }),
    });

    expect(containsComponentNamed(element, "AuthenticatedTopbar")).toBe(true);
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

    const element = await OrgLayout({
      children: <div>Workspace</div>,
      params: Promise.resolve({ slug: "acme" }),
    });

    expect(containsComponentNamed(element, "AuthenticatedTopbar")).toBe(true);
    expect(containsComponentNamed(element, "AppSidebar")).toBe(true);
  });
});
