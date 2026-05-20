import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@vendor/clerk/server", () => ({
  currentUser: vi.fn().mockResolvedValue({
    emailAddresses: [],
    primaryEmailAddress: { emailAddress: "user@example.com" },
    username: null,
  }),
}));

const { default: PendingNotAllowedNotFound } = await import("./not-found");
const { default: OrganizationNotFound } = await import("./[slug]/not-found");

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

describe("pending-not-allowed not-found pages", () => {
  it("inlines the authenticated route not-found body", async () => {
    const element = await PendingNotAllowedNotFound();

    expect(containsComponentNamed(element, "AuthenticatedNotFound")).toBe(
      false
    );
  });

  it("inlines the organization not-found body", async () => {
    const element = await OrganizationNotFound();

    expect(containsComponentNamed(element, "AuthenticatedNotFound")).toBe(
      false
    );
  });
});
