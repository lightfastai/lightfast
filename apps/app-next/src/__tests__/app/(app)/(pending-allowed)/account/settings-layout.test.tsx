import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import AccountSettingsLayout from "~/app/(app)/(pending-allowed)/account/settings/layout";

function findHeadingByText(
  node: unknown,
  text: string
): React.ReactElement<{ className?: string }> | null {
  if (!React.isValidElement(node)) {
    return null;
  }

  const props = node.props as { children?: React.ReactNode };
  if (node.type === "h1" && props.children === text) {
    return node as React.ReactElement<{ className?: string }>;
  }

  for (const child of React.Children.toArray(props.children)) {
    const match = findHeadingByText(child, text);
    if (match) {
      return match;
    }
  }

  return null;
}

function findHeadingWrapperClassName(node: unknown, text: string): string {
  if (!React.isValidElement(node)) {
    return "";
  }

  const props = node.props as {
    children?: React.ReactNode;
    className?: string;
  };
  const children = React.Children.toArray(props.children);

  if (
    children.some((child) => {
      if (!React.isValidElement(child) || child.type !== "h1") {
        return false;
      }

      return (child.props as { children?: React.ReactNode }).children === text;
    })
  ) {
    return props.className ?? "";
  }

  for (const child of children) {
    const match = findHeadingWrapperClassName(child, text);
    if (match) {
      return match;
    }
  }

  return "";
}

describe("account settings layout", () => {
  it("offsets the Your Account title to align with sidebar link text", () => {
    const element = AccountSettingsLayout({
      children: <div>Account settings page</div>,
    });

    expect(
      findHeadingByText(element, "Your Account")?.props.className
    ).toContain("pl-3");
  });

  it("starts the Your Account title at the same y offset as the Manage sidebar label", () => {
    const element = AccountSettingsLayout({
      children: <div>Account settings page</div>,
    });

    expect(findHeadingWrapperClassName(element, "Your Account")).toBe(
      "pt-2 pb-8"
    );
  });

  it("lists General and Source Control & Git in the settings sidebar", () => {
    const element = AccountSettingsLayout({
      children: <div>Account settings page</div>,
    });

    render(element);

    expect(screen.getByText("General")).toBeVisible();
    expect(screen.getByText("Source Control & Git")).toBeVisible();
    expect(screen.queryByText("Connections")).not.toBeInTheDocument();
  });
});
