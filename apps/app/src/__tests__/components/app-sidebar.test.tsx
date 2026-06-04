import { fireEvent, render, screen } from "@testing-library/react";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactElement,
  ReactNode,
} from "react";
import { cloneElement, isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/acme/signals";
let isMobile = false;
const setOpenMobileMock = vi.fn();
const listConversationsQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "assistant", "listConversations"],
}));
let conversationsData = {
  items: [
    {
      publicId: "conv_recent",
      title: "Summarize my active opportunities",
      updatedAt: new Date("2026-06-02T00:00:00.000Z"),
    },
    {
      publicId: "conv_untitled",
      title: null,
      updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    },
  ],
  nextCursor: null,
};
let conversationsIsError = false;

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    children?: ReactNode;
    href: string | { pathname: string };
    prefetch?: boolean;
  }) => (
    <a
      data-prefetch={String(prefetch)}
      href={typeof href === "string" ? href : href.pathname}
      {...props}
    >
      {children}
    </a>
  ),
}));

vi.mock("~/components/team-switcher", () => ({
  TeamSwitcher: () => <div>Team switcher</div>,
  TeamSwitcherSkeleton: () => <div>Loading team switcher</div>,
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        assistant: {
          listConversations: {
            queryOptions: listConversationsQueryOptionsMock,
          },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: conversationsData, isError: conversationsIsError }),
}));

vi.mock("@repo/ui/components/ui/sidebar", () => ({
  useSidebar: () => ({
    isMobile,
    setOpenMobile: setOpenMobileMock,
  }),
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
  SidebarMenu: ({
    children,
    ...props
  }: HTMLAttributes<HTMLUListElement> & { children?: ReactNode }) => (
    <ul {...props}>{children}</ul>
  ),
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
  Button: ({
    asChild,
    children,
    type = "button",
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
    children?: ReactNode;
  }) => {
    if (asChild && isValidElement(children)) {
      return cloneElement(children as ReactElement, props);
    }
    return (
      <button type={type} {...props}>
        {children}
      </button>
    );
  },
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
  isMobile = false;
  setOpenMobileMock.mockClear();
  listConversationsQueryOptionsMock.mockClear();
  conversationsData = {
    items: [
      {
        publicId: "conv_recent",
        title: "Summarize my active opportunities",
        updatedAt: new Date("2026-06-02T00:00:00.000Z"),
      },
      {
        publicId: "conv_untitled",
        title: null,
        updatedAt: new Date("2026-06-01T00:00:00.000Z"),
      },
    ],
    nextCursor: null,
  };
  conversationsIsError = false;
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

  it("exposes workspace and manage navigation landmarks", () => {
    render(<AppSidebar />);

    expect(
      screen.getByRole("navigation", { name: "Workspace" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Manage" })
    ).toBeInTheDocument();
  });

  it("renders the workspace navigation links in order", () => {
    render(<AppSidebar />);

    const workspaceLinks = screen
      .getByRole("region", { name: "Workspace" })
      .querySelectorAll("a");

    expect(Array.from(workspaceLinks).map((link) => link.textContent)).toEqual([
      "Signals",
      "People",
    ]);
  });

  it("marks the active nav link with aria-current", () => {
    pathname = "/acme/people";
    render(<AppSidebar />);

    expect(screen.getByRole("link", { current: "page" })).toHaveAccessibleName(
      "People"
    );
  });

  it("renders existing chats in a sidebar container below settings", () => {
    render(<AppSidebar />);

    const manageLinks = screen
      .getByRole("region", { name: "Manage" })
      .querySelectorAll("a");
    expect(Array.from(manageLinks).map((link) => link.textContent)).toEqual([
      "Settings",
    ]);

    const chatHistory = screen.getByRole("region", { name: "Chats" });
    expect(chatHistory).toBeInTheDocument();
    expect(chatHistory.compareDocumentPosition(manageLinks[0]!)).toBe(
      Node.DOCUMENT_POSITION_PRECEDING
    );
    expect(
      screen.getByRole("link", {
        name: "Summarize my active opportunities",
      })
    ).toHaveAttribute("href", "/acme/chat/conv_recent");
    expect(screen.getByRole("link", { name: "Untitled chat" })).toHaveAttribute(
      "href",
      "/acme/chat/conv_untitled"
    );
    expect(listConversationsQueryOptionsMock).toHaveBeenCalledWith(
      { limit: 20 },
      expect.objectContaining({ staleTime: 0 })
    );
  });

  it("renders a new chat button in the header", () => {
    render(<AppSidebar />);

    const newChat = screen.getByRole("link", { name: "New chat" });
    expect(newChat).toHaveAttribute("href", "/acme/chat");
    expect(newChat).toHaveAttribute("data-prefetch", "false");
  });

  it("hides the chats group when there are no conversations", () => {
    conversationsData = { items: [], nextCursor: null };
    render(<AppSidebar />);

    expect(
      screen.queryByRole("region", { name: "Chats" })
    ).not.toBeInTheDocument();
  });

  it("hides the chats group when the chat-history query errors", () => {
    conversationsIsError = true;
    render(<AppSidebar />);

    expect(
      screen.queryByRole("region", { name: "Chats" })
    ).not.toBeInTheDocument();
  });

  it("marks the active existing chat in the chat history", () => {
    pathname = "/acme/chat/conv_recent";
    render(<AppSidebar />);

    expect(
      screen
        .getByRole("link", { name: "Summarize my active opportunities" })
        .closest("[data-active]")
    ).toHaveAttribute("data-active", "true");
  });

  it("does not mark settings active for similar path prefixes", () => {
    pathname = "/acme/settings-archive";
    render(<AppSidebar />);

    const settingsLink = screen.getByRole("link", { name: /settings/i });
    expect(settingsLink.closest("[data-active]")).toHaveAttribute(
      "data-active",
      "false"
    );
    expect(settingsLink).not.toHaveAttribute("aria-current");
  });

  it("closes the mobile sidebar when navigating", () => {
    isMobile = true;
    render(<AppSidebar />);

    fireEvent.click(screen.getByRole("link", { name: /signals/i }));

    expect(setOpenMobileMock).toHaveBeenCalledWith(false);
  });

  it("shows a mobile close control", () => {
    isMobile = true;
    render(<AppSidebar />);

    fireEvent.click(screen.getByRole("button", { name: /close sidebar/i }));

    expect(setOpenMobileMock).toHaveBeenCalledWith(false);
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
