import React from "react";
import { describe, expect, it, vi } from "vitest";

interface Kids {
  children?: React.ReactNode;
}

vi.mock("~/components/shell-data-boundary", () => ({
  ShellDataBoundary: ({ children }: Kids) => (
    <section data-testid="shell-data-boundary">{children}</section>
  ),
}));

const { default: UserLayout } = await import(
  "~/app/(app)/(pending-allowed)/layout"
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

describe("user layout", () => {
  it("uses the shared shell data boundary and user layout shell", () => {
    const element = UserLayout({ children: <div>Account page</div> });

    expect(containsComponentNamed(element, "ShellDataBoundary")).toBe(true);
    expect(containsComponentNamed(element, "UserLayoutShell")).toBe(true);
  });
});
