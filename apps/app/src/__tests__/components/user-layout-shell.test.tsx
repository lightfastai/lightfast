import { render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/account/settings/general";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

vi.mock("@repo/ui/components/ui/sidebar", () => ({
  SidebarInset: ({
    children,
    className,
  }: {
    children?: React.ReactNode;
    className?: string;
  }) => (
    <main className={className} data-testid="sidebar-inset">
      {children}
    </main>
  ),
  SidebarProvider: ({
    children,
    className,
  }: {
    children?: React.ReactNode;
    className?: string;
  }) => (
    <div className={className} data-testid="sidebar-provider">
      {children}
    </div>
  ),
  SidebarTrigger: ({ className }: { className?: string }) => (
    <button className={className} data-testid="sidebar-trigger" type="button" />
  ),
}));

vi.mock("~/components/app-sidebar", () => ({
  AppSidebar: () => <aside data-testid="app-sidebar" />,
}));

vi.mock("~/components/authenticated-topbar", () => ({
  AuthenticatedTopbar: ({ left }: { left?: React.ReactNode }) => (
    <header data-testid="authenticated-topbar">{left}</header>
  ),
}));

vi.mock("~/components/team-switcher", () => ({
  TeamSwitcher: () => <div data-testid="team-switcher" />,
  TeamSwitcherSkeleton: () => <div data-testid="team-switcher-skeleton" />,
}));

const { UserLayoutShell } = await import("~/components/user-layout-shell");

describe("UserLayoutShell", () => {
  beforeEach(() => {
    pathname = "/account/settings/general";
  });

  it("uses the app sidebar as a mobile-only drawer for account settings", () => {
    render(
      <UserLayoutShell>
        <div>Account settings</div>
      </UserLayoutShell>,
    );

    expect(screen.getByTestId("sidebar-provider")).toBeInTheDocument();
    expect(screen.getByTestId("app-sidebar").parentElement).toHaveClass(
      "lg:hidden",
    );
    expect(screen.getByTestId("sidebar-trigger")).toHaveClass("lg:hidden");
    expect(screen.getByTestId("team-switcher").parentElement).toHaveClass(
      "hidden",
      "lg:block",
    );
  });

  it("keeps non-settings account pages on the regular topbar shell", () => {
    pathname = "/account/teams/new";

    render(
      <UserLayoutShell>
        <div>Create team</div>
      </UserLayoutShell>,
    );

    expect(screen.queryByTestId("sidebar-provider")).not.toBeInTheDocument();
    expect(screen.queryByTestId("app-sidebar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-trigger")).not.toBeInTheDocument();
    expect(screen.getByTestId("team-switcher")).toBeInTheDocument();
  });
});
