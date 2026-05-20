import React from "react";
import { describe, expect, it } from "vitest";
import UserLayout from "./layout";

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
  it("uses the shared authenticated topbar", () => {
    const element = UserLayout({ children: <div>Account page</div> });

    expect(containsComponentNamed(element, "AuthenticatedTopbar")).toBe(true);
  });
});
