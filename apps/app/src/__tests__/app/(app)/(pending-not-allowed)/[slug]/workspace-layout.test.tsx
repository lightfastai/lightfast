import React from "react";
import { describe, expect, it, vi } from "vitest";

interface Kids {
  children?: React.ReactNode;
}

vi.mock("@repo/ui/components/ui/sidebar", () => ({
  SidebarInset: ({ children }: Kids) => <>{children}</>,
  SidebarProvider: ({ children }: Kids) => <>{children}</>,
  SidebarTrigger: function SidebarTrigger() {
    return <button data-testid="sidebar-trigger" type="button" />;
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

vi.mock("~/components/team-switcher", () => {
  function TeamSwitcher() {
    return <div data-testid="team-switcher" />;
  }

  function TeamSwitcherSkeleton() {
    return <div data-testid="team-switcher-skeleton" />;
  }

  return { TeamSwitcher, TeamSwitcherSkeleton };
});

const { default: WorkspaceLayout } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/layout"
);

function containsComponentNamed(node: unknown, componentName: string): boolean {
  if (!React.isValidElement(node)) {
    return false;
  }

  const type = node.type;
  if (typeof type === "function" && type.name === componentName) {
    return true;
  }

  const props = node.props as {
    children?: React.ReactNode;
    left?: React.ReactNode;
  };
  return [props.children, props.left]
    .flatMap((slot) => React.Children.toArray(slot))
    .some((child) => containsComponentNamed(child, componentName));
}

describe("[slug]/(workspace)/layout", () => {
  it("renders the workspace sidebar shell with the mobile trigger in the topbar", async () => {
    const element = await WorkspaceLayout({
      children: <div>Workspace</div>,
    });

    expect(containsComponentNamed(element, "AuthenticatedTopbar")).toBe(true);
    expect(containsComponentNamed(element, "AppSidebar")).toBe(true);
    expect(containsComponentNamed(element, "SidebarTrigger")).toBe(true);
    expect(containsComponentNamed(element, "TeamSwitcher")).toBe(false);
  });
});
