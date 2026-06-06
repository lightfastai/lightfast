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
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Aperture,
  Blocks,
  BookOpen,
  HelpCircle,
  ListChecks,
  Mail,
  MessageCircle,
  MessageCirclePlus,
  Network,
  Scroll,
  Settings,
  Workflow,
  X,
} from "lucide-react";
import type { ComponentType } from "react";
import { Suspense } from "react";
import { useTRPC } from "~/trpc/react";
import {
  getWorkspaceNavSections,
  isWorkspacePathActive,
  type WorkspaceNavItem,
  type WorkspaceNavTitle,
} from "./app-sidebar-model";
import { TeamSwitcher, TeamSwitcherSkeleton } from "./team-switcher";

type WorkspaceAssistantConversationList =
  AppRouterOutputs["org"]["workspace"]["assistant"]["listConversations"];
type WorkspaceAssistantConversationListItem =
  WorkspaceAssistantConversationList["items"][number];

const navIcons: Record<
  WorkspaceNavTitle,
  ComponentType<{ className?: string }>
> = {
  Automations: Workflow,
  Connectors: Blocks,
  Decisions: ListChecks,
  People: Network,
  Settings,
  Signals: Aperture,
  Skills: Scroll,
};

export function AppSidebar({
  orgSlug,
  showChatHistory = true,
}: {
  orgSlug: string;
  showChatHistory?: boolean;
}) {
  const { pathname } = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const navSections = getWorkspaceNavSections(orgSlug);

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="h-14 flex-row items-center px-4 py-0">
        <Suspense fallback={<TeamSwitcherSkeleton />}>
          <TeamSwitcher />
        </Suspense>
        <div className="ml-auto flex items-center gap-1">
          <Button
            aria-label="New chat"
            asChild
            className="size-11 rounded-full lg:h-6 lg:w-6"
            size="sm"
            title="New chat"
            variant="ghost"
          >
            <Link
              onClick={() => {
                if (isMobile) {
                  setOpenMobile(false);
                }
              }}
              params={{ slug: orgSlug }}
              preload="intent"
              to="/$slug/chat"
            >
              <MessageCirclePlus className="size-3.5" />
            </Link>
          </Button>
          {isMobile ? (
            <Button
              aria-label="Close sidebar"
              className="size-11 rounded-xl text-muted-foreground"
              onClick={() => setOpenMobile(false)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {navSections.map((section) => (
          <SidebarGroup
            collapsible={Boolean(section.label)}
            defaultOpen
            key={section.label ?? "primary"}
            label={section.label}
          >
            <SidebarGroupContent>
              <nav aria-label={section.label ?? "Workspace navigation"}>
                <SidebarMenu>
                  <NavItems
                    items={section.items}
                    orgSlug={orgSlug}
                    pathname={pathname}
                  />
                </SidebarMenu>
              </nav>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        {showChatHistory ? (
          <ChatHistory orgSlug={orgSlug} pathname={pathname} />
        ) : null}
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
              <a
                href="https://lightfast.ai/docs/get-started/overview"
                rel="noopener noreferrer"
                target="_blank"
              >
                <BookOpen className="size-3.5" />
                Help Docs
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function ChatHistory({
  orgSlug,
  pathname,
}: {
  orgSlug: string;
  pathname: string;
}) {
  const trpc = useTRPC();
  const { data, error, isPending } = useQuery({
    ...trpc.org.workspace.assistant.listConversations.queryOptions(
      { limit: 20 },
      { staleTime: 0 }
    ),
    enabled: typeof window !== "undefined" && Boolean(orgSlug),
  });

  if (isPending || error || !data?.items.length) {
    return null;
  }

  return (
    <SidebarGroup collapsible defaultOpen label="Chats">
      <SidebarGroupContent>
        <nav aria-label="Chats">
          <SidebarMenu>
            {data.items.map((conversation) => (
              <ChatHistoryItem
                conversation={conversation}
                key={conversation.publicId}
                orgSlug={orgSlug}
                pathname={pathname}
              />
            ))}
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

  return (
    <SidebarMenuItem>
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
          onClick={() => {
            if (isMobile) {
              setOpenMobile(false);
            }
          }}
          params={{ conversationId: conversation.publicId, slug: orgSlug }}
          preload="intent"
          to="/$slug/chat/$conversationId"
        >
          <MessageCircle className="size-3.5" />
          <span>{title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function getConversationSidebarTitle(
  conversation: WorkspaceAssistantConversationListItem
) {
  const title = conversation.title?.trim();
  return title || "Untitled chat";
}

function NavItems({
  items,
  orgSlug,
  pathname,
}: {
  items: WorkspaceNavItem[];
  orgSlug: string;
  pathname: string;
}) {
  const { isMobile, setOpenMobile } = useSidebar();

  return items.map((item) => {
    const Icon = navIcons[item.title];
    const isActive = isWorkspacePathActive(item.href, pathname);

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
            onClick={() => {
              if (isMobile) {
                setOpenMobile(false);
              }
            }}
            params={{ slug: orgSlug }}
            preload="intent"
            to={item.to}
          >
            <Icon className="size-3.5" />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  });
}
