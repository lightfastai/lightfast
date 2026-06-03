"use client";

import type { AppRouterOutputs } from "@api/app";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@repo/ui/components/ui/sidebar";
import { cn } from "@repo/ui/lib/utils";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Aperture,
  Blocks,
  BookOpen,
  HelpCircle,
  KeyRound,
  Mail,
  MessageCircle,
  Network,
  Scroll,
  Settings,
  Workflow,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { TeamSwitcher, TeamSwitcherSkeleton } from "~/components/team-switcher";
import { useTRPC } from "~/trpc/react";

type WorkspaceAssistantConversationList =
  AppRouterOutputs["org"]["workspace"]["assistant"]["listConversations"];
type WorkspaceAssistantConversationListItem =
  WorkspaceAssistantConversationList["items"][number];

interface NavItem {
  activePrefix?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  prefetch?: boolean;
  title: string;
}

function getOrgStandaloneItems(orgSlug: string): NavItem[] {
  return [
    {
      title: "Automations",
      href: `/${orgSlug}/automations`,
      icon: Workflow,
    },
    {
      title: "Connectors",
      href: `/${orgSlug}/connectors`,
      icon: Blocks,
    },
    {
      title: "Developer Connections",
      href: `/${orgSlug}/developer-connections`,
      icon: KeyRound,
    },
    {
      title: "Skills",
      href: `/${orgSlug}/skills`,
      icon: Scroll,
      prefetch: false,
    },
  ];
}

function getOrgWorkspaceItems(orgSlug: string): NavItem[] {
  return [
    {
      title: "Chat",
      href: `/${orgSlug}/chat`,
      activePrefix: `/${orgSlug}/chat`,
      icon: MessageCircle,
    },
    {
      title: "Signals",
      href: `/${orgSlug}/signals`,
      icon: Aperture,
    },
    {
      title: "People",
      href: `/${orgSlug}/people`,
      icon: Network,
    },
  ];
}

function getOrgManageItems(orgSlug: string): NavItem[] {
  return [
    {
      title: "Settings",
      href: `/${orgSlug}/settings`,
      icon: Settings,
    },
  ];
}

function isPathActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isActiveNavItem(item: NavItem, pathname: string) {
  if (item.activePrefix) {
    return (
      pathname === item.href ||
      pathname === item.activePrefix ||
      pathname.startsWith(`${item.activePrefix}/`)
    );
  }
  return isPathActive(item.href, pathname);
}

function NavItems({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const { isMobile, setOpenMobile } = useSidebar();

  return items.map((item) => {
    const isActive = isActiveNavItem(item, pathname);
    const handleNavigate = () => {
      if (isMobile) {
        setOpenMobile(false);
      }
    };

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          asChild
          className={cn(
            "h-11 rounded-xl lg:h-7 [&>svg]:size-3.5",
            isActive
              ? "text-foreground data-[active=true]:text-foreground"
              : "text-muted-foreground"
          )}
          isActive={isActive}
          size="sm"
        >
          <Link
            aria-current={isActive ? "page" : undefined}
            href={{ pathname: item.href }}
            onClick={handleNavigate}
            prefetch={item.prefetch ?? true}
          >
            <item.icon className="size-3.5" />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  });
}

function ChatHistory({
  orgSlug,
  pathname,
}: {
  orgSlug: string;
  pathname: string;
}) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.org.workspace.assistant.listConversations.queryOptions(
      { limit: 20 },
      { staleTime: 0 }
    )
  );

  return (
    <SidebarGroup collapsible defaultOpen label="Chats">
      <SidebarGroupContent>
        <nav aria-label="Chats">
          <SidebarMenu className="rounded-xl border border-border/50 bg-muted/20 p-1">
            {data.items.length > 0 ? (
              data.items.map((conversation) => (
                <ChatHistoryItem
                  conversation={conversation}
                  key={conversation.publicId}
                  orgSlug={orgSlug}
                  pathname={pathname}
                />
              ))
            ) : (
              <li className="px-2 py-2 text-muted-foreground text-xs">
                No chats yet
              </li>
            )}
          </SidebarMenu>
        </nav>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function ChatHistoryItem({
  conversation,
  orgSlug,
  pathname,
}: {
  conversation: WorkspaceAssistantConversationListItem;
  orgSlug: string;
  pathname: string;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const href = `/${orgSlug}/chat/${conversation.publicId}`;
  const isActive = pathname === href;
  const title = getConversationSidebarTitle(conversation);
  const handleNavigate = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        className={cn(
          "h-8 rounded-lg px-2 text-xs [&>svg]:size-3.5",
          isActive
            ? "text-foreground data-[active=true]:text-foreground"
            : "text-muted-foreground"
        )}
        isActive={isActive}
        size="sm"
      >
        <Link href={{ pathname: href }} onClick={handleNavigate} prefetch>
          <MessageCircle className="size-3.5" />
          <span className="truncate">{title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function ChatHistorySkeleton() {
  return (
    <SidebarGroup collapsible defaultOpen label="Chats">
      <SidebarGroupContent>
        <div className="rounded-xl border border-border/50 bg-muted/20 p-2 text-muted-foreground text-xs">
          Loading chats
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function getConversationSidebarTitle(
  conversation: WorkspaceAssistantConversationListItem
) {
  const title = conversation.title?.trim();
  return title || "Untitled chat";
}

export function AppSidebar() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  const pathParts = pathname.split("/").filter(Boolean);
  const orgSlug = pathParts[0] ?? "";

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="h-14 flex-row items-center px-4 py-0">
        <Suspense fallback={<TeamSwitcherSkeleton />}>
          <TeamSwitcher />
        </Suspense>
        {isMobile && (
          <Button
            aria-label="Close sidebar"
            className="ml-auto size-11 rounded-xl text-muted-foreground"
            onClick={() => setOpenMobile(false)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        )}
      </SidebarHeader>
      <SidebarContent>
        {orgSlug && (
          <>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavItems
                    items={getOrgStandaloneItems(orgSlug)}
                    pathname={pathname}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup collapsible defaultOpen label="Workspace">
              <SidebarGroupContent>
                <nav aria-label="Workspace">
                  <SidebarMenu>
                    <NavItems
                      items={getOrgWorkspaceItems(orgSlug)}
                      pathname={pathname}
                    />
                  </SidebarMenu>
                </nav>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup collapsible defaultOpen label="Manage">
              <SidebarGroupContent>
                <nav aria-label="Manage">
                  <SidebarMenu>
                    <NavItems
                      items={getOrgManageItems(orgSlug)}
                      pathname={pathname}
                    />
                  </SidebarMenu>
                </nav>
              </SidebarGroupContent>
            </SidebarGroup>
            <Suspense fallback={<ChatHistorySkeleton />}>
              <ChatHistory orgSlug={orgSlug} pathname={pathname} />
            </Suspense>
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="size-11 rounded-full bg-muted p-1 lg:h-8 lg:w-8"
              size="icon"
              title="Help"
              variant="outline"
            >
              <HelpCircle className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-48">
            <DropdownMenuItem asChild>
              <a href="mailto:support@lightfast.ai">
                <Mail className="size-3.5" />
                Contact Support
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="https://lightfast.ai/docs/get-started/overview"
                rel="noopener noreferrer"
                target="_blank"
              >
                <BookOpen className="size-3.5" />
                Help Docs
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
