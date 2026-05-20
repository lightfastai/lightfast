import React from "react";
import { describe, expect, it } from "vitest";
import SettingsLayout from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/layout";

function findComponentProps<TProps>(
  node: unknown,
  componentName: string
): TProps | null {
  if (!React.isValidElement(node)) {
    return null;
  }

  const type = node.type;
  if (typeof type === "function" && type.name === componentName) {
    return node.props as TProps;
  }

  const props = node.props as { children?: React.ReactNode };
  for (const child of React.Children.toArray(props.children)) {
    const match = findComponentProps<TProps>(child, componentName);
    if (match) {
      return match;
    }
  }

  return null;
}

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

describe("settings layout", () => {
  it("offsets the Settings title to align with sidebar link text", async () => {
    const element = await SettingsLayout({
      children: <div>Settings page</div>,
      params: Promise.resolve({ slug: "acme" }),
    });

    expect(findHeadingByText(element, "Settings")?.props.className).toContain(
      "pl-3"
    );
  });

  it("starts the Settings title at the same y offset as the Manage sidebar label", async () => {
    const element = await SettingsLayout({
      children: <div>Settings page</div>,
      params: Promise.resolve({ slug: "acme" }),
    });

    expect(findHeadingWrapperClassName(element, "Settings")).toBe("pt-2 pb-8");
  });

  it("includes general, members, billing, and API key navigation", async () => {
    const element = await SettingsLayout({
      children: <div>Settings page</div>,
      params: Promise.resolve({ slug: "acme" }),
    });

    const sidebarProps = findComponentProps<{
      items: Array<{ name: string; path: string }>;
    }>(element, "SettingsSidebar");

    expect(sidebarProps?.items).toEqual([
      { name: "General", path: "" },
      { name: "Members", path: "members" },
      { name: "Billing", path: "billing" },
      { name: "API Keys", path: "api-keys" },
    ]);
  });
});
