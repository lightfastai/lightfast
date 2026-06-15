import React from "react";
import { describe, expect, it, vi } from "vitest";

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

vi.mock("~/components/app-sidebar", () => {
  function AppSidebar() {
    return <aside />;
  }

  return { AppSidebar };
});

const { default: TaskLayout } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/tasks/layout"
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

describe("[slug]/tasks/layout", () => {
  it("renders the authenticated topbar without the workspace sidebar", () => {
    const element = TaskLayout({ children: <div>Task</div> });

    expect(containsComponentNamed(element, "AuthenticatedTopbar")).toBe(true);
    expect(containsComponentNamed(element, "TeamSwitcher")).toBe(true);
    expect(containsComponentNamed(element, "AppSidebar")).toBe(false);
  });
});
