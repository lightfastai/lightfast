import type { AppRouterOutputs } from "@api/app";
import { useClerk } from "@clerk/tanstack-react-start";
import {
  ApertureIcon,
  BlocksIcon,
  BookOpen01Icon,
  Cancel01Icon,
  CheckListIcon,
  HelpCircleIcon,
  Key01Icon,
  LogoutIcon,
  Mail01Icon,
  Message01Icon,
  MessageCirclePlus,
  Scroll01Icon,
  SettingsIcon,
  UserGroupIcon,
  WorkflowSquare07Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Button } from "@repo/ui/components/ui/button";
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
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { useMounted } from "@repo/ui/hooks/use-mounted";
import { cn } from "@repo/ui/lib/utils";
import { Avatar, AvatarFallback } from "@repo/ui-v2/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/ui-v2/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { Suspense } from "react";
import { accountProfileQueryOptions } from "~/account/account-queries";
import { useTRPC } from "~/trpc/react";
import {
  getWorkspaceNavSections,
  isWorkspacePathActive,
  type WorkspaceNavItem,
  type WorkspaceNavTitle,
} from "./app-sidebar-model";
import { TeamSwitcher, TeamSwitcherSkeleton } from "./team-switcher";
import { getUserMenuIdentity, SETTINGS_HREF } from "./user-menu-model";

type WorkspaceAssistantConversationList =
  AppRouterOutputs["org"]["workspace"]["assistant"]["listConversations"];
type WorkspaceAssistantConversationListItem =
  WorkspaceAssistantConversationList["items"][number];

const navIcons: Record<WorkspaceNavTitle, IconSvgElement> = {
  Automations: WorkflowSquare07Icon,
  Connectors: BlocksIcon,
  Decisions: CheckListIcon,
  "Developer Connections": Key01Icon,
  People: UserGroupIcon,
  Settings: SettingsIcon,
  Signals: ApertureIcon,
  Skills: Scroll01Icon,
};

export function AppSidebar({ orgSlug }: { orgSlug: string }) {
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
              preload={false}
              to="/$slug/chat"
            >
              <HugeiconsIcon
                aria-hidden="true"
                className="size-3.5"
                icon={MessageCirclePlus}
              />
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
              <HugeiconsIcon
                aria-hidden="true"
                className="size-4"
                icon={Cancel01Icon}
              />
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
        <ChatHistory orgSlug={orgSlug} pathname={pathname} />
      </SidebarContent>
      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}

function UserMenu() {
  const { signOut } = useClerk();
  const mounted = useMounted();

  const { data: profile, isPending } = useQuery({
    ...accountProfileQueryOptions(),
    enabled: typeof window !== "undefined",
    staleTime: 5 * 60 * 1000,
  });

  if (!mounted || isPending || !profile) {
    return <UserMenuSkeleton />;
  }

  const { primaryIdentity, secondaryIdentity } = getUserMenuIdentity(profile);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Open user menu"
            className="h-11 w-full justify-start gap-2 rounded-xl px-2 text-left"
            variant="ghost"
          />
        }
      >
        <Avatar className="size-7">
          <AvatarFallback className="bg-foreground text-[10px] text-background">
            {profile.initials}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 truncate text-left">
          {primaryIdentity}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" size="sm">
        <DropdownMenuGroup>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Avatar className="size-6">
              <AvatarFallback className="bg-foreground text-[10px] text-background">
                {profile.initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-sm">{primaryIdentity}</p>
              {secondaryIdentity ? (
                <p className="truncate text-muted-foreground text-xs">
                  {secondaryIdentity}
                </p>
              ) : null}
            </div>
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            render={<Link preload="intent" to={SETTINGS_HREF} />}
          >
            <HugeiconsIcon aria-hidden="true" icon={SettingsIcon} />
            Your Account
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <HugeiconsIcon aria-hidden="true" icon={HelpCircleIcon} />
              Help
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                render={(props) => (
                  <a
                    {...props}
                    href="https://lightfast.ai/docs/get-started/overview"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {props.children}
                  </a>
                )}
              >
                <HugeiconsIcon aria-hidden="true" icon={BookOpen01Icon} />
                Help Docs
              </DropdownMenuItem>
              <DropdownMenuItem
                render={(props) => (
                  <a {...props} href="mailto:support@lightfast.ai">
                    {props.children}
                  </a>
                )}
              >
                <HugeiconsIcon aria-hidden="true" icon={Mail01Icon} />
                Contact Support
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => void signOut({ redirectUrl: "/sign-in" })}
          >
            <HugeiconsIcon aria-hidden="true" icon={LogoutIcon} />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenuSkeleton() {
  return (
    <div className="flex h-11 items-center gap-2 rounded-xl px-2">
      <Skeleton className="size-7 rounded-full" />
      <Skeleton className="h-4 min-w-0 flex-1 rounded-xl" />
    </div>
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
          <HugeiconsIcon
            aria-hidden="true"
            className="size-3.5"
            icon={Message01Icon}
          />
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
    const icon = navIcons[item.title];
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
            <HugeiconsIcon
              aria-hidden="true"
              className="size-3.5"
              icon={icon}
            />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  });
}
