import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
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

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

const { default: AppNotFound } = await import("~/app/(app)/not-found");
const { default: AccountCatchAllNotFound } = await import(
  "~/app/(app)/(pending-allowed)/account/[...not-found]/page"
);

function containsComponentNamed(node: unknown, componentName: string): boolean {
  if (Array.isArray(node)) {
    return node.some((child) => containsComponentNamed(child, componentName));
  }

  if (!React.isValidElement(node)) {
    return false;
  }

  const type = node.type;
  if (typeof type === "function" && type.name === componentName) {
    return true;
  }

  const props = node.props as Record<string, unknown>;
  return Object.values(props).some((value) =>
    containsComponentNamed(value, componentName)
  );
}

describe("(app) authenticated not-found", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the authenticated topbar with the team switcher", () => {
    const element = AppNotFound();

    expect(containsComponentNamed(element, "AuthenticatedTopbar")).toBe(true);
    expect(containsComponentNamed(element, "TeamSwitcher")).toBe(true);
  });

  it("uses the app not-found boundary for unmatched account URLs", () => {
    expect(() => AccountCatchAllNotFound()).toThrow("NEXT_NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalledOnce();
  });
});
