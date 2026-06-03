import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/acme/signals";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch,
  }: {
    children?: ReactNode;
    href: string | { pathname: string };
    prefetch?: boolean;
  }) => (
    <a
      data-prefetch={String(prefetch)}
      href={typeof href === "string" ? href : href.pathname}
    >
      {children}
    </a>
  ),
}));

vi.mock("~/components/team-switcher", () => ({
  TeamSwitcher: () => <div>Team switcher</div>,
  TeamSwitcherSkeleton: () => <div>Loading team switcher</div>,
}));

vi.mock("@repo/ui/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children?: ReactNode }) => (
    <aside>{children}</aside>
  ),
  SidebarContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarFooter: ({ children }: { children?: ReactNode }) => (
    <footer>{children}</footer>
  ),
  SidebarGroup: ({
    children,
    label,
  }: {
    children?: ReactNode;
    label?: string;
  }) => (
    <section aria-label={label}>
      <h2>{label}</h2>
      {children}
    </section>
  ),
  SidebarGroupContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarHeader: ({ children }: { children?: ReactNode }) => (
    <header>{children}</header>
  ),
  SidebarMenu: ({ children }: { children?: ReactNode }) => <ul>{children}</ul>,
  SidebarMenuButton: ({
    children,
    isActive,
  }: {
    children?: ReactNode;
    isActive?: boolean;
  }) => <div data-active={isActive ? "true" : "false"}>{children}</div>,
  SidebarMenuItem: ({ children }: { children?: ReactNode }) => (
    <li>{children}</li>
  ),
}));

vi.mock("@repo/ui/components/ui/button", () => ({
  Button: ({ children }: { children?: ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

vi.mock("@repo/ui/components/ui/popover", () => ({
  Popover: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  PopoverTrigger: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const { AppSidebar } = await import("~/components/app-sidebar");

beforeEach(() => {
  pathname = "/acme/signals";
});

describe("AppSidebar", () => {
  it("renders workspace links separately from manage links", () => {
    render(<AppSidebar />);

    expect(screen.getByRole("link", { name: /signals/i })).toHaveAttribute(
      "href",
      "/acme/signals"
    );
    expect(screen.getByRole("link", { name: /people/i })).toHaveAttribute(
      "href",
      "/acme/people"
    );
    expect(screen.getByRole("link", { name: /skills/i })).toHaveAttribute(
      "href",
      "/acme/skills"
    );
    expect(screen.getByRole("link", { name: /skills/i })).toHaveAttribute(
      "data-prefetch",
      "false"
    );
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute(
      "href",
      "/acme/settings"
    );
    expect(screen.getByRole("link", { name: /connectors/i })).toHaveAttribute(
      "href",
      "/acme/connectors"
    );
    expect(
      screen.getByRole("region", { name: "Workspace" })
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Manage" })).toBeInTheDocument();
  });

  it("marks connectors active by route section", () => {
    pathname = "/acme/connectors";
    render(<AppSidebar />);

    const connectorsLink = screen.getByRole("link", { name: /connectors/i });
    expect(connectorsLink.closest("[data-active]")).toHaveAttribute(
      "data-active",
      "true"
    );
  });

  it("marks people active by route section", () => {
    pathname = "/acme/people";
    render(<AppSidebar />);

    const peopleLink = screen.getByRole("link", { name: /people/i });
    expect(peopleLink.closest("[data-active]")).toHaveAttribute(
      "data-active",
      "true"
    );
  });
});
